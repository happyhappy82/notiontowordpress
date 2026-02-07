import {
  queryScheduledPages,
  fetchPageById,
  getPropertyValue,
  getMultiSelectValues,
  getCoverImage,
  type NotionPage,
} from "./notion/query.js";
import { fetchAllBlocks } from "./notion/blocks.js";
import { updateWpPostId } from "./notion/update.js";
import { convertBlocksToHtml, extractPlainText, extractFaqItems } from "./converter/index.js";
import { processImages, uploadCoverImage } from "./images/pipeline.js";
import { createPost, updatePost, deletePost, findPostByPageId } from "./wordpress/posts.js";
import { resolveCategoryFromTags, resolveTags } from "./wordpress/taxonomy.js";
import { logger } from "./utils/logger.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

async function publishPage(page: NotionPage, existingWpPostId?: number): Promise<void> {
  const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");
  const slug = getPropertyValue(page, "Slug") || slugify(title);
  const excerpt = getPropertyValue(page, "Excerpt") || "";
  const date = getPropertyValue(page, "Date") || "";
  const tags = getMultiSelectValues(page, "Tags");
  const coverUrl = getPropertyValue(page, "대표 이미지") || getCoverImage(page);

  logger.info(`${existingWpPostId ? "Updating" : "Publishing"}: "${title}"`, { pageId: page.id, slug, tags });

  // 1. Fetch all blocks recursively
  logger.info("Fetching page blocks...");
  const blocks = await fetchAllBlocks(page.id);
  logger.info(`Fetched ${blocks.length} top-level blocks`);

  // 2. Process images: download from Notion, upload to WP
  const imageUrlMap = await processImages(blocks, slug);

  // 3. Convert blocks to HTML with WP image URLs
  const html = convertBlocksToHtml(blocks, imageUrlMap);
  logger.info("HTML conversion complete", { length: html.length });

  // 3.5. Excerpt가 없으면 본문에서 자동 추출
  const finalExcerpt = excerpt || extractPlainText(blocks, 160);

  // 3.6. Meta: page_id 저장 + FAQ 스키마
  const meta: Record<string, string> = { _notion_page_id: page.id };
  const faqItems = extractFaqItems(blocks);
  if (faqItems.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };
    meta._faq_schema_json = JSON.stringify(faqSchema);
    logger.info("FAQ schema generated", { questions: faqItems.length });
  }

  // 4. Upload cover image
  const featuredMediaId = await uploadCoverImage(coverUrl, slug);

  // 5. Resolve categories and tags
  const categoryId = await resolveCategoryFromTags(tags);
  const tagIds = await resolveTags(tags);

  // 6. Create or update WP post
  const postParams = {
    title,
    slug: existingWpPostId ? undefined : slug,
    content: html,
    status: "publish" as const,
    categories: [categoryId],
    tags: tagIds,
    featured_media: featuredMediaId || undefined,
    excerpt: finalExcerpt || undefined,
    date: date || undefined,
    meta,
  };

  const post = existingWpPostId
    ? await updatePost(existingWpPostId, postParams)
    : await createPost(postParams);

  // 7. Update Notion with WP Post ID
  await updateWpPostId(page.id, post.id);

  logger.info(`Successfully ${existingWpPostId ? "updated" : "published"}: "${title}"`, {
    wpPostId: post.id,
    wpLink: post.link,
  });
}

async function handleScheduled(): Promise<void> {
  const pages = await queryScheduledPages();

  if (pages.length === 0) {
    logger.info("No scheduled pages to publish. Exiting.");
    return;
  }

  // 1회 실행에 1개만 발행
  const page = pages[0];
  const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");

  // page_id 중복 체크
  const existing = await findPostByPageId(page.id);
  if (existing) {
    logger.info(`Duplicate found, skipping: "${title}"`, { wpPostId: existing.id, pageId: page.id });
    await updateWpPostId(page.id, existing.id);
    return;
  }

  await publishPage(page);
}

async function handleWebhook(notionPageId: string): Promise<void> {
  logger.info("Webhook mode", { notionPageId });

  const page = await fetchPageById(notionPageId);
  const status = getPropertyValue(page, "Status");
  const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");

  logger.info(`Page status: "${status}"`, { title, pageId: notionPageId });

  // Deleted → WP에서 삭제
  if (status === "Deleted") {
    const existing = await findPostByPageId(notionPageId);
    if (existing) {
      await deletePost(existing.id);
      logger.info(`Deleted from WP: "${title}"`, { wpPostId: existing.id });
    } else {
      logger.info(`No WP post found to delete: "${title}"`);
    }
    return;
  }

  // Published가 아니면 무시
  if (status !== "Published") {
    logger.info(`Skipping non-published status: "${status}"`, { title });
    return;
  }

  // Published → 중복 체크 후 생성 또는 덮어쓰기
  const existing = await findPostByPageId(notionPageId);
  if (existing) {
    logger.info(`Updating existing WP post: "${title}"`, { wpPostId: existing.id });
    await publishPage(page, existing.id);
  } else {
    logger.info(`Creating new WP post: "${title}"`);
    await publishPage(page);
  }
}

async function main(): Promise<void> {
  const mode = process.env.PUBLISH_MODE || "scheduled";
  const notionPageId = process.env.NOTION_PAGE_ID || "";

  logger.info("=== Notion to WordPress Publisher ===", { mode });

  try {
    if (mode === "webhook" && notionPageId) {
      await handleWebhook(notionPageId);
    } else {
      await handleScheduled();
    }
  } catch (error) {
    logger.error("Fatal error", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main();

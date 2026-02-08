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
import { createPost } from "./wordpress/posts.js";
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

async function publishPage(page: NotionPage): Promise<void> {
  const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");
  const slug = getPropertyValue(page, "Slug") || slugify(title);
  const excerpt = getPropertyValue(page, "Excerpt") || "";
  const date = getPropertyValue(page, "Date") || "";
  const tags = getMultiSelectValues(page, "Tags");
  const coverUrl = getPropertyValue(page, "대표 이미지") || getCoverImage(page);

  logger.info(`Publishing: "${title}"`, { pageId: page.id, slug, tags });

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

  // 6. Create WP post (항상 신규 발행)
  const post = await createPost({
    title,
    slug,
    content: html,
    status: "publish" as const,
    categories: [categoryId],
    tags: tagIds,
    featured_media: featuredMediaId || undefined,
    excerpt: finalExcerpt || undefined,
    date: date || undefined,
    meta,
  });

  // 7. Update Notion with WP Post ID
  await updateWpPostId(page.id, post.id);

  logger.info(`Successfully published: "${title}"`, {
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
  await publishPage(page);
}

async function handleWebhook(notionPageId: string): Promise<void> {
  logger.info("Webhook mode", { notionPageId });

  const page = await fetchPageById(notionPageId);
  const status = getPropertyValue(page, "Status");
  const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");

  logger.info(`Page status: "${status}"`, { title, pageId: notionPageId });

  // Published가 아니면 무시
  if (status !== "Published") {
    logger.info(`Skipping non-published status: "${status}"`, { title });
    return;
  }

  // 항상 신규 발행
  logger.info(`Creating new WP post: "${title}"`);
  await publishPage(page);
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

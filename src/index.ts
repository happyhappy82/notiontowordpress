import {
  queryPublishablePages,
  getPropertyValue,
  getMultiSelectValues,
  getCoverImage,
  type NotionPage,
} from "./notion/query.js";
import { fetchAllBlocks } from "./notion/blocks.js";
import { updateWpPostId } from "./notion/update.js";
import { convertBlocksToHtml } from "./converter/index.js";
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

  // 4. Upload cover image
  const featuredMediaId = await uploadCoverImage(coverUrl, slug);

  // 5. Resolve categories and tags
  const categoryId = await resolveCategoryFromTags(tags);
  const tagIds = await resolveTags(tags);

  // 6. Create WP post
  const post = await createPost({
    title,
    content: html,
    status: "publish",
    categories: [categoryId],
    tags: tagIds,
    featured_media: featuredMediaId || undefined,
    excerpt: excerpt || undefined,
    date: date || undefined,
  });

  // 7. Update Notion with WP Post ID
  await updateWpPostId(page.id, post.id);

  logger.info(`Successfully published: "${title}"`, {
    wpPostId: post.id,
    wpLink: post.link,
  });
}

async function main(): Promise<void> {
  logger.info("=== Notion to WordPress Publisher ===");

  try {
    const pages = await queryPublishablePages();

    if (pages.length === 0) {
      logger.info("No pages to publish. Exiting.");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const page of pages) {
      const title = getPropertyValue(page, "Title") || getPropertyValue(page, "Name");
      try {
        await publishPage(page);
        successCount++;
      } catch (error) {
        failCount++;
        logger.error(`Failed to publish: "${title}"`, {
          pageId: page.id,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next page
      }
    }

    logger.info("=== Publishing complete ===", {
      total: pages.length,
      success: successCount,
      failed: failCount,
    });

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error("Fatal error", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main();

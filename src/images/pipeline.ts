import type { NotionBlock } from "../notion/blocks.js";
import { uploadImageToWp } from "../wordpress/media.js";
import { logger } from "../utils/logger.js";

/**
 * Collect all image URLs from Notion blocks (recursive).
 */
export function collectImageUrls(blocks: NotionBlock[]): string[] {
  const urls: string[] = [];

  for (const block of blocks) {
    if (block.type === "image") {
      const data = block.image as {
        type: string;
        file?: { url: string };
        external?: { url: string };
      } | undefined;

      if (data) {
        const url = data.type === "file" ? data.file?.url || "" : data.external?.url || "";
        if (url) urls.push(url);
      }
    }

    if (block.children) {
      urls.push(...collectImageUrls(block.children));
    }
  }

  return urls;
}

/**
 * Download images from Notion and upload to WP.
 * Returns a Map of original URL → WP URL.
 */
export async function processImages(
  blocks: NotionBlock[],
  slug: string
): Promise<Map<string, string>> {
  const imageUrls = collectImageUrls(blocks);
  const urlMap = new Map<string, string>();

  if (imageUrls.length === 0) {
    return urlMap;
  }

  logger.info(`Processing ${imageUrls.length} images`, { slug });

  for (let i = 0; i < imageUrls.length; i++) {
    const originalUrl = imageUrls[i];
    try {
      const filenameHint = `${slug}-${i + 1}`;
      const media = await uploadImageToWp(originalUrl, filenameHint);
      urlMap.set(originalUrl, media.source_url);
      logger.info(`Image ${i + 1}/${imageUrls.length} uploaded`, {
        wpUrl: media.source_url,
      });
    } catch (error) {
      logger.error(`Failed to upload image ${i + 1}/${imageUrls.length}`, {
        error: error instanceof Error ? error.message : String(error),
        url: originalUrl.substring(0, 100),
      });
      // Keep original URL on failure
    }
  }

  return urlMap;
}

/**
 * Upload a single cover image to WP and return its media ID.
 */
export async function uploadCoverImage(
  coverUrl: string,
  slug: string
): Promise<number | null> {
  if (!coverUrl) return null;

  try {
    logger.info("Uploading cover image", { slug });
    const media = await uploadImageToWp(coverUrl, `${slug}-cover`);
    return media.id;
  } catch (error) {
    logger.error("Failed to upload cover image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

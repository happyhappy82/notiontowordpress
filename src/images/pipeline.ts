import type { NotionBlock } from "../notion/blocks.js";
import { uploadImageToWp } from "../wordpress/media.js";
import { logger } from "../utils/logger.js";

interface ImageInfo {
  url: string;
  caption: string;
}

/**
 * Collect all image URLs and captions from Notion blocks (recursive).
 */
export function collectImageInfo(blocks: NotionBlock[]): ImageInfo[] {
  const images: ImageInfo[] = [];

  for (const block of blocks) {
    if (block.type === "image") {
      const data = block.image as {
        type: string;
        file?: { url: string };
        external?: { url: string };
        caption?: Array<{ plain_text: string }>;
      } | undefined;

      if (data) {
        const url = data.type === "file" ? data.file?.url || "" : data.external?.url || "";
        const caption = data.caption?.map((rt) => rt.plain_text).join("") || "";
        if (url) images.push({ url, caption });
      }
    }

    if (block.children) {
      images.push(...collectImageInfo(block.children));
    }
  }

  return images;
}

/**
 * Download images from Notion and upload to WP.
 * Returns a Map of original URL → WP URL.
 */
export async function processImages(
  blocks: NotionBlock[],
  slug: string
): Promise<Map<string, string>> {
  const images = collectImageInfo(blocks);
  const urlMap = new Map<string, string>();

  if (images.length === 0) {
    return urlMap;
  }

  logger.info(`Processing ${images.length} images`, { slug });

  for (let i = 0; i < images.length; i++) {
    const { url: originalUrl, caption } = images[i];
    try {
      const filenameHint = `${slug}-${i + 1}`;
      const media = await uploadImageToWp(originalUrl, filenameHint, caption);
      urlMap.set(originalUrl, media.source_url);
      logger.info(`Image ${i + 1}/${images.length} uploaded`, {
        wpUrl: media.source_url,
        altText: caption || "(empty)",
      });
    } catch (error) {
      logger.error(`Failed to upload image ${i + 1}/${images.length}`, {
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

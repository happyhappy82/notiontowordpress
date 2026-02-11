import { wpUpload, wpFetch } from "./client.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

interface WpMedia {
  id: number;
  source_url: string;
}

function guessContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function guessExtension(url: string, contentType: string): string {
  // Try from URL path first
  const urlPath = url.split("?")[0];
  const match = urlPath.match(/\.(\w+)$/);
  if (match) return match[1];

  // Fallback to content type
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/jpeg": "jpg",
  };
  return extMap[contentType] || "jpg";
}

export async function uploadImageToWp(
  imageUrl: string,
  filenameHint?: string,
  altText?: string
): Promise<WpMedia> {
  logger.info("Downloading image for WP upload", { imageUrl: imageUrl.substring(0, 100) });

  const imageBuffer = await withRetry(
    async () => {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const buf = await response.arrayBuffer();
      return new Blob([buf]);
    },
    { label: "download image" }
  );

  const contentType = guessContentType(imageUrl);
  const ext = guessExtension(imageUrl, contentType);
  const filename = filenameHint
    ? `${filenameHint}.${ext}`
    : `notion-image-${Date.now()}.${ext}`;

  logger.info("Uploading image to WP", { filename, size: imageBuffer.size });

  const result = await wpUpload("/media", imageBuffer, filename, contentType);
  const mediaId = result.id as number;

  // Set alt_text on WP media object
  if (altText) {
    try {
      await wpFetch(`/media/${mediaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: altText }),
      });
      logger.info("Alt text set on media", { mediaId, altText });
    } catch (error) {
      logger.warn("Failed to set alt_text on media", {
        mediaId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    id: mediaId,
    source_url: result.source_url as string,
  };
}

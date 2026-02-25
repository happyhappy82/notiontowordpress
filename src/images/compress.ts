import sharp from "sharp";
import { logger } from "../utils/logger.js";

const MAX_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_WIDTH = 1920;
const QUALITY_STEPS = [80, 60, 40, 20];

/**
 * Compress image buffer to fit under 1MB.
 * - Resize to max 1920px width
 * - Progressively reduce quality until under 1MB
 * Returns { buffer, contentType } ready for upload.
 */
export async function compressImage(
  input: Buffer,
  originalContentType: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const originalSize = input.length;

  if (originalSize <= MAX_SIZE) {
    logger.info("Image already under 1MB, skipping compression", {
      size: `${(originalSize / 1024).toFixed(0)}KB`,
    });
    return { buffer: input, contentType: originalContentType };
  }

  logger.info("Compressing image", {
    originalSize: `${(originalSize / 1024 / 1024).toFixed(2)}MB`,
  });

  const isAnimated = originalContentType === "image/gif";
  if (isAnimated) {
    logger.warn("GIF compression not supported, uploading as-is");
    return { buffer: input, contentType: originalContentType };
  }

  // Always output as JPEG for best compression (except SVG which shouldn't be compressed)
  if (originalContentType === "image/svg+xml") {
    return { buffer: input, contentType: originalContentType };
  }

  for (const quality of QUALITY_STEPS) {
    const result = await sharp(input)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (result.length <= MAX_SIZE) {
      logger.info("Compression successful", {
        quality,
        size: `${(result.length / 1024).toFixed(0)}KB`,
        reduction: `${(((originalSize - result.length) / originalSize) * 100).toFixed(0)}%`,
      });
      return { buffer: result, contentType: "image/jpeg" };
    }

    logger.info(`Quality ${quality} still too large: ${(result.length / 1024).toFixed(0)}KB, trying lower`);
  }

  // Last resort: reduce dimensions further
  let width = MAX_WIDTH;
  while (width >= 640) {
    width = Math.floor(width * 0.7);
    const result = await sharp(input)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 40, mozjpeg: true })
      .toBuffer();

    if (result.length <= MAX_SIZE) {
      logger.info("Compression successful with dimension reduction", {
        width,
        size: `${(result.length / 1024).toFixed(0)}KB`,
      });
      return { buffer: result, contentType: "image/jpeg" };
    }
  }

  // Should be impossible to reach here, but just in case
  logger.warn("Could not compress under 1MB, using smallest result");
  const fallback = await sharp(input)
    .resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 20, mozjpeg: true })
    .toBuffer();

  return { buffer: fallback, contentType: "image/jpeg" };
}

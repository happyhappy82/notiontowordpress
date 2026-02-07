import type { NotionBlock } from "../notion/blocks.js";
import { blocksToHtml } from "./blocks.js";

export function convertBlocksToHtml(
  blocks: NotionBlock[],
  imageUrlMap: Map<string, string>
): string {
  return blocksToHtml(blocks, imageUrlMap);
}

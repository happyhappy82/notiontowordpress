import { getNotionClient } from "./client.js";
import { delay } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

const NOTION_API_DELAY = 350; // ms between requests to respect rate limits

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
  children?: NotionBlock[];
}

export async function fetchAllBlocks(pageId: string): Promise<NotionBlock[]> {
  const blocks = await fetchBlockChildren(pageId);
  await fetchNestedChildren(blocks);
  return blocks;
}

async function fetchBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const notion = getNotionClient();
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    await delay(NOTION_API_DELAY);
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...(response.results as unknown as NotionBlock[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
}

async function fetchNestedChildren(blocks: NotionBlock[]): Promise<void> {
  for (const block of blocks) {
    if (block.has_children) {
      logger.debug("Fetching nested children", { blockId: block.id, type: block.type });
      block.children = await fetchBlockChildren(block.id);
      await fetchNestedChildren(block.children);
    }
  }
}

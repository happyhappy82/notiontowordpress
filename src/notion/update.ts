import { getNotionClient } from "./client.js";
import { logger } from "../utils/logger.js";

export async function updateWpPostId(pageId: string, wpPostId: number): Promise<void> {
  const notion = getNotionClient();

  logger.info("Updating Notion page with WP Post ID", { pageId, wpPostId });

  await notion.pages.update({
    page_id: pageId,
    properties: {
      "WP Post ID": {
        number: wpPostId,
      },
    },
  });

  logger.info("Successfully updated WP Post ID", { pageId, wpPostId });
}

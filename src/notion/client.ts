import { Client } from "@notionhq/client";

let notionClient: Client | null = null;

export function getNotionClient(): Client {
  if (!notionClient) {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) {
      throw new Error("NOTION_API_KEY environment variable is required");
    }
    notionClient = new Client({ auth: apiKey });
  }
  return notionClient;
}

export function getNotionBlogDbId(): string {
  const dbId = process.env.NOTION_BLOG_DB_ID;
  if (!dbId) {
    throw new Error("NOTION_BLOG_DB_ID environment variable is required");
  }
  return dbId;
}

import { getNotionClient, getNotionBlogDbId } from "./client.js";
import { logger } from "../utils/logger.js";

export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  cover: {
    type: string;
    file?: { url: string };
    external?: { url: string };
  } | null;
}

export function getPropertyValue(page: NotionPage, key: string): string {
  const prop = page.properties[key] as Record<string, unknown> | undefined;
  if (!prop) return "";

  const type = prop.type as string;

  if (type === "title") {
    const arr = prop.title as Array<{ plain_text: string }>;
    return arr?.map((t) => t.plain_text).join("") || "";
  }
  if (type === "rich_text") {
    const arr = prop.rich_text as Array<{ plain_text: string }>;
    return arr?.map((t) => t.plain_text).join("") || "";
  }
  if (type === "select") {
    const select = prop.select as { name: string } | null;
    return select?.name || "";
  }
  if (type === "date") {
    const date = prop.date as { start: string } | null;
    return date?.start || "";
  }
  if (type === "number") {
    return String(prop.number ?? "");
  }
  if (type === "checkbox") {
    return String(prop.checkbox ?? "false");
  }
  if (type === "status") {
    const status = prop.status as { name: string } | null;
    return status?.name || "";
  }
  if (type === "url") {
    return (prop.url as string) || "";
  }
  if (type === "files") {
    const files = prop.files as Array<{
      type: string;
      file?: { url: string };
      external?: { url: string };
    }>;
    if (files?.[0]) {
      return files[0].type === "file" ? files[0].file?.url || "" : files[0].external?.url || "";
    }
    return "";
  }

  return "";
}

export function getMultiSelectValues(page: NotionPage, key: string): string[] {
  const prop = page.properties[key] as Record<string, unknown> | undefined;
  if (!prop || prop.type !== "multi_select") return [];
  const multiSelect = prop.multi_select as Array<{ name: string }>;
  return multiSelect?.map((s) => s.name) || [];
}

export function getCoverImage(page: NotionPage): string {
  if (!page.cover) return "";
  return page.cover.type === "file"
    ? page.cover.file?.url || ""
    : page.cover.external?.url || "";
}

export async function queryPublishablePages(): Promise<NotionPage[]> {
  const notion = getNotionClient();
  const dbId = getNotionBlogDbId();

  logger.info("Querying Notion DB for publishable pages", { dbId });

  const response = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        {
          property: "Status",
          status: { equals: "Published" },
        },
        {
          property: "WP Post ID",
          number: { is_empty: true },
        },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
  });

  const pages = response.results as unknown as NotionPage[];
  logger.info(`Found ${pages.length} pages to publish`);
  return pages;
}

export async function queryScheduledPages(): Promise<NotionPage[]> {
  const notion = getNotionClient();
  const dbId = getNotionBlogDbId();
  const today = new Date().toISOString().split("T")[0];

  logger.info("Querying Notion DB for scheduled pages", { dbId, today });

  const response = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        {
          property: "Status",
          status: { equals: "Published" },
        },
        {
          property: "WP Post ID",
          number: { is_empty: true },
        },
        {
          property: "Date",
          date: { on_or_before: today },
        },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
    page_size: 1,
  });

  const pages = response.results as unknown as NotionPage[];
  logger.info(`Found ${pages.length} scheduled pages`);
  return pages;
}

export async function fetchPageById(pageId: string): Promise<NotionPage> {
  const notion = getNotionClient();
  logger.info("Fetching Notion page", { pageId });
  const page = await notion.pages.retrieve({ page_id: pageId });
  return page as unknown as NotionPage;
}

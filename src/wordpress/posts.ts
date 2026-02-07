import { wpFetch } from "./client.js";
import { logger } from "../utils/logger.js";

export interface CreatePostParams {
  title: string;
  slug?: string;
  content: string;
  status?: "publish" | "draft" | "pending";
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  excerpt?: string;
  date?: string;
  meta?: Record<string, string>;
}

export interface WpPost {
  id: number;
  link: string;
}

export async function createPost(params: CreatePostParams): Promise<WpPost> {
  logger.info("Creating WP post", { title: params.title });

  const body: Record<string, unknown> = {
    title: params.title,
    content: params.content,
    status: params.status || "publish",
  };

  if (params.slug) body.slug = params.slug;
  if (params.categories?.length) body.categories = params.categories;
  if (params.tags?.length) body.tags = params.tags;
  if (params.featured_media) body.featured_media = params.featured_media;
  if (params.excerpt) body.excerpt = params.excerpt;
  if (params.date) body.date = params.date;
  if (params.meta) body.meta = params.meta;

  const result = await wpFetch<WpPost>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  logger.info("WP post created", { id: result.id, link: result.link });
  return result;
}

export async function findPostByPageId(notionPageId: string): Promise<WpPost | null> {
  logger.info("Searching WP post by Notion page ID", { notionPageId });

  const results = await wpFetch<WpPost[]>(
    `/posts?notion_page_id=${encodeURIComponent(notionPageId)}&per_page=1`
  );

  return results.length > 0 ? results[0] : null;
}

export async function updatePost(wpPostId: number, params: CreatePostParams): Promise<WpPost> {
  logger.info("Updating WP post", { wpPostId, title: params.title });

  const body: Record<string, unknown> = {
    title: params.title,
    content: params.content,
    status: params.status || "publish",
  };

  if (params.categories?.length) body.categories = params.categories;
  if (params.tags?.length) body.tags = params.tags;
  if (params.featured_media) body.featured_media = params.featured_media;
  if (params.excerpt) body.excerpt = params.excerpt;
  if (params.date) body.date = params.date;
  if (params.meta) body.meta = params.meta;

  const result = await wpFetch<WpPost>(`/posts/${wpPostId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  logger.info("WP post updated", { id: result.id, link: result.link });
  return result;
}

export async function deletePost(wpPostId: number): Promise<void> {
  logger.info("Deleting WP post", { wpPostId });

  await wpFetch<unknown>(`/posts/${wpPostId}`, {
    method: "DELETE",
  });

  logger.info("WP post deleted", { wpPostId });
}

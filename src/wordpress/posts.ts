import { wpFetch } from "./client.js";
import { logger } from "../utils/logger.js";

export interface CreatePostParams {
  title: string;
  content: string;
  status?: "publish" | "draft" | "pending";
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  excerpt?: string;
  date?: string;
}

interface WpPost {
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

  if (params.categories?.length) body.categories = params.categories;
  if (params.tags?.length) body.tags = params.tags;
  if (params.featured_media) body.featured_media = params.featured_media;
  if (params.excerpt) body.excerpt = params.excerpt;
  if (params.date) body.date = params.date;

  const result = await wpFetch<WpPost>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  logger.info("WP post created", { id: result.id, link: result.link });
  return result;
}

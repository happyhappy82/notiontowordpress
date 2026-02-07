import { wpFetch } from "./client.js";
import { logger } from "../utils/logger.js";

interface WpTerm {
  id: number;
  name: string;
  slug: string;
}

// 기존 WP 카테고리 매핑
const CATEGORY_MAP: Record<string, number> = {
  "교육사례": 1,
  "블로그": 11,
};

const tagCache = new Map<string, number>();
const categoryCache = new Map<string, number>();

export async function resolveCategory(name: string): Promise<number> {
  // Check known mapping first
  if (CATEGORY_MAP[name]) {
    return CATEGORY_MAP[name];
  }

  // Check cache
  if (categoryCache.has(name)) {
    return categoryCache.get(name)!;
  }

  // Search existing categories
  const existing = await wpFetch<WpTerm[]>(
    `/categories?search=${encodeURIComponent(name)}&per_page=10`
  );

  const match = existing.find(
    (c) => c.name === name || c.name.toLowerCase() === name.toLowerCase()
  );
  if (match) {
    categoryCache.set(name, match.id);
    return match.id;
  }

  // Create new category
  logger.info("Creating new WP category", { name });
  const created = await wpFetch<WpTerm>("/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  categoryCache.set(name, created.id);
  return created.id;
}

export async function resolveTag(name: string): Promise<number> {
  if (tagCache.has(name)) {
    return tagCache.get(name)!;
  }

  // Search existing tags
  const existing = await wpFetch<WpTerm[]>(
    `/tags?search=${encodeURIComponent(name)}&per_page=10`
  );

  const match = existing.find(
    (t) => t.name === name || t.name.toLowerCase() === name.toLowerCase()
  );
  if (match) {
    tagCache.set(name, match.id);
    return match.id;
  }

  // Create new tag
  logger.info("Creating new WP tag", { name });
  const created = await wpFetch<WpTerm>("/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  tagCache.set(name, created.id);
  return created.id;
}

export async function resolveTags(names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    ids.push(await resolveTag(name));
  }
  return ids;
}

export async function resolveCategoryFromTags(tags: string[]): Promise<number> {
  if (tags.length === 0) {
    // Default to 블로그
    return CATEGORY_MAP["블로그"] || 11;
  }

  const firstTag = tags[0];
  return resolveCategory(firstTag);
}

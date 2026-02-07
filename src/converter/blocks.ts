import type { NotionBlock } from "../notion/blocks.js";
import { richTextToHtml, type RichTextItem } from "./rich-text.js";
import { STYLES } from "./styles.js";

type ImageUrlMap = Map<string, string>;

function getRichText(block: NotionBlock): RichTextItem[] {
  const data = block[block.type] as Record<string, unknown> | undefined;
  return (data?.rich_text as RichTextItem[]) || [];
}

function getCaption(block: NotionBlock): RichTextItem[] {
  const data = block[block.type] as Record<string, unknown> | undefined;
  return (data?.caption as RichTextItem[]) || [];
}

function convertParagraph(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const html = richTextToHtml(getRichText(block));
  const children = convertChildren(block, imageUrlMap);
  if (!html && !children) return "";
  return `<p>${html}</p>${children}`;
}

function convertHeading(block: NotionBlock, level: 1 | 2 | 3): string {
  // h1 → h2, h2 → h3 (h1은 포스트 제목이므로 본문은 h2부터)
  const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
  const html = richTextToHtml(getRichText(block));
  return `<${tag}>${html}</${tag}>`;
}

function convertBulletedList(blocks: NotionBlock[], imageUrlMap: ImageUrlMap): string {
  const items = blocks.map((block) => {
    const html = richTextToHtml(getRichText(block));
    const children = convertChildren(block, imageUrlMap);
    return `<li>${html}${children}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

function convertNumberedList(blocks: NotionBlock[], imageUrlMap: ImageUrlMap): string {
  const items = blocks.map((block) => {
    const html = richTextToHtml(getRichText(block));
    const children = convertChildren(block, imageUrlMap);
    return `<li>${html}${children}</li>`;
  });
  return `<ol>${items.join("")}</ol>`;
}

function convertTodoList(blocks: NotionBlock[], imageUrlMap: ImageUrlMap): string {
  const items = blocks.map((block) => {
    const data = block.to_do as { checked?: boolean } | undefined;
    const checked = data?.checked ? "checked" : "";
    const html = richTextToHtml(getRichText(block));
    const children = convertChildren(block, imageUrlMap);
    return `<li><input type="checkbox" ${checked} disabled /> ${html}${children}</li>`;
  });
  return `<ul style="list-style:none;padding-left:0;">${items.join("")}</ul>`;
}

function convertImage(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const data = block.image as {
    type: string;
    file?: { url: string };
    external?: { url: string };
    caption?: RichTextItem[];
  } | undefined;

  if (!data) return "";

  const originalUrl = data.type === "file" ? data.file?.url || "" : data.external?.url || "";
  const url = imageUrlMap.get(originalUrl) || originalUrl;
  const caption = data.caption ? richTextToHtml(data.caption) : "";
  const captionHtml = caption
    ? `<figcaption style="text-align:center;color:#666;font-size:0.9em;margin-top:0.5rem;">${caption}</figcaption>`
    : "";

  return `<figure ${STYLES.image.wrapper}><img src="${url}" alt="${caption || ""}" ${STYLES.image.img} />${captionHtml}</figure>`;
}

function convertCode(block: NotionBlock): string {
  const data = block.code as { language?: string; rich_text?: RichTextItem[] } | undefined;
  if (!data) return "";

  const text = data.rich_text?.map((rt) => rt.plain_text).join("") || "";
  const lang = data.language || "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<pre ${STYLES.code.pre}><code class="language-${lang}">${escaped}</code></pre>`;
}

function convertQuote(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const html = richTextToHtml(getRichText(block));
  const children = convertChildren(block, imageUrlMap);
  return `<blockquote ${STYLES.quote.wrapper}>${html}${children}</blockquote>`;
}

function convertCallout(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const data = block.callout as { icon?: { type: string; emoji?: string } } | undefined;
  const icon = data?.icon?.type === "emoji" ? data.icon.emoji || "" : "";
  const html = richTextToHtml(getRichText(block));
  const children = convertChildren(block, imageUrlMap);

  return `<div ${STYLES.callout.wrapper}><span ${STYLES.callout.icon}>${icon}</span><span ${STYLES.callout.content}>${html}</span>${children}</div>`;
}

function convertTable(block: NotionBlock): string {
  const data = block.table as { has_column_header?: boolean; has_row_header?: boolean } | undefined;
  const hasColumnHeader = data?.has_column_header ?? false;
  const rows = block.children || [];

  const rowsHtml = rows.map((row, rowIdx) => {
    const cells = (row.table_row as { cells?: RichTextItem[][] })?.cells || [];
    const isHeader = hasColumnHeader && rowIdx === 0;
    const rowStyle = isHeader ? ` ${STYLES.table.headerRow}` : "";
    const cellTag = isHeader ? "th" : "td";
    const cellStyle = isHeader ? STYLES.table.headerCell : STYLES.table.cell;

    const cellsHtml = cells
      .map((cell) => `<${cellTag} ${cellStyle}>${richTextToHtml(cell)}</${cellTag}>`)
      .join("");

    return `<tr${rowStyle}>${cellsHtml}</tr>`;
  });

  return `<table ${STYLES.table.table}><tbody>${rowsHtml.join("")}</tbody></table>`;
}

function convertToggle(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const html = richTextToHtml(getRichText(block));
  const children = convertChildren(block, imageUrlMap);
  return `<details ${STYLES.toggle.details}><summary ${STYLES.toggle.summary}>${html}</summary><div ${STYLES.toggle.content}>${children}</div></details>`;
}

function convertDivider(): string {
  return `<hr ${STYLES.divider.hr} />`;
}

function convertBookmark(block: NotionBlock): string {
  const data = block.bookmark as { url?: string; caption?: RichTextItem[] } | undefined;
  if (!data?.url) return "";

  const caption = data.caption ? richTextToHtml(data.caption) : data.url;
  return `<div ${STYLES.bookmark.wrapper}><a href="${data.url}" ${STYLES.bookmark.link} target="_blank" rel="noopener noreferrer">${caption || data.url}</a></div>`;
}

function convertEmbed(block: NotionBlock): string {
  const data = block.embed as { url?: string } | undefined;
  if (!data?.url) return "";

  // YouTube embed
  const youtubeMatch = data.url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (youtubeMatch) {
    return `<div ${STYLES.video.wrapper}><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" ${STYLES.video.iframe}></iframe></div>`;
  }

  return `<div ${STYLES.bookmark.wrapper}><a href="${data.url}" ${STYLES.bookmark.link} target="_blank" rel="noopener noreferrer">${data.url}</a></div>`;
}

function convertVideo(block: NotionBlock): string {
  const data = block.video as {
    type: string;
    file?: { url: string };
    external?: { url: string };
  } | undefined;

  if (!data) return "";

  const url = data.type === "file" ? data.file?.url || "" : data.external?.url || "";

  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  if (youtubeMatch) {
    return `<div ${STYLES.video.wrapper}><iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" ${STYLES.video.iframe}></iframe></div>`;
  }

  return `<video controls style="max-width:100%;margin:1rem auto;display:block;"><source src="${url}" /></video>`;
}

function convertColumnList(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  const columns = block.children || [];
  const count = columns.length;
  const width = Math.floor(100 / count);

  const colsHtml = columns
    .map((col) => {
      const children = convertChildren(col, imageUrlMap);
      return `<div style="flex:1;min-width:0;padding:0 8px;">${children}</div>`;
    })
    .join("");

  return `<div style="display:flex;gap:16px;margin:1rem 0;">${colsHtml}</div>`;
}

function convertChildren(block: NotionBlock, imageUrlMap: ImageUrlMap): string {
  if (!block.children || block.children.length === 0) return "";
  return blocksToHtml(block.children, imageUrlMap);
}

export function blocksToHtml(blocks: NotionBlock[], imageUrlMap: ImageUrlMap): string {
  const parts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Group consecutive list items
    if (block.type === "bulleted_list_item") {
      const listBlocks: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "bulleted_list_item") {
        listBlocks.push(blocks[i]);
        i++;
      }
      parts.push(convertBulletedList(listBlocks, imageUrlMap));
      continue;
    }

    if (block.type === "numbered_list_item") {
      const listBlocks: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "numbered_list_item") {
        listBlocks.push(blocks[i]);
        i++;
      }
      parts.push(convertNumberedList(listBlocks, imageUrlMap));
      continue;
    }

    if (block.type === "to_do") {
      const listBlocks: NotionBlock[] = [];
      while (i < blocks.length && blocks[i].type === "to_do") {
        listBlocks.push(blocks[i]);
        i++;
      }
      parts.push(convertTodoList(listBlocks, imageUrlMap));
      continue;
    }

    // Single blocks
    switch (block.type) {
      case "paragraph":
        parts.push(convertParagraph(block, imageUrlMap));
        break;
      case "heading_1":
        parts.push(convertHeading(block, 1));
        break;
      case "heading_2":
        parts.push(convertHeading(block, 2));
        break;
      case "heading_3":
        parts.push(convertHeading(block, 3));
        break;
      case "image":
        parts.push(convertImage(block, imageUrlMap));
        break;
      case "code":
        parts.push(convertCode(block));
        break;
      case "quote":
        parts.push(convertQuote(block, imageUrlMap));
        break;
      case "callout":
        parts.push(convertCallout(block, imageUrlMap));
        break;
      case "table":
        parts.push(convertTable(block));
        break;
      case "toggle":
        parts.push(convertToggle(block, imageUrlMap));
        break;
      case "divider":
        parts.push(convertDivider());
        break;
      case "bookmark":
        parts.push(convertBookmark(block));
        break;
      case "embed":
        parts.push(convertEmbed(block));
        break;
      case "video":
        parts.push(convertVideo(block));
        break;
      case "column_list":
        parts.push(convertColumnList(block, imageUrlMap));
        break;
      case "column":
        // columns are handled by column_list
        break;
      case "table_of_contents":
      case "breadcrumb":
      case "child_page":
      case "child_database":
      case "unsupported":
        // Skip these block types
        break;
      default:
        // Try to extract rich_text for unknown block types
        const rt = getRichText(block);
        if (rt.length > 0) {
          parts.push(`<p>${richTextToHtml(rt)}</p>`);
        }
        break;
    }
    i++;
  }

  return parts.filter(Boolean).join("\n");
}

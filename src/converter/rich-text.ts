export interface RichTextItem {
  type: string;
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colorToStyle(color: string): string {
  if (color === "default") return "";

  const colorMap: Record<string, string> = {
    gray: "color:#9b9a97",
    brown: "color:#64473a",
    orange: "color:#d9730d",
    yellow: "color:#dfab01",
    green: "color:#0f7b6c",
    blue: "color:#0b6e99",
    purple: "color:#6940a5",
    pink: "color:#ad1a72",
    red: "color:#e03e3e",
    gray_background: "background-color:#ebeced",
    brown_background: "background-color:#e9e5e3",
    orange_background: "background-color:#faebdd",
    yellow_background: "background-color:#fbf3db",
    green_background: "background-color:#ddedea",
    blue_background: "background-color:#ddebf1",
    purple_background: "background-color:#eae4f2",
    pink_background: "background-color:#f4dfeb",
    red_background: "background-color:#fbe4e4",
  };

  return colorMap[color] || "";
}

export function richTextToHtml(richTexts: RichTextItem[]): string {
  if (!richTexts || richTexts.length === 0) return "";

  return richTexts
    .map((rt) => {
      let html = escapeHtml(rt.plain_text);

      if (rt.annotations) {
        if (rt.annotations.code) {
          html = `<code style="background-color:#f0f0f0;padding:2px 4px;border-radius:3px;font-family:monospace;">${html}</code>`;
        }
        if (rt.annotations.bold) {
          html = `<strong>${html}</strong>`;
        }
        if (rt.annotations.italic) {
          html = `<em>${html}</em>`;
        }
        if (rt.annotations.strikethrough) {
          html = `<s>${html}</s>`;
        }
        if (rt.annotations.underline) {
          html = `<u>${html}</u>`;
        }

        const colorStyle = colorToStyle(rt.annotations.color);
        if (colorStyle) {
          html = `<span style="${colorStyle}">${html}</span>`;
        }
      }

      const href = rt.href || rt.text?.link?.url;
      if (href) {
        html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      }

      return html;
    })
    .join("");
}

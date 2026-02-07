import type { NotionBlock } from "../notion/blocks.js";
import { blocksToHtml } from "./blocks.js";

export interface FaqItem {
  question: string;
  answer: string;
}

export function convertBlocksToHtml(
  blocks: NotionBlock[],
  imageUrlMap: Map<string, string>
): string {
  return blocksToHtml(blocks, imageUrlMap);
}

export function extractPlainText(blocks: NotionBlock[], maxLength = 160): string {
  const texts: string[] = [];

  for (const block of blocks) {
    if (texts.join(" ").length >= maxLength) break;

    const data = block[block.type] as Record<string, unknown> | undefined;
    const richText = data?.rich_text as Array<{ plain_text: string }> | undefined;
    if (richText?.length) {
      texts.push(richText.map((rt) => rt.plain_text).join(""));
    }
  }

  const full = texts.join(" ").replace(/\s+/g, " ").trim();
  return full.length > maxLength ? full.substring(0, maxLength) + "..." : full;
}

function getBlockPlainText(block: NotionBlock): string {
  const data = block[block.type] as Record<string, unknown> | undefined;
  const richText = data?.rich_text as Array<{ plain_text: string }> | undefined;
  return richText?.map((rt) => rt.plain_text).join("") || "";
}

export function extractFaqItems(blocks: NotionBlock[]): FaqItem[] {
  const items: FaqItem[] = [];

  // FAQ 섹션 헤딩 찾기
  let faqStartIndex = -1;
  let faqHeadingType = "";

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type.startsWith("heading_")) {
      const text = getBlockPlainText(block);
      if (/자주\s*묻는\s*질문|FAQ|Q\s*&\s*A/i.test(text)) {
        faqStartIndex = i + 1;
        faqHeadingType = block.type;
        break;
      }
    }
  }

  if (faqStartIndex === -1) return items;

  // 질문 헤딩은 FAQ 헤딩보다 한 단계 아래
  const faqLevel = parseInt(faqHeadingType.replace("heading_", ""));
  const questionType = `heading_${Math.min(faqLevel + 1, 3)}`;

  let currentQuestion = "";
  let answerParts: string[] = [];

  for (let i = faqStartIndex; i < blocks.length; i++) {
    const block = blocks[i];

    // 같은 레벨 이상의 헤딩을 만나면 FAQ 섹션 종료
    if (block.type.startsWith("heading_")) {
      const blockLevel = parseInt(block.type.replace("heading_", ""));
      if (blockLevel <= faqLevel) break;
    }

    if (block.type === questionType) {
      // 이전 Q&A 저장
      if (currentQuestion && answerParts.length > 0) {
        items.push({
          question: currentQuestion.replace(/^Q\d+[\.\s:)\-]+\s*/i, ""),
          answer: answerParts.join(" ").trim(),
        });
      }
      currentQuestion = getBlockPlainText(block);
      answerParts = [];
    } else if (currentQuestion) {
      const text = getBlockPlainText(block);
      if (text) answerParts.push(text);
    }
  }

  // 마지막 Q&A 저장
  if (currentQuestion && answerParts.length > 0) {
    items.push({
      question: currentQuestion.replace(/^Q\d+[\.\s:)\-]+\s*/i, ""),
      answer: answerParts.join(" ").trim(),
    });
  }

  return items;
}

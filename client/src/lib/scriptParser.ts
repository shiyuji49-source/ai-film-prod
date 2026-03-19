// Script format parser — supports .txt, .md, .fountain, .docx, .pdf
// DESIGN: "鎏光机" 导演手册工业风暗色系

export type SupportedFormat = "txt" | "md" | "fountain" | "docx" | "pdf";

export function detectFormat(file: File): SupportedFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith(".fountain") || name.endsWith(".fdx")) return "fountain";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  return "txt";
}

/** Extract plain text from a .fountain file */
function parseFountain(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip forced action lines starting with !
    if (trimmed.startsWith("!")) { result.push(trimmed.slice(1)); continue; }
    // Skip title page key: value pairs
    if (/^[A-Za-z ]+:/.test(trimmed) && result.length === 0) continue;
    // Scene headings (INT./EXT.) → keep as episode markers hint
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
      result.push(trimmed);
      continue;
    }
    // Character cues (ALL CAPS lines) → convert to dialogue format
    if (/^[A-Z\u4e00-\u9fa5][A-Z\u4e00-\u9fa5\s]{1,20}$/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      result.push(`${trimmed}：`);
      continue;
    }
    // Parentheticals → skip
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) continue;
    // Transitions → skip
    if (trimmed.endsWith("TO:") || trimmed === "FADE IN:" || trimmed === "FADE OUT.") continue;
    result.push(trimmed);
  }
  return result.filter(Boolean).join("\n");
}

/** Parse .md — strip markdown syntax, keep content */
function parseMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")       // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // bold
    .replace(/\*([^*]+)\*/g, "$1")      // italic
    .replace(/`[^`]+`/g, "")            // inline code
    .replace(/```[\s\S]*?```/g, "")     // code blocks
    .replace(/!\[.*?\]\(.*?\)/g, "")    // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^[-*+]\s+/gm, "")         // list items
    .replace(/^\d+\.\s+/gm, "")         // ordered list
    .replace(/^>\s+/gm, "")             // blockquotes
    .replace(/^---+$/gm, "")            // hr
    .trim();
}

/** Extract text from .docx using mammoth */
async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Extract text from .pdf using pdfjs-dist */
async function parsePdf(file: File): Promise<string> {
  // Dynamically import to avoid SSR issues
  const pdfjsLib = await import("pdfjs-dist");
  // Use the legacy build worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        const i = item as { str?: string };
        return i.str ?? "";
      })
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n");
}

/** Main entry: read a File and return plain text */
export async function extractTextFromFile(file: File): Promise<string> {
  const format = detectFormat(file);

  if (format === "docx") {
    return parseDocx(file);
  }

  if (format === "pdf") {
    return parsePdf(file);
  }

  // txt, md, fountain — read as text
  const raw = await file.text();

  if (format === "fountain") return parseFountain(raw);
  if (format === "md") return parseMarkdown(raw);
  return raw; // txt
}

/** Format display name */
export function formatLabel(format: SupportedFormat): string {
  const map: Record<SupportedFormat, string> = {
    txt: "纯文本 (.txt)",
    md: "Markdown (.md)",
    fountain: "Fountain 剧本 (.fountain)",
    docx: "Word 文档 (.docx)",
    pdf: "PDF 文档 (.pdf)",
  };
  return map[format];
}

export const ACCEPTED_FORMATS = ".txt,.md,.markdown,.fountain,.fdx,.docx,.pdf";

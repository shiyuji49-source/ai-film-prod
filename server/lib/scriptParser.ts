/**
 * Script File Parser — supports .xlsx, .docx, .txt
 * Parses uploaded script files into episode-separated text blocks
 * for batch import into the overseas workflow.
 */

import * as XLSX from "xlsx";
import mammoth from "mammoth";

export interface ParsedEpisode {
  episodeNumber: number;
  scriptText: string;
  charCount: number;
}

// ─── Episode marker regex ────────────────────────────────────────────────────
// Matches: 第1集, 第 1 集, Episode 1, EP 1, EP1, # 第1集, ## Episode 1, etc.
const EPISODE_REGEX = /^(?:#{1,3}\s*)?(?:第\s*(\d+)\s*集|Episode\s*(\d+)|EP\s*(\d+))/i;

function extractEpisodeNumber(line: string): number | null {
  const m = line.match(EPISODE_REGEX);
  if (!m) return null;
  return parseInt(m[1] || m[2] || m[3]);
}

/**
 * Split plain text into episodes by episode markers.
 * If no markers found, treat entire text as episode 1.
 */
function splitTextByEpisodes(text: string): ParsedEpisode[] {
  const lines = text.split(/\r?\n/);
  const episodes: ParsedEpisode[] = [];
  let currentEp = -1;
  let currentLines: string[] = [];

  for (const line of lines) {
    const epNum = extractEpisodeNumber(line.trim());
    if (epNum !== null) {
      // Save previous episode
      if (currentEp > 0 && currentLines.length > 0) {
        const scriptText = currentLines.join("\n").trim();
        if (scriptText) {
          episodes.push({ episodeNumber: currentEp, scriptText, charCount: scriptText.length });
        }
      }
      currentEp = epNum;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  // Save last episode
  if (currentEp > 0 && currentLines.length > 0) {
    const scriptText = currentLines.join("\n").trim();
    if (scriptText) {
      episodes.push({ episodeNumber: currentEp, scriptText, charCount: scriptText.length });
    }
  }

  // If no episode markers found, treat entire text as episode 1
  if (episodes.length === 0 && text.trim()) {
    const trimmed = text.trim();
    episodes.push({ episodeNumber: 1, scriptText: trimmed, charCount: trimmed.length });
  }

  return episodes;
}

// ─── Excel (.xlsx / .xls) ────────────────────────────────────────────────────

function parseExcel(buffer: Buffer): ParsedEpisode[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;

  // Strategy 1: If multiple sheets and sheet names look like episode names
  // e.g., "第1集", "EP1", "Episode 1", "1", etc.
  if (sheetNames.length > 1) {
    const sheetEpisodes = tryParseSheetPerEpisode(workbook, sheetNames);
    if (sheetEpisodes.length > 0) return sheetEpisodes;
  }

  // Strategy 2: Single sheet — read all cells as text and split by episode markers
  const allText = sheetsToText(workbook, sheetNames);
  return splitTextByEpisodes(allText);
}

function tryParseSheetPerEpisode(workbook: XLSX.WorkBook, sheetNames: string[]): ParsedEpisode[] {
  const episodes: ParsedEpisode[] = [];

  for (const name of sheetNames) {
    // Try to extract episode number from sheet name
    let epNum: number | null = null;
    const m1 = name.match(/^(?:第\s*)?(\d+)(?:\s*集)?$/);
    const m2 = name.match(/^(?:EP|Episode)\s*(\d+)$/i);
    if (m1) epNum = parseInt(m1[1]);
    else if (m2) epNum = parseInt(m2[1]);

    if (epNum !== null && epNum > 0) {
      const text = sheetToText(workbook, name);
      if (text.trim()) {
        episodes.push({ episodeNumber: epNum, scriptText: text.trim(), charCount: text.trim().length });
      }
    }
  }

  return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

function sheetToText(workbook: XLSX.WorkBook, sheetName: string): string {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return "";

  // Convert sheet to array of arrays
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const lines: string[] = [];

  for (const row of rows) {
    // Join all cells in the row, filtering empty ones
    const cells = row.map(c => String(c ?? "").trim()).filter(Boolean);
    if (cells.length > 0) {
      lines.push(cells.join(" | "));
    }
  }

  return lines.join("\n");
}

function sheetsToText(workbook: XLSX.WorkBook, sheetNames: string[]): string {
  const parts: string[] = [];
  for (const name of sheetNames) {
    const text = sheetToText(workbook, name);
    if (text.trim()) {
      parts.push(text);
    }
  }
  return parts.join("\n\n");
}

// ─── Word (.docx) ────────────────────────────────────────────────────────────

async function parseDocx(buffer: Buffer): Promise<ParsedEpisode[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  return splitTextByEpisodes(text);
}

// ─── TXT ─────────────────────────────────────────────────────────────────────

function parseTxt(buffer: Buffer): ParsedEpisode[] {
  const text = buffer.toString("utf-8");
  return splitTextByEpisodes(text);
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function parseScriptFile(
  buffer: Buffer,
  ext: string,
  _filename: string
): Promise<ParsedEpisode[]> {
  switch (ext) {
    case "xlsx":
    case "xls":
      return parseExcel(buffer);
    case "docx":
    case "doc":
      return await parseDocx(buffer);
    case "txt":
      return parseTxt(buffer);
    default:
      throw new Error(`不支持的文件格式: .${ext}`);
  }
}

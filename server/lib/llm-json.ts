function stripCodeFences(value: string) {
  return value
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function findJsonEnd(value: string, start: number) {
  const opener = value[start];
  const closer = opener === "{" ? "}" : "]";
  const stack = [closer];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < value.length; index++) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{" || char === "[") {
      stack.push(char === "{" ? "}" : "]");
      continue;
    }
    if (char === "}" || char === "]") {
      if (stack.pop() !== char) return -1;
      if (stack.length === 0) return index + 1;
    }
  }
  return -1;
}

function extractJsonCandidate(value: string) {
  const cleaned = stripCodeFences(value);
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (!starts.length) return cleaned;
  const start = Math.min(...starts);
  const end = findJsonEnd(cleaned, start);
  return end > start ? cleaned.slice(start, end).trim() : cleaned.slice(start).trim();
}

export function parseLlmJson<T>(raw: string, label = "AI 返回内容"): T {
  const candidates = [
    raw,
    stripCodeFences(raw),
    extractJsonCandidate(raw),
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "未知 JSON 解析错误";
  throw new Error(`${label}解析失败：AI 返回的 JSON 不完整或格式不合法。请重试，或先缩短输入文本。原始原因：${message}`);
}

import { ENV } from "../_core/env";

export interface LQChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LQChatCompletionOptions {
  model?: string;
  messages: LQChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: string; json_schema?: any };
}

function getBaseUrl() {
  return (ENV.lqApiUrl || "https://lqapi.top/v1").replace(/\/+$/, "");
}

function getApiKey() {
  if (!ENV.lqApiKey) {
    throw new Error("LQ_API_KEY is not configured");
  }
  return ENV.lqApiKey;
}

function normalizeChatModel(model?: string) {
  if (!model || model === "claude-sonnet-4-6") return "anthropic/claude-sonnet-4-6";
  if (model === "claude-opus-4-6") return "anthropic/claude-opus-4-6";
  return model.includes("/") ? model : `anthropic/${model}`;
}

function withEphemeralCache(content: string) {
  return [{ type: "text", text: content, cache_control: { type: "ephemeral" } }];
}

function stripMarkdownFence(value: string) {
  return value.replace(/^```[\w]*\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
}

export async function callLQChat(options: LQChatCompletionOptions): Promise<string> {
  const {
    model,
    messages,
    max_tokens = 8192,
    temperature = 0.7,
    response_format,
  } = options;
  const payload: any = {
    model: normalizeChatModel(model),
    messages: messages.map((message) => ({
      role: message.role,
      content: withEphemeralCache(message.content),
    })),
    stream: false,
    temperature,
    max_tokens,
    metadata: { user_id: ENV.lqUserId || "liuguang_internal" },
  };
  if (response_format) payload.response_format = response_format;

  let data: any;
  const result = await postChatPayloadJson(payload, 180000);
  if (!result.ok && response_format) {
    const retryPayload = { ...payload };
    delete retryPayload.response_format;
    const retryResult = await postChatPayloadJson(retryPayload, 180000);
    if (!retryResult.ok) {
      throw new Error(`LQ LLM API error (${retryResult.status}): ${result.text}；retry without response_format: ${retryResult.text}`);
    }
    data = retryResult.data;
  } else if (!result.ok) {
    throw new Error(`LQ LLM API error (${result.status}): ${result.text}`);
  } else {
    data = result.data;
  }
  const content = normalizeMessageContent(data?.choices?.[0]?.message?.content);
  if (!content) throw new Error("LQ LLM API returned empty content");
  return stripMarkdownFence(content);
}

function postLQPayload(path: string, payload: any, timeoutMs: number) {
  return fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function postChatPayload(payload: any, timeoutMs: number) {
  return postLQPayload("/chat/completions", payload, timeoutMs);
}

async function postLQPayloadJson(
  path: string,
  payload: any,
  timeoutMs: number
): Promise<{ ok: true; data: any } | { ok: false; status: number; text: string }> {
  const maxRetries = 6;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await postLQPayload(path, payload, timeoutMs);
    if (res.ok) return { ok: true, data: await res.json() };

    const text = await res.text();
    if (shouldRetry(res.status, text) && attempt < maxRetries - 1) {
      const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
      console.warn(`[LQ] transient error ${res.status} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }
    return { ok: false, status: res.status, text };
  }

  return { ok: false, status: 0, text: "request failed after max retries" };
}

function postChatPayloadJson(payload: any, timeoutMs: number) {
  return postLQPayloadJson("/chat/completions", payload, timeoutMs);
}

function shouldRetry(status: number, text: string) {
  const lowered = text.toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lowered.includes("rate") ||
    lowered.includes("too many") ||
    lowered.includes("timeout")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMessageContent(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof content?.text === "string") return content.text;
  return "";
}

export async function generateLQImage2(options: {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
  timeoutMs?: number;
}): Promise<string> {
  const sizeByRatio: Record<string, string> = {
    "16:9": "1536x1024",
    "9:16": "1024x1536",
    "1:1": "1024x1024",
    "3:4": "1024x1536",
    "4:3": "1536x1024",
  };
  const preferredSize = sizeByRatio[options.aspectRatio ?? "9:16"] ?? "1024x1024";
  const buildChatBody = (size: string, content: any, withPrompt = true) => ({
    model: "openai/gpt-image-2",
    messages: [{ role: "user", content }],
    ...(withPrompt ? { prompt: options.prompt } : {}),
    size,
    stream: false,
  });
  const buildImageBody = (size: string, model: string) => ({
    model,
    prompt: options.prompt,
    size,
  });
  const requestBodies: Array<{ path: string; label: string; body: any }> = [
    { path: "/chat/completions", label: "chat_messages_string", body: buildChatBody(preferredSize, options.prompt) },
    { path: "/chat/completions", label: "chat_messages_string_square", body: buildChatBody("1024x1024", options.prompt) },
    { path: "/chat/completions", label: "chat_messages_parts", body: buildChatBody(preferredSize, withEphemeralCache(options.prompt)) },
    { path: "/chat/completions", label: "chat_messages_only", body: buildChatBody("1024x1024", options.prompt, false) },
    { path: "/chat/completions", label: "chat_prompt_only", body: { model: "openai/gpt-image-2", prompt: options.prompt, size: "1024x1024", stream: false } },
    { path: "/images/generations", label: "images_openai_prefixed", body: buildImageBody("1024x1024", "openai/gpt-image-2") },
    { path: "/images/generations", label: "images_gpt_image_2", body: buildImageBody("1024x1024", "gpt-image-2") },
  ];

  const errors: string[] = [];
  for (const request of requestBodies) {
    const result = await postLQPayloadJson(request.path, request.body, options.timeoutMs ?? 180000);
    if (!result.ok) {
      errors.push(`${request.label}: ${result.text}`);
      continue;
    }

    const imageUrl = extractImageUrl(result.data);
    if (imageUrl) return imageUrl;
    errors.push(`${request.label}: ${JSON.stringify(result.data).slice(0, 1000)}`);
  }

  throw new Error(`LQ image2 API error: ${summarizeLQImageErrors(errors)}`);
}

function summarizeLQImageErrors(errors: string[]) {
  const joined = errors.join(" | ");
  if (joined.includes("No available channels") || joined.includes("无可用渠道") || joined.includes("模型渠道")) {
    return "openai/gpt-image-2 模型渠道不可用或账号未开通。请在 LQ 后台确认该模型可用。";
  }
  if (joined.includes("缺少 messages") || joined.includes("missing messages")) {
    return "LQ 网关仍提示缺少 messages。请确认服务器已部署最新代码；如仍存在，需要 LQ 提供 image2 的 Node/cURL 精确请求格式。";
  }
  return joined.slice(0, 1800) || "no image returned";
}

function extractImageUrl(data: any): string {
  const contentParts = data?.choices?.[0]?.message?.content;
  const content = normalizeMessageContent(data?.choices?.[0]?.message?.content);
  const parsedContent = tryParseJson(content);
  const candidates = [
    extractImageUrlFromParts(contentParts),
    data?.data?.[0]?.url,
    data?.data?.[0]?.image_url?.url,
    data?.data?.[0]?.image_url,
    data?.data?.[0]?.output_url,
    data?.data?.[0]?.images?.[0]?.url,
    data?.output?.[0]?.url,
    data?.output?.[0]?.image_url?.url,
    data?.url,
    data?.image_url?.url,
    data?.image_url,
    parsedContent?.data?.[0]?.url,
    parsedContent?.data?.[0]?.image_url?.url,
    parsedContent?.data?.[0]?.image_url,
    parsedContent?.output?.[0]?.url,
    parsedContent?.url,
    parsedContent?.image_url?.url,
    parsedContent?.image_url,
    extractUrlFromText(content),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return normalizeImageUrl(candidate.trim());
  }

  const b64 =
    data?.data?.[0]?.b64_json ||
    data?.b64_json ||
    data?.output?.[0]?.b64_json ||
    parsedContent?.data?.[0]?.b64_json ||
    parsedContent?.b64_json ||
    extractBase64FromText(content);
  if (typeof b64 === "string" && b64) {
    return b64.startsWith("data:image/") ? b64 : `data:image/png;base64,${b64}`;
  }

  return "";
}

function extractImageUrlFromParts(parts: any): string {
  const queue = Array.isArray(parts) ? [...parts] : [parts];
  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    if (typeof item === "string") {
      const found = extractUrlFromText(item) || extractBase64FromText(item);
      if (found) return found;
      continue;
    }
    if (typeof item !== "object") continue;
    if (typeof item.b64_json === "string" && item.b64_json.trim()) {
      const b64 = item.b64_json.trim();
      return b64.startsWith("data:image/") ? b64 : `data:image/png;base64,${b64}`;
    }
    const candidates = [
      item.url,
      item.image_url?.url,
      item.image_url,
      item.output_url,
      item.text,
      item.content,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        if (/^(https?:\/\/|data:image\/)/i.test(candidate)) return candidate.trim();
        const found = extractUrlFromText(candidate) || extractBase64FromText(candidate);
        if (found) return found;
      }
    }
    for (const value of Object.values(item)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
}

function normalizeImageUrl(value: string) {
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/")) return `${getBaseUrl()}${value}`;
  return value;
}

function tryParseJson(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(stripMarkdownFence(value));
  } catch {
    return null;
  }
}

function extractUrlFromText(value: string) {
  const markdownUrl = value.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/);
  if (markdownUrl) return markdownUrl[1];
  const directUrl = value.match(/https?:\/\/[^\s"'<>)]*/);
  return directUrl?.[0] ?? "";
}

function extractBase64FromText(value: string) {
  const dataUrl = value.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
  if (dataUrl) return dataUrl[0];
  return "";
}

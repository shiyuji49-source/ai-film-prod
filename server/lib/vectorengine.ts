/**
 * VectorEngine Unified API Client
 * All AI calls (Claude, MJ, Seedream, Seedance, Video models) go through VectorEngine proxy.
 */
import { ENV } from "../_core/env";

const getArkUrl = () => ENV.arkApiUrl || "https://ark.cn-beijing.volces.com/api/v3";
const getArkKey = () => ENV.arkApiKey;

const getBaseUrl = () => ENV.vectorEngineApiUrl || "https://api.vectorengine.ai";
const getApiKey = () => ENV.vectorEngineApiKey;

// ============================================================
// LLM Models (via VectorEngine OpenAI-compatible chat API)
// 所有工作流 LLM 统一使用 claude-sonnet-4-6
// ============================================================

/** 默认 LLM 模型：claude-sonnet-4-6 — 适用于所有工作流任务 */
export const GPT_MINI = "claude-sonnet-4-6";
/** @deprecated 已重命名为 GPT_MINI */
export const CLAUDE_OPUS = GPT_MINI;
/** @deprecated 已重命名为 GPT_MINI */
export const CLAUDE_SONNET = GPT_MINI;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: string; json_schema?: any };
}

/** 通过向量引擎调用 GPT-5.4-mini（OpenAI 兼容接口）*/
export async function callGPT(options: ChatCompletionOptions): Promise<string> {
  const { model = GPT_MINI, messages, max_tokens = 8192, temperature = 0.7, response_format } = options;
  const bodyObj: any = { model, messages, max_tokens, temperature };
  if (response_format) bodyObj.response_format = response_format;

  // 最多重试 6 次，指数退避：5s → 10s → 20s → 40s → 60s
  const MAX_RETRIES = 6;
  const url = `${getBaseUrl()}/v1/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getApiKey()}`,
  };
  const bodyStr = JSON.stringify(bodyObj);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { method: "POST", headers, body: bodyStr });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }

    const errText = await res.text();
    const isRateLimit = res.status === 429 || errText.toLowerCase().includes("rate") || errText.toLowerCase().includes("too many");

    if (isRateLimit && attempt < MAX_RETRIES - 1) {
      // 指数退避：5s, 10s, 20s, 40s, 60s
      const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
      console.warn(`[GPT] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (isRateLimit) {
      throw new Error("AI 服务请求频率超限，已自动重试多次，请等待约 1 分钟后再试");
    }

    throw new Error(`GPT API error (${res.status}): ${errText}`);
  }

  throw new Error("GPT API call failed after max retries");
}

/** 快速任务（剧本解析、结构化提取等）*/
export async function callGPTFast(messages: ChatMessage[], options?: Partial<ChatCompletionOptions>): Promise<string> {
  return callGPT({ model: GPT_MINI, messages, ...options });
}

/** 复杂创意任务（提示词生成、导演讲戏等）*/
export async function callGPTPro(messages: ChatMessage[], options?: Partial<ChatCompletionOptions>): Promise<string> {
  return callGPT({ model: GPT_MINI, messages, ...options });
}

/** @deprecated 请使用 callGPTFast */
export const callClaudeSonnet = callGPTFast;
/** @deprecated 请使用 callGPTPro */
export const callClaudeOpus = callGPTPro;

// ============================================================
// Midjourney (via VectorEngine MJ API)
// ============================================================

export interface MJImagineOptions {
  prompt: string;
  base64Array?: string[];
  botType?: "MID_JOURNEY" | "NIJI_JOURNEY";
}

export async function mjImagine(options: MJImagineOptions): Promise<{ code: number; result: string; description: string }> {
  const res = await fetch(`${getBaseUrl()}/mj/submit/imagine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      botType: options.botType || "MID_JOURNEY",
      prompt: options.prompt,
      base64Array: options.base64Array || [],
    }),
  });
  if (!res.ok) throw new Error(`MJ Imagine error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function mjFetchTask(taskId: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/mj/task/${taskId}/fetch`, {
    headers: { "Authorization": `Bearer ${getApiKey()}` },
  });
  if (!res.ok) throw new Error(`MJ Fetch error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function mjAction(taskId: string, customId: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/mj/submit/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ taskId, customId }),
  });
  if (!res.ok) throw new Error(`MJ Action error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function mjBlend(base64Array: string[]): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/mj/submit/blend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ base64Array }),
  });
  if (!res.ok) throw new Error(`MJ Blend error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function mjDescribe(base64: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/mj/submit/describe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ base64 }),
  });
  if (!res.ok) throw new Error(`MJ Describe error (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Midjourney 图片生成 — 提交任务并轮询等待完成，返回图片 URL
 * 适用于：风格定调（MJ 模式）
 * 通过 VectorEngine MJ API 调用（正确路径）
 */
export async function generateMJImageAndWait(options: {
  prompt: string;
  referenceImageBase64?: string;
  botType?: "MID_JOURNEY" | "NIJI_JOURNEY";
  timeoutMs?: number;
}): Promise<string> {
  const { prompt, referenceImageBase64, botType = "MID_JOURNEY", timeoutMs = 300000 } = options;

  // Step 1: Submit imagine task
  const base64Array = referenceImageBase64 ? [referenceImageBase64] : [];
  const submitRes = await mjImagine({ prompt, base64Array, botType });
  if (!submitRes.result) throw new Error(`MJ submit failed: ${submitRes.description}`);
  const taskId = submitRes.result;

  // Step 2: Poll until done (max timeoutMs)
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds
  while (Date.now() - startTime < timeoutMs) {
    await new Promise(r => setTimeout(r, pollInterval));
    const task = await mjFetchTask(taskId);
    if (task.status === "SUCCESS") {
      const imageUrl = task.imageUrl || task.image_url;
      if (!imageUrl) throw new Error("MJ task succeeded but no imageUrl returned");
      return imageUrl;
    }
    if (task.status === "FAILURE") {
      throw new Error(`MJ task failed: ${task.failReason || "unknown reason"}`);
    }
    // SUBMITTED, IN_PROGRESS, etc. - keep polling
  }
  throw new Error(`MJ task timed out after ${timeoutMs / 1000}s (taskId: ${taskId})`);
}

// ============================================================
// Seedream (豆包图片生成)
// 注意：豆包模型必须直接调用火山引擎 ARK API，禁止通过 VectorEngine 代理调用豆包模型
// ============================================================

export type SeedreamModel =
  | "doubao-seedream-5-0-260128"
  | "doubao-seedream-4-5-251128"
  | "doubao-seedream-4-0-250828"
  | "doubao-seedream-3-0-t2i-250415"
  | "doubao-seededit-3-0-i2i-250628";

export interface SeedreamOptions {
  model?: SeedreamModel;
  prompt: string;
  image?: string; // URL or base64 for img2img
  size?: string;  // "2K", "3K", or "2048x2048"
  watermark?: boolean;
}

/**
 * 豆包即梦图片生成 — 直接调用火山引擎 ARK API
 * 适用于：风格定调（豆包4.5）、多视角（豆包5.0）、首帧生成（豆包4.5/5.0）
 * 禁止通过 VectorEngine 代理调用豆包模型
 */
export async function generateSeedreamImage(options: SeedreamOptions): Promise<{ url: string }[]> {
  const { model = "doubao-seedream-5-0-260128", prompt, image, size = "2K", watermark = false } = options;
  const body: any = { model, prompt, size, watermark, response_format: "url" };
  if (image) body.image = image;

  // 直接调用火山引擎 ARK API（不经过 VectorEngine 代理）
  const res = await fetch(`${getArkUrl()}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getArkKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Seedream ARK error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.data?.map((d: any) => ({ url: d.url })) ?? [];
}

// ============================================================
// Seedance 1.5 Pro (豆包视频生成 via VectorEngine)
// ============================================================

export interface SeedanceOptions {
  prompt: string;
  imageUrl?: string;       // 首帧图
  lastFrameUrl?: string;   // 尾帧图
  ratio?: string;          // "21:9"|"16:9"|"4:3"|"1:1"|"3:4"|"9:16"|"auto"
  resolution?: "480p" | "720p" | "1080p";  // 分辨率
  duration?: number;       // 4-12 秒，或忽略以开启智能时长
  smartDuration?: boolean; // true = 智能时长（忽略 duration）
  watermark?: boolean;
}

export async function createSeedanceVideo(options: SeedanceOptions): Promise<{ id: string; status: string }> {
  const {
    prompt, imageUrl, lastFrameUrl,
    ratio = "16:9",
    duration = 5, smartDuration = false,
    watermark = false
  } = options;

  const content: any[] = [{ type: "text", text: prompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }
  if (lastFrameUrl) {
    content.push({ type: "image_url", image_url: { url: lastFrameUrl } });
  }

  // 视频时长：4-12 秒
  const clampedDuration = Math.max(4, Math.min(12, duration));

  // ARK API does NOT support resolution field - use ratio only
  const body: any = {
    model: "doubao-seedance-1-5-pro-251215",
    content,
    ratio: ratio === "auto" ? "9:16" : ratio,
    watermark,
  };

  if (!smartDuration) {
    body.duration = clampedDuration;
  }
  // smartDuration = true 时不传 duration，模型自动决定时长

  // Use ARK API directly (VectorEngine proxy does not have Seedance 1.5 Pro channel)
  const res = await fetch(`${getArkUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getArkKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Seedance error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function querySeedanceTask(taskId: string): Promise<any> {
  // Use ARK API directly for task status queries
  const res = await fetch(`${getArkUrl()}/contents/generations/tasks/${taskId}`, {
    headers: { "Authorization": `Bearer ${getArkKey()}` },
  });
  if (!res.ok) throw new Error(`Seedance query error (${res.status}): ${await res.text()}`);
  return res.json();
}

// ============================================================
// Gemini 3 Pro Image (图片生成 via VectorEngine)
// 正确端点：POST /v1/chat/completions，模型名：gemini-3-pro-image-preview
// 返回格式：choices[0].message.content 中包含 base64 图片数据
// ============================================================

export interface NanoBananaOptions {
  prompt: string;
  imageUrl?: string;  // for image editing
  aspectRatio?: string;
}

export async function generateNanoBananaImage(options: NanoBananaOptions): Promise<{ url: string }[]> {
  const { prompt, imageUrl, aspectRatio } = options;

  // 构建消息内容：如果有参考图则使用多模态输入
  let userContent: any;
  if (imageUrl) {
    userContent = [
      { type: "image_url", image_url: { url: imageUrl } },
      { type: "text", text: prompt + (aspectRatio ? ` --ar ${aspectRatio}` : "") },
    ];
  } else {
    userContent = prompt + (aspectRatio ? ` --ar ${aspectRatio}` : "");
  }

  const res = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: "gemini-3-pro-image-preview",
      stream: false,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Gemini 3 Pro Image error (${res.status}): ${await res.text()}`);
  const data = await res.json();

  // 解析响应：提取 base64 图片数据
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // 尝试提取 base64
  const base64Match = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
  if (base64Match) {
    // 返回 base64 data URL（调用方需要处理 base64 而不是 URL）
    return [{ url: `data:image/${base64Match[1]};base64,${base64Match[2]}` }];
  }

  // 如果返回的是 URL
  const urlMatch = content.match(/https?:\/\/[^\s"']+/);
  if (urlMatch) {
    return [{ url: urlMatch[0] }];
  }

  // 如果 candidatesTokenCount = 0 说明内容被拒绝
  const candidatesTokenCount = data.usage?.candidatesTokenCount ?? data.usageMetadata?.candidatesTokenCount;
  if (candidatesTokenCount === 0) {
    throw new Error("Gemini 3 Pro Image: content rejected by safety filter");
  }

  throw new Error(`Gemini 3 Pro Image: no image data in response. content preview: ${content.slice(0, 200)}`);
}

// ============================================================
// Unified Video API (Veo, Grok, Wan, Sora)
// ============================================================

export type VideoModel =
  | "veo-3.1-4k"
  | "grok-video-3-15s"
  | "wan2.6-i2v"
  | "sora-2-pro"
  | "doubao-seedance-2-0-pro"
  | "kling-3.0"
  | "kling-3.0-omni"
  | "runway-gen4"
  | "hailuo-2.3";

export interface VideoCreateOptions {
  model: VideoModel;
  prompt: string;
  imageUrl?: string;       // for image-to-video
  referenceImage?: string; // for reference image
  aspectRatio?: string;
}

export async function createVideo(options: VideoCreateOptions): Promise<{ id: string; status: string }> {
  const { model, prompt, imageUrl, referenceImage, aspectRatio } = options;
  const input: any = { prompt };
  if (aspectRatio) input.aspect_ratio = aspectRatio;

  let endpoint = "/v1/video/generations";
  const body: any = { model, input };

  if (imageUrl) {
    input.image_url = imageUrl;
  }
  if (referenceImage) {
    input.reference_image = referenceImage;
  }

  const res = await fetch(`${getBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Video create error (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function queryVideoTask(taskId: string): Promise<any> {
  const res = await fetch(`${getBaseUrl()}/v1/video/generations/${taskId}`, {
    headers: { "Authorization": `Bearer ${getApiKey()}` },
  });
  if (!res.ok) throw new Error(`Video query error (${res.status}): ${await res.text()}`);
  return res.json();
}

// ============================================================
// Available Models Registry
// ============================================================

export const IMAGE_MODELS = [
  { id: "doubao-seedream-5-0-260128", name: "Seedream 5.0", provider: "Volcano" },
  { id: "doubao-seedream-4-5-251128", name: "Seedream 4.5", provider: "Volcano" },
  { id: "doubao-seedream-4-0-250828", name: "Seedream 4.0", provider: "Volcano" },
  { id: "midjourney", name: "Midjourney", provider: "MJ" },
  { id: "nano-banana-pro", name: "Gemini 3 Pro Image", provider: "Google" },
] as const;

export const VIDEO_MODELS = [
  { id: "doubao-seedance-1-5-pro-251215", name: "Seedance 1.5 Pro", provider: "Volcano", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "veo-3.1-4k", name: "Veo 3.1 4K", provider: "Google", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "kling-3.0", name: "Kling 3.0", provider: "Kuaishou", caps: { firstFrame: true, lastFrame: true, subjectRef: true } },
  { id: "kling-3.0-omni", name: "Kling 3.0 Omni", provider: "Kuaishou", caps: { firstFrame: true, lastFrame: true, subjectRef: true } },
  { id: "runway-gen4", name: "Runway Gen-4", provider: "Runway", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
  { id: "hailuo-2.3", name: "Hailuo 2.3", provider: "MiniMax", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
  { id: "grok-video-3-15s", name: "Grok Video 3 15s", provider: "xAI", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "wan2.6-i2v", name: "Wan 2.6 I2V", provider: "Alibaba", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "sora-2-pro", name: "Sora 2 Pro", provider: "OpenAI", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
] as const;

export type VideoModelCaps = { firstFrame: boolean; lastFrame: boolean; subjectRef: boolean };

export function getVideoModelCaps(modelId: string): VideoModelCaps {
  const m = VIDEO_MODELS.find(v => v.id === modelId);
  return m?.caps ?? { firstFrame: true, lastFrame: false, subjectRef: false };
}

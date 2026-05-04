/**
 * Image Service — 统一图片生成入口
 *
 * 唯一的图片生成函数 generateImage()，按 engine 参数分发到对应底层通道：
 * - seedream-4.5 / seedream-5.0  → 火山引擎 ARK API（直调）
 * - midjourney                   → VectorEngine MJ API
 * - nano-banana-pro               → VectorEngine Gemini 3 Pro Image（fallback→Seedream 5.0）
 *
 * 所有通道返回 S3 持久 URL（已上传）。
 */
import { nanoid } from "nanoid";
import {
  generateSeedreamImage,
  generateMJImageAndWait,
  generateNanoBananaImage,
  generateGPTImage2,
  type SeedreamModel,
} from "../lib/vectorengine";
import { storagePut } from "../storage";

// ─── 引擎类型 ──────────────────────────────────────────────────────────────────

export type ImageEngine =
  | "image2"
  | "seedream-4.5"
  | "seedream-5.0"
  | "midjourney"
  | "nano-banana-pro";

/** 引擎名 → ARK 模型 ID 映射 */
const ENGINE_TO_MODEL: Record<string, SeedreamModel> = {
  "seedream-4.5": "doubao-seedream-4-5-251128",
  "seedream-5.0": "doubao-seedream-5-0-260128",
};

// ─── 图片生成主接口 ────────────────────────────────────────────────────────────

export interface GenerateImageOptions {
  /** 图片生成提示词 */
  prompt: string;
  /** 引擎选择（默认 seedream-4.5） */
  engine?: ImageEngine;
  /** 宽高比（e.g. "9:16" | "16:9" | "1:1" | "3:4" | "4:3"，默认 "9:16"） */
  aspectRatio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
  /** 参考图 URL（用于 img2img 或角色参考，可选） */
  referenceImageUrl?: string;
  /** S3 key 前缀（默认 "generated"） */
  s3KeyPrefix?: string;
}

export interface GenerateImageResult {
  /** S3 持久 URL */
  url: string;
  /** 任务 ID（MJ 任务 ID，其余引擎为空字符串） */
  taskId: string;
}

/**
 * 统一图片生成入口：根据 engine 分发到对应底层 API，上传 S3，返回持久 URL。
 *
 * @example
 * const { url } = await generateImage({
 *   prompt: "A cinematic portrait of...",
 *   engine: "seedream-4.5",
 *   aspectRatio: "9:16",
 * });
 */
export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const {
    prompt,
    engine = "seedream-4.5",
    aspectRatio = "9:16",
    referenceImageUrl,
    s3KeyPrefix = "generated",
  } = options;

  let rawUrl: string;
  let taskId = "";

  if (engine === "image2") {
    rawUrl = await generateGPTImage2({
      prompt,
      aspectRatio,
    });
  } else if (engine === "midjourney") {
    rawUrl = await generateMJImageAndWait({ prompt, referenceImageUrl });
  } else if (engine === "nano-banana-pro") {
    rawUrl = await _generateGeminiWithFallback(prompt, referenceImageUrl, aspectRatio);
  } else {
    // Seedream 4.5 or 5.0
    const model = ENGINE_TO_MODEL[engine] ?? "doubao-seedream-4-5-251128";
    const results = await generateSeedreamImage({
      model,
      prompt,
      image: referenceImageUrl,
      size: "2K",
      watermark: false,
    });
    rawUrl = results[0]?.url ?? "";
    if (!rawUrl) throw new Error(`${engine}: no URL returned`);
  }

  const s3Url = await _uploadImageToS3(rawUrl, s3KeyPrefix);
  return { url: s3Url, taskId };
}

// ─── 内部辅助函数 ─────────────────────────────────────────────────────────────

/** Gemini 3 Pro Image，503 时 fallback 到 Seedream 5.0 */
async function _generateGeminiWithFallback(
  prompt: string,
  referenceImageUrl?: string,
  aspectRatio?: string
): Promise<string> {
  try {
    const results = await generateNanoBananaImage({ prompt, imageUrl: referenceImageUrl, aspectRatio });
    const url = results[0]?.url;
    if (!url) throw new Error("nano-banana-pro: no URL returned");
    return url;
  } catch (err: any) {
    const isUnavailable =
      err?.message?.includes("503") ||
      err?.message?.includes("无可用渠道") ||
      err?.message?.includes("No available channels");
    if (!isUnavailable) throw err;
    console.warn("[ImageService] nano-banana-pro unavailable, falling back to Seedream 5.0");
    const fallbackResults = await generateSeedreamImage({
      model: "doubao-seedream-5-0-260128",
      prompt,
      image: referenceImageUrl,
      size: "2K",
      watermark: false,
    });
    const url = fallbackResults[0]?.url;
    if (!url) throw new Error("Seedream 5.0 fallback: no URL returned");
    return url;
  }
}

/**
 * 下载图片 URL 或 base64 data URL，上传到 S3，返回持久 URL。
 */
export async function _uploadImageToS3(rawUrl: string, s3KeyPrefix: string): Promise<string> {
  let buf: Buffer;
  let mimeType = "image/jpeg";

  if (rawUrl.startsWith("data:")) {
    const base64Match = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) throw new Error("Invalid base64 data URL");
    mimeType = base64Match[1];
    buf = Buffer.from(base64Match[2], "base64");
  } else {
    const resp = await fetch(rawUrl);
    if (!resp.ok) throw new Error(`Failed to download image: ${resp.status}`);
    buf = Buffer.from(await resp.arrayBuffer());
  }

  const ext = mimeType === "image/png" ? "png" : "jpg";
  const key = `${s3KeyPrefix}/${nanoid(10)}.${ext}`;
  const { url } = await storagePut(key, buf, mimeType);
  return url;
}

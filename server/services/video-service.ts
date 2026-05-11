/**
 * Video Service — 统一视频生成入口
 *
 * 唯一的视频生成函数 generateVideo()，按 engine 参数分发两条线路：
 *
 * 精品剧（engine = 'seedance-2.0'）：
 *   Seedance 2.0 文生视频 + 多模态参考（@Image1-9）
 *   不使用首尾帧，直接从文本描述+参考图生成视频
 *
 * 跑量剧（engine = 'seedance-1.5-pro'）：
 *   Seedance 1.5 Pro 首尾帧图生视频
 *   输入 firstFrameUrl + lastFrameUrl + 运动提示词 → 视频
 *   API 文档：https://www.volcengine.com/docs/85621/1802721
 *
 * 通用（engine = 'kling-3.0' | 'veo-3.1' 等）：
 *   VectorEngine 统一视频 API
 *
 * 所有通道含自动重试，返回 S3 持久 URL。
 */
import { nanoid } from "nanoid";
import { ENV } from "../_core/env";
import {
  createSeedanceVideo,
  querySeedanceTask,
  createVideo,
  queryVideoTask,
  type VideoModel,
} from "../lib/vectorengine";
import { storagePut } from "../storage";

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export type VideoEngine =
  | "seedance-2.0"
  | "seedance-1.5-pro"
  | "kling-3.0"
  | "kling-3.0-omni"
  | "veo-3.1"
  | "runway-gen4"
  | "hailuo-2.3"
  | "grok-video-3"
  | "sora-2-pro"
  | "wan2.6";

/** VectorEngine 模型 ID 映射（通用引擎） */
const ENGINE_TO_VE_MODEL: Record<string, VideoModel> = {
  "kling-3.0":      "kling-3.0",
  "kling-3.0-omni": "kling-3.0-omni",
  "veo-3.1":        "veo-3.1-4k",
  "runway-gen4":    "runway-gen4",
  "hailuo-2.3":     "hailuo-2.3",
  "grok-video-3":   "grok-video-3-15s",
  "sora-2-pro":     "sora-2-pro",
  "wan2.6":         "wan2.6-i2v",
};

export interface GenerateVideoOptions {
  /** 视频提示词（文本描述） */
  prompt: string;
  /** 视频引擎（默认 seedance-1.5-pro） */
  engine?: VideoEngine;

  // === 精品剧模式（Seedance 2.0）===
  /** 角色/场景参考图 URL 列表（最多 9 张，对应 @Image1-9） */
  referenceImageUrls?: string[];
  /** 参考视频 URL 列表（最多 3 段，对应 @Video1-3） */
  referenceVideoUrls?: string[];
  /** 参考音频 URL 列表（最多 3 段，对应 @Audio1-3） */
  referenceAudioUrls?: string[];
  /** 是否生成/保留音频（Seedance 2.0） */
  generateAudio?: boolean;
  /** 是否添加平台水印（Seedance 2.0） */
  watermark?: boolean;

  // === 跑量剧模式（Seedance 1.5 Pro 首尾帧图生视频）===
  /** 首帧图 URL（跑量剧专用） */
  firstFrameUrl?: string;
  /** 尾帧图 URL（跑量剧专用，可选） */
  lastFrameUrl?: string;

  // === 通用引擎（Kling/Veo 等）===
  /** 首帧图 URL（部分通用引擎支持） */
  imageUrl?: string;
  /** 主体参考图 URL（部分通用引擎支持） */
  referenceImage?: string;

  // === 通用参数 ===
  /** 宽高比（默认 "9:16"） */
  aspectRatio?: "16:9" | "9:16";
  /** 视频时长（秒，Seedance 1.5 Pro: 4-12，默认 5） */
  duration?: number;
  /** 是否使用智能时长（Seedance 1.5 Pro，默认 false） */
  smartDuration?: boolean;
  /** 分辨率（Seedance 1.5 Pro，默认 "1080p"） */
  resolution?: "480p" | "720p" | "1080p";
  /** S3 key 前缀（默认 "videos"） */
  s3KeyPrefix?: string;
  /** 是否上传到 S3（默认 true） */
  uploadToS3?: boolean;
}

export interface GenerateVideoResult {
  /** S3 持久 URL（或原始临时 URL 若 uploadToS3=false） */
  url: string;
  /** 任务 ID */
  taskId: string;
  /** 最终状态 */
  status: string;
}

function splitModelList(value?: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSeedance2ModelCandidates(): string[] {
  return unique([
    ...splitModelList(ENV.seedance2Model),
    ...splitModelList(ENV.seedance2FallbackModels),
    "doubao-seedance-2-0-260128",
    "doubao-seedance-2-0-fast-260128",
    "doubao-seedance-2-0-pro",
  ]);
}

function isSeedanceModelAccessError(status: number, text: string): boolean {
  const lower = text.toLowerCase();
  return (
    status === 404 ||
    lower.includes("invalidendpointormodel") ||
    lower.includes("does not exist") ||
    lower.includes("do not have access") ||
    lower.includes("no permission") ||
    lower.includes("access denied")
  );
}

function summarizeError(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 700);
}

/**
 * 统一视频生成入口
 *
 * 根据 engine 参数自动分发到对应底层 API。
 *
 * @example 跑量剧
 * const { url } = await generateVideo({
 *   prompt: "The woman turns slowly...",
 *   engine: "seedance-1.5-pro",
 *   firstFrameUrl: "https://s3.../first.jpg",
 *   lastFrameUrl: "https://s3.../last.jpg",
 *   duration: 5,
 *   aspectRatio: "9:16",
 * });
 *
 * @example 精品剧
 * const { url } = await generateVideo({
 *   prompt: "参考@图片1中的人物，中景...",
 *   engine: "seedance-2.0",
 *   referenceImageUrls: ["https://s3.../char.jpg", "https://s3.../scene.jpg"],
 * });
 */
export async function generateVideo(options: GenerateVideoOptions): Promise<GenerateVideoResult> {
  const {
    engine = "seedance-1.5-pro",
    s3KeyPrefix = "videos",
    uploadToS3 = true,
  } = options;

  let rawUrl: string;
  let taskId: string;

  if (engine === "seedance-2.0") {
    ({ rawUrl, taskId } = await _generateSeedance2(options));
  } else if (engine === "seedance-1.5-pro") {
    ({ rawUrl, taskId } = await _generateSeedance15(options));
  } else {
    // 通用 VectorEngine 引擎
    ({ rawUrl, taskId } = await _generateVEVideo(options, ENGINE_TO_VE_MODEL[engine] ?? "kling-3.0"));
  }

  if (!uploadToS3) return { url: rawUrl, taskId, status: "done" };

  const s3Url = await _uploadVideoToS3(rawUrl, s3KeyPrefix);
  return { url: s3Url, taskId, status: "done" };
}

// ─── 精品剧：Seedance 2.0 文生视频 ────────────────────────────────────────────

async function _generateSeedance2(options: GenerateVideoOptions): Promise<{ rawUrl: string; taskId: string }> {
  const {
    prompt,
    aspectRatio = "9:16",
    duration = 5,
  } = options;

  // 构建多模态 content
  const content: any[] = [{ type: "text", text: prompt }];
  for (const imgUrl of (options.referenceImageUrls ?? []).slice(0, 9)) {
    content.push({ type: "image_url", image_url: { url: imgUrl }, role: "reference_image" });
  }
  // 参考视频（可选）
  for (const vidUrl of (options.referenceVideoUrls ?? []).slice(0, 3)) {
    content.push({ type: "video_url", video_url: { url: vidUrl }, role: "reference_video" });
  }
  // 参考音频（可选）
  for (const audioUrl of (options.referenceAudioUrls ?? []).slice(0, 3)) {
    content.push({ type: "audio_url", audio_url: { url: audioUrl }, role: "reference_audio" });
  }

  const arkBaseUrl = ENV.arkApiUrl || "https://ark.cn-beijing.volces.com/api/v3";
  const arkKey = ENV.arkApiKey;
  if (!arkKey) throw new Error("Seedance 2.0: 缺少 ARK_API_KEY");

  const models = getSeedance2ModelCandidates();
  const errors: string[] = [];

  let taskId: string | undefined;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`${arkBaseUrl}/contents/generations/tasks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${arkKey}`,
          },
          body: JSON.stringify({
            model,
            content,
            generate_audio: options.generateAudio ?? Boolean(options.referenceAudioUrls?.length),
            ratio: aspectRatio,
            duration: Math.max(4, Math.min(15, duration ?? 5)),
            watermark: options.watermark ?? false,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          const detail = `${model}: HTTP ${resp.status} ${summarizeError(errText)}`;

          if (isSeedanceModelAccessError(resp.status, errText)) {
            errors.push(detail);
            break;
          }

          const is503 = resp.status === 503 || errText.includes("503") || errText.includes("No available channels");
          if (is503 && attempt < 2) {
            console.warn(`[Seedance2] ${model} 503 on attempt ${attempt + 1}, retrying in 10s...`);
            await new Promise((r) => setTimeout(r, 10000));
            continue;
          }

          throw new Error(`Seedance 2.0 create error: ${detail}`);
        }

        const data = await resp.json();
        taskId = data.id ?? data.task_id ?? data.taskId;
        if (!taskId) throw new Error(`${model}: 任务创建成功但没有返回任务 ID`);
        console.info(`[Seedance2] started with model ${model}, taskId ${taskId}`);
        break;
      } catch (err: any) {
        const message = err?.message ?? String(err);
        const is503 = message.includes("503") || message.includes("No available channels");
        if (is503 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        throw err;
      }
    }
    if (taskId) break;
  }

  if (!taskId) {
    throw new Error(
      `Seedance 2.0: 当前 ARK_KEY 没有可用的 2.0 模型/接入点。已尝试：${models.join(", ")}。` +
      `请在火山 Ark 控制台确认已开通的 Seedance 2.0 模型 ID，写入服务器 .env 的 SEEDANCE_2_MODEL。` +
      (errors.length ? ` 最近错误：${errors.join(" | ")}` : "")
    );
  }

  const rawUrl = await _pollSeedanceTask(taskId, 600000, 8000);
  return { rawUrl, taskId };
}

// ─── 跑量剧：Seedance 1.5 Pro 首尾帧图生视频 ────────────────────────────────

async function _generateSeedance15(options: GenerateVideoOptions): Promise<{ rawUrl: string; taskId: string }> {
  const {
    prompt,
    firstFrameUrl,
    lastFrameUrl,
    aspectRatio = "9:16",
    resolution = "1080p",
    duration = 5,
    smartDuration = false,
  } = options;

  if (!firstFrameUrl) throw new Error("Seedance 1.5 Pro: firstFrameUrl is required");

  let result: { id: string; status: string } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await createSeedanceVideo({
        prompt,
        imageUrl: firstFrameUrl,
        lastFrameUrl,
        ratio: aspectRatio,
        resolution,
        duration,
        smartDuration,
        watermark: false,
      });
      break;
    } catch (err: any) {
      const is503 =
        err?.message?.includes("503") ||
        err?.message?.includes("无可用渠道") ||
        err?.message?.includes("No available channels");
      if (!is503 || attempt >= 2) throw err;
      console.warn(`[Seedance1.5] 503 on attempt ${attempt + 1}, retrying in 10s...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  if (!result) throw new Error("Seedance 1.5: failed after retries");

  const rawUrl = await _pollSeedanceTask(result.id, 300000, 5000);
  return { rawUrl, taskId: result.id };
}

// ─── 通用 VectorEngine 引擎（Kling/Veo/Grok 等）────────────────────────────

async function _generateVEVideo(
  options: GenerateVideoOptions,
  model: VideoModel
): Promise<{ rawUrl: string; taskId: string }> {
  const { prompt, imageUrl, referenceImage, aspectRatio } = options;
  const result = await createVideo({ model, prompt, imageUrl, referenceImage, aspectRatio });
  const taskId = result.id;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await queryVideoTask(taskId);
    if (status.status === "completed" || status.status === "succeeded") {
      const rawUrl = status.output?.video_url || status.video_url;
      if (!rawUrl) throw new Error(`${model}: succeeded but no video URL`);
      return { rawUrl, taskId };
    }
    if (status.status === "failed") {
      throw new Error(`${model}: ${status.error || "unknown error"}`);
    }
  }

  throw new Error(`${model}: timed out`);
}

// ─── 通用轮询 ─────────────────────────────────────────────────────────────────

async function _pollSeedanceTask(
  taskId: string,
  timeoutMs: number,
  intervalMs: number
): Promise<string> {
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const status = await querySeedanceTask(taskId);
    if (status.status === "succeeded" || status.status === "completed") {
      const url = status.content?.video_url || status.video_url || status.output?.video_url;
      if (url) return url;
    }
    if (status.status === "failed") {
      throw new Error(`Seedance task failed: ${status.error || "unknown error"}`);
    }
  }
  throw new Error(`Seedance task timed out (taskId: ${taskId})`);
}

/**
 * 下载视频并上传到 S3，返回持久 URL。
 */
export async function _uploadVideoToS3(videoUrl: string, s3KeyPrefix: string): Promise<string> {
  const resp = await fetch(videoUrl);
  if (!resp.ok) throw new Error(`Failed to download video: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const key = `${s3KeyPrefix}/${nanoid(8)}.mp4`;
  const { url } = await storagePut(key, buf, "video/mp4");
  return url;
}

/**
 * 视频模型和图片模型的共享定义
 * 前后端共用，确保模型列表一致
 */

// ─── 视频模型能力 ─────────────────────────────────────────────────────────────
export interface VideoModelCaps {
  firstFrame: boolean;   // 支持首帧参考
  lastFrame: boolean;    // 支持尾帧参考
  subjectRef: boolean;   // 支持主体参考（Element/Character Ref）
}

export interface VideoModelDef {
  id: string;
  name: string;
  provider: string;
  caps: VideoModelCaps;
}

export const VIDEO_MODELS: VideoModelDef[] = [
  { id: "seedance_1_5", name: "Seedance 1.5 Pro", provider: "豆包", caps: { firstFrame: true, lastFrame: true, subjectRef: false } },
  { id: "veo_3_1", name: "Veo 3.1 4K", provider: "Google", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "kling_3_0", name: "Kling 3.0", provider: "快手", caps: { firstFrame: true, lastFrame: true, subjectRef: true } },
  { id: "kling_3_0_omni", name: "Kling 3.0 Omni", provider: "快手", caps: { firstFrame: true, lastFrame: true, subjectRef: true } },
  { id: "runway_gen4", name: "Runway Gen-4", provider: "Runway", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
  { id: "hailuo_2_3", name: "海螺 2.3", provider: "MiniMax", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
  { id: "grok_video_3", name: "Grok Video 3", provider: "xAI", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "wan2_6", name: "Wan 2.6 I2V", provider: "阿里", caps: { firstFrame: true, lastFrame: false, subjectRef: false } },
  { id: "sora_2_pro", name: "Sora 2 Pro", provider: "OpenAI", caps: { firstFrame: true, lastFrame: false, subjectRef: true } },
];

export function getVideoModelCaps(modelId: string): VideoModelCaps {
  const m = VIDEO_MODELS.find(v => v.id === modelId);
  return m?.caps ?? { firstFrame: true, lastFrame: false, subjectRef: false };
}

export function getVideoModelName(modelId: string): string {
  return VIDEO_MODELS.find(v => v.id === modelId)?.name ?? modelId;
}

// ─── 图片模型 ─────────────────────────────────────────────────────────────────
export interface ImageModelDef {
  id: string;
  name: string;
  provider: string;
  /** 适用场景 */
  usage: "style" | "finalize" | "both";
  /** API 路由：vectorengine = VectorEngine API，volcano = 火山引擎 API */
  api: "vectorengine" | "volcano";
}

export const IMAGE_MODELS: ImageModelDef[] = [
  { id: "nano-banana-pro", name: "Gemini 3 Pro Image", provider: "Google", usage: "both", api: "vectorengine" },
  { id: "doubao-seedream-5-0-260128", name: "即梦 5.0", provider: "豆包", usage: "both", api: "volcano" },
  { id: "doubao-seedream-4-5-251128", name: "即梦 4.5", provider: "豆包", usage: "style", api: "volcano" },
  { id: "midjourney", name: "Midjourney", provider: "MJ", usage: "style", api: "vectorengine" },
];

/// ─── 分辨率/宽高比选项 ────────────────────────────────────────────
export const ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 竖屏" },
  { value: "16:9", label: "16:9 横屏" },
  { value: "1:1",  label: "1:1 方形" },
  { value: "4:3",  label: "4:3" },
  { value: "3:4",  label: "3:4" },
] as const;

// ─── Seedance 1.5 Pro 视频参数 ──────────────────────────────────────
/** Seedance 1.5 Pro 视频比例（包含智能比例） */
export const SEEDANCE_ASPECT_RATIO_OPTIONS = [
  { value: "21:9",  label: "21:9" },
  { value: "16:9",  label: "16:9" },
  { value: "4:3",   label: "4:3" },
  { value: "1:1",   label: "1:1" },
  { value: "3:4",   label: "3:4" },
  { value: "9:16",  label: "9:16" },
  { value: "auto",  label: "智能" },
] as const;

/** Seedance 1.5 Pro 分辨率 */
export const SEEDANCE_RESOLUTION_OPTIONS = [
  { value: "480p",  label: "480p" },
  { value: "720p",  label: "720p" },
  { value: "1080p", label: "1080p" },
] as const;

/** Seedance 1.5 Pro 视频时长：4-12 秒，支持智能时长 */
export const SEEDANCE_DURATION_OPTIONS = {
  min: 4,
  max: 12,
  smartLabel: "智能时长",
} as const;

/** 风格定调推荐模型 */
export const STYLE_IMAGE_MODELS = IMAGE_MODELS.filter(m => m.usage === "style" || m.usage === "both");

/** 主体定稿推荐模型 */
export const FINALIZE_IMAGE_MODELS = IMAGE_MODELS.filter(m => m.usage === "finalize" || m.usage === "both");

export function getImageModelName(modelId: string): string {
  return IMAGE_MODELS.find(m => m.id === modelId)?.name ?? modelId;
}

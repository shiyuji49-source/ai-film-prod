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

/** 视频生成只保留 Seedance 1.5 Pro（火山引擎） */
export const VIDEO_MODELS: VideoModelDef[] = [
  { id: "seedance_1_5", name: "Seedance 1.5 Pro", provider: "豆包", caps: { firstFrame: true, lastFrame: true, subjectRef: false } },
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

/**
 * 图片模型：
 * - doubao-seedream-4-5：火山引擎 ARK（首帧生成，默认）
 * - doubao-seedream-5-0：火山引擎 ARK（多视角/主体定稿）
 * - MJ：通过 VectorEngine（风格定调）
 * - nano-banana-pro：VectorEngine Gemini 3 Pro Image（高质量）
 */
export const IMAGE_MODELS: ImageModelDef[] = [
  { id: "doubao-seedream-4-5-251128", name: "即梦 4.5", provider: "豆包", usage: "style", api: "volcano" },
  { id: "doubao-seedream-5-0-260128", name: "即梦 5.0", provider: "豆包", usage: "finalize", api: "volcano" },
  { id: "midjourney", name: "Midjourney", provider: "MJ", usage: "style", api: "vectorengine" },
  { id: "nano-banana-pro", name: "Gemini 3 Pro Image", provider: "Google", usage: "both", api: "vectorengine" },
];

/** 多视角专用模型：即梦 5.0（火山引擎） */
export const MULTI_VIEW_MODEL = "doubao-seedream-5-0-260128";

/** 首帧生成专用模型：即梦 4.5（火山引擎，默认） */
export const FRAME_IMAGE_MODEL = "doubao-seedream-4-5-251128";

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

/** 风格定调推荐模型：MJ 和 即梦 4.5 */
export const STYLE_IMAGE_MODELS: ImageModelDef[] = [
  { id: "midjourney", name: "Midjourney", provider: "MJ", usage: "style", api: "vectorengine" },
  { id: "doubao-seedream-4-5-251128", name: "即梦 4.5", provider: "豆包", usage: "style", api: "volcano" },
];

/** 主体定稿推荐模型：即梦 5.0 */
export const FINALIZE_IMAGE_MODELS: ImageModelDef[] = [
  { id: "doubao-seedream-5-0-260128", name: "即梦 5.0", provider: "豆包", usage: "finalize", api: "volcano" },
];

export function getImageModelName(modelId: string): string {
  return IMAGE_MODELS.find(m => m.id === modelId)?.name ?? modelId;
}

// ─── 市场选项 ──────────────────────────────────────────────────────────────────
export interface MarketOption {
  value: string;
  label: string;
  /** 推荐的图片生成模型 */
  defaultImageEngine?: string;
}

/** 目标市场选项（前后端共用）
 * 风格定调默认模型规则：
 * - 中国/日本/韩国/印度 → 即梢 4.5（火山引擎 ARK）
 * - 其他海外市场 → Midjourney（VectorEngine）
 */
export const MARKET_OPTIONS: MarketOption[] = [
  { value: "cn", label: "🇨🇳 中国", defaultImageEngine: "doubao-seedream-4-5-251128" },
  { value: "us", label: "🇺🇸 美国", defaultImageEngine: "midjourney" },
  { value: "uk", label: "🇬🇧 英国", defaultImageEngine: "midjourney" },
  { value: "es", label: "🇪🇸 西班牙", defaultImageEngine: "midjourney" },
  { value: "in", label: "🇮🇳 印度", defaultImageEngine: "doubao-seedream-4-5-251128" },
  { value: "br", label: "🇧🇷 巴西", defaultImageEngine: "midjourney" },
  { value: "de", label: "🇩🇪 德国", defaultImageEngine: "midjourney" },
  { value: "fr", label: "🇫🇷 法国", defaultImageEngine: "midjourney" },
  { value: "jp", label: "🇯🇵 日本", defaultImageEngine: "doubao-seedream-4-5-251128" },
  { value: "kr", label: "🇰🇷 韩国", defaultImageEngine: "doubao-seedream-4-5-251128" },
];

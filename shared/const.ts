export const COOKIE_NAME = "app_session_id";

// ── LLM 模型配置 — 所有工作流统一使用 claude-sonnet-4-6 ────────────────────
export const DEFAULT_LLM_MODEL = "claude-sonnet-4-6";
/** @deprecated 保留向后兼容，实际使用 claude-sonnet-4-6 */
export const GEMINI_PRO_MODEL = DEFAULT_LLM_MODEL;
/** @deprecated 保留向后兼容，实际使用 claude-sonnet-4-6 */
export const GEMINI_FLASH_MODEL = DEFAULT_LLM_MODEL;

// thinking_level 配置（保留向后兼容）
export const GEMINI_THINKING_HIGH = "high";
export const GEMINI_THINKING_LOW  = "low";
export const GEMINI_THINKING_OFF  = "off";

// 各操作的预估时间（秒）
export const GEMINI_ESTIMATE_SECS = {
  analyzeScript:        { min: 10, max: 30 },
  generateCharacter:    { min: 15, max: 35 },
  generateAsset:        { min: 15, max: 35 },
  generateShots:        { min: 20, max: 60 },
  generateVideoPrompt:  { min: 15, max: 40 },
} as const;

export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * LLM Service — 统一 LLM 调用入口
 *
 * 唯一的 LLM 调用函数 callLLM()，底层走 LQ API → anthropic/claude-sonnet-4-6。
 * 已内置指数退避重试（最多 6 次，5s 起步，最长 60s）。
 * 自动剥离 ```json 包裹。
 *
 * 替代历史别名：callClaude / callGPT / callGPTFast / callGPTPro / invokeLLM
 */
import { callLQChat, type LQChatCompletionOptions } from "../lib/lqapi";

export interface LLMCallOptions {
  /** 用户提示词（必填） */
  prompt: string;
  /** 系统提示词（可选） */
  systemPrompt?: string;
  /** 模型（默认 claude-sonnet-4-6） */
  model?: "claude-sonnet-4-6" | "claude-opus-4-6";
  /** 最大输出 token 数（默认 8192） */
  maxTokens?: number;
  /** 采样温度（默认 0.7） */
  temperature?: number;
  /** JSON 响应格式（可选） */
  responseFormat?: LQChatCompletionOptions["response_format"];
}

/**
 * 统一 LLM 调用入口
 *
 * @example
 * const result = await callLLM({
 *   systemPrompt: "你是一名导演...",
 *   prompt: "请分析以下剧本...",
 *   temperature: 0.7,
 * });
 */
export async function callLLM(options: LLMCallOptions): Promise<string> {
  const {
    prompt,
    systemPrompt,
    model = "claude-sonnet-4-6",
    maxTokens = 8192,
    temperature = 0.7,
    responseFormat,
  } = options;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: prompt });

  return callLQChat({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    response_format: responseFormat,
  });
}

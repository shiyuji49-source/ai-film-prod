/**
 * API 设置路由
 * 支持用户自定义 AI 提供商、模型、API Key
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { apiSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// 支持的提供商配置
export const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview (推荐)" },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
  },
  openai: {
    name: "OpenAI / ChatGPT",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4.1", name: "GPT-4.1" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "o3-mini", name: "o3-mini" },
    ],
  },
  anthropic: {
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    models: [
      { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (推荐)" },
      { id: "claude-haiku-3-5", name: "Claude Haiku 3.5" },
    ],
  },
  kimi: {
    name: "Kimi (月之暗面)",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
      { id: "moonshot-v1-32k", name: "Moonshot v1 32K" },
      { id: "moonshot-v1-8k", name: "Moonshot v1 8K" },
    ],
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat (V3)" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)" },
    ],
  },
  custom: {
    name: "自定义（OpenAI 兼容）",
    baseUrl: "",
    models: [],
  },
} as const;

export type ProviderKey = keyof typeof PROVIDERS;

export const apiSettingsRouter = router({
  // 获取当前用户的 API 设置
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { setting: null, providers: PROVIDERS };

    const [setting] = await db
      .select()
      .from(apiSettings)
      .where(eq(apiSettings.userId, ctx.user.id))
      .limit(1);

    return {
      setting: setting ?? null,
      providers: PROVIDERS,
    };
  }),

  // 保存 API 设置
  save: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        apiKey: z.string().optional(),
        apiBaseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");

      const existing = await db
        .select({ id: apiSettings.id })
        .from(apiSettings)
        .where(eq(apiSettings.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(apiSettings)
          .set({
            provider: input.provider,
            model: input.model,
            apiKey: input.apiKey || null,
            apiBaseUrl: input.apiBaseUrl || null,
            lastTestStatus: "untested",
          })
          .where(eq(apiSettings.userId, ctx.user.id));
      } else {
        await db.insert(apiSettings).values({
          userId: ctx.user.id,
          provider: input.provider,
          model: input.model,
          apiKey: input.apiKey || null,
          apiBaseUrl: input.apiBaseUrl || null,
          lastTestStatus: "untested",
        });
      }

      return { success: true };
    }),

  // 测试 API 连接
  test: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        model: z.string(),
        apiKey: z.string().optional(),
        apiBaseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const startTime = Date.now();
      let status: "ok" | "error" = "error";
      let message = "";
      let latencyMs = 0;

      try {
        const provider = input.provider as ProviderKey;
        const apiKey = input.apiKey;
        const baseUrl =
          input.apiBaseUrl ||
          (PROVIDERS[provider] as { baseUrl: string })?.baseUrl ||
          "";

        if (!apiKey) {
          return {
            status: "error" as const,
            message: "请填写 API Key",
            latencyMs: 0,
          };
        }

        let testUrl = "";
        let testBody = {};
        let headers: Record<string, string> = { "Content-Type": "application/json" };

        if (provider === "gemini") {
          testUrl = `${baseUrl}/models/${input.model}:generateContent?key=${apiKey}`;
          testBody = {
            contents: [{ parts: [{ text: "Hi" }] }],
            generationConfig: { maxOutputTokens: 5 },
          };
        } else if (provider === "anthropic") {
          testUrl = `${baseUrl}/messages`;
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
          testBody = {
            model: input.model,
            max_tokens: 5,
            messages: [{ role: "user", content: "Hi" }],
          };
        } else {
          // OpenAI-compatible (openai, kimi, deepseek, custom)
          testUrl = `${baseUrl}/chat/completions`;
          headers["Authorization"] = `Bearer ${apiKey}`;
          testBody = {
            model: input.model,
            max_tokens: 5,
            messages: [{ role: "user", content: "Hi" }],
          };
        }

        const res = await fetch(testUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(testBody),
          signal: AbortSignal.timeout(15000),
        });

        latencyMs = Date.now() - startTime;

        if (res.ok) {
          status = "ok";
          message = `连接成功，响应时间 ${latencyMs}ms`;
        } else {
          const errText = await res.text();
          let errMsg = "";
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson?.error?.message || errJson?.message || errText.slice(0, 100);
          } catch {
            errMsg = errText.slice(0, 100);
          }
          message = `HTTP ${res.status}: ${errMsg}`;
        }
      } catch (e: unknown) {
        latencyMs = Date.now() - startTime;
        message = e instanceof Error ? e.message : "连接超时或网络错误";
      }

      // 更新测试状态到数据库
      if (db) {
        try {
          await db
            .update(apiSettings)
            .set({ lastTestStatus: status, lastTestedAt: new Date() })
            .where(eq(apiSettings.userId, ctx.user.id));
        } catch {
          // 忽略数据库更新失败
        }
      }

      return { status, message, latencyMs };
    }),

  // 保存 Fal.ai API Key
  saveFalKey: protectedProcedure
    .input(z.object({ falApiKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const existing = await db
        .select({ id: apiSettings.id })
        .from(apiSettings)
        .where(eq(apiSettings.userId, ctx.user.id))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(apiSettings)
          .set({ falApiKey: input.falApiKey || null })
          .where(eq(apiSettings.userId, ctx.user.id));
      } else {
        await db.insert(apiSettings).values({
          userId: ctx.user.id,
          provider: "gemini",
          model: "gemini-3-flash-preview",
          falApiKey: input.falApiKey || null,
          lastTestStatus: "untested",
        });
      }
      return { success: true };
    }),

  // 获取 Fal.ai API Key 配置状态（仅返回是否已配置，不返回明文）
  getFalKeyStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { configured: false };
    const [setting] = await db
      .select({ falApiKey: apiSettings.falApiKey })
      .from(apiSettings)
      .where(eq(apiSettings.userId, ctx.user.id))
      .limit(1);
    return { configured: !!(setting?.falApiKey) };
  }),
});

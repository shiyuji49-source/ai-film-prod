import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { overseasProjects, scriptShots, videoJobs, overseasAssets, apiSettings } from "../../drizzle/schema";
import { eq, and, desc, asc, isNull, isNotNull } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import * as XLSX from "xlsx";
import {
  createSeedanceVideo, querySeedanceTask,
  createVideo, queryVideoTask,
  callClaudeSonnet, callClaudeOpus,
  generateNanoBananaImage,
  generateSeedreamImage,
} from "../lib/vectorengine";
import { ENV } from "../_core/env";
import pLimit from "p-limit";

// ─── 项目 CRUD ────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(128),
  market: z.string().default("us"),
  aspectRatio: z.enum(["landscape", "portrait"]).default("portrait"),
  style: z.enum(["realistic", "animation", "cg"]).default("realistic"),
  genre: z.string().default("romance"),
  totalEpisodes: z.number().int().min(1).max(100).default(20),
});

const VIDEO_ENGINE_ENUM = z.enum(["seedance_1_5", "veo_3_1", "kling_3_0", "kling_3_0_omni", "runway_gen4", "hailuo_2_3", "grok_video_3", "sora_2_pro", "wan2_6"]);

const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.number().int(),
  characters: z.string().optional(),
  scenes: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  imageEngine: z.string().optional(),
  videoEngine: VIDEO_ENGINE_ENUM.optional(),
});

// ─── 剧本解析 ─────────────────────────────────────────────────────────────────

const parseScriptSchema = z.object({
  projectId: z.number().int(),
  episodeNumber: z.number().int().min(1),
  scriptText: z.string().min(10),
  language: z.string().default("en"),
});

// ─── 首尾帧生成 ───────────────────────────────────────────────────────────────

const generateFrameSchema = z.object({
  shotId: z.number().int(),
  frameType: z.enum(["first", "last"]),
  imageEngine: z.string().optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  subjectRefUrls: z.array(z.string().url()).max(4).optional(),
});

// ─── 视频生成 ─────────────────────────────────────────────────────────────────

const generateVideoSchema = z.object({
  shotId: z.number().int(),
  engine: VIDEO_ENGINE_ENUM.default("seedance_1_5"),
  // Seedance 1.5 Pro 支持 4-12 秒，其他模型支持 2-15 秒
  duration: z.number().int().min(2).max(15).default(5),
  // Seedance 1.5 Pro 支持 21:9/16:9/4:3/1:1/3:4/9:16/auto
  aspectRatio: z.string().default("9:16"),
  // Seedance 1.5 Pro 分辨率：480p/720p/1080p
  resolution: z.enum(["480p", "720p", "1080p"]).default("1080p"),
  // Seedance 1.5 Pro 智能时长模式
  smartDuration: z.boolean().default(false),
  generateAudio: z.boolean().default(true),
  useLastFrame: z.boolean().default(false),
  referenceImageUrls: z.array(z.string().url()).max(4).optional(),
  subjectRefUrls: z.array(z.string().url()).max(4).optional(),
});

// ─── 批量跑量 ─────────────────────────────────────────────────────────────────

const batchRunSchema = z.object({
  projectId: z.number().int(),
  episodeNumbers: z.array(z.number().int()).min(1).max(30),
  engine: VIDEO_ENGINE_ENUM.default("seedance_1_5"),
  aspectRatio: z.string().default("9:16"),
  resolution: z.enum(["480p", "720p", "1080p"]).default("1080p"),
  smartDuration: z.boolean().default(false),
  duration: z.number().int().min(2).max(15).default(5),
  generateAudio: z.boolean().default(true),
  skipExisting: z.boolean().default(true),
  mode: z.enum(["image", "video", "both"]).default("both"),
});

// ─── 统一视频生成辅助函数 (via VectorEngine) ──────────────────────────────

// Supported video engines mapped to VectorEngine models
const ENGINE_TO_MODEL: Record<string, string> = {
  "seedance_1_5": "doubao-seedance-1-5-pro-251215",
  "veo_3_1": "veo-3.1-4k",
  "kling_3_0": "kling-3.0",
  "kling_3_0_omni": "kling-3.0-omni",
  "runway_gen4": "runway-gen4",
  "hailuo_2_3": "hailuo-2.3",
  "grok_video_3": "grok-video-3-15s",
  "sora_2_pro": "sora-2-pro",
  "wan2_6": "wan2.6-i2v",
};

/** Generate video via Seedance 1.5 Pro (VectorEngine → 豆包视频) */
async function generateSeedance15Video(params: {
  prompt: string;
  imageUrl: string;
  lastFrameUrl?: string;
  aspectRatio: string;
  resolution?: "480p" | "720p" | "1080p";
  duration: number;
  smartDuration?: boolean;
  generateAudio?: boolean;
}): Promise<string> {
  const { prompt, imageUrl, lastFrameUrl, aspectRatio, resolution = "1080p", duration, smartDuration = false } = params;

  // 自动重试：Seedance API 偶发 503（无可用渠道），最多重试 3 次，间隔 10 秒
  let result: { id: string; status: string } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await createSeedanceVideo({
        prompt,
        imageUrl,
        lastFrameUrl,
        ratio: aspectRatio || "9:16",
        resolution,
        duration,
        smartDuration,
        watermark: false,
      });
      break; // 成功则跳出重试循环
    } catch (err: any) {
      const is503 = err?.message?.includes("503") || err?.message?.includes("无可用渠道") || err?.message?.includes("No available channels");
      if (!is503 || attempt >= 2) throw err;
      console.warn(`[Seedance] 503 on attempt ${attempt + 1}, retrying in 10s...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  if (!result) throw new Error("Seedance failed after retries");

  const taskId = result.id;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await querySeedanceTask(taskId);
    if (status.status === "succeeded" || status.status === "completed") {
      const videoUrl = status.content?.video_url || status.video_url || status.output?.video_url;
      if (videoUrl) return videoUrl;
    }
    if (status.status === "failed") {
      throw new Error(`Seedance 1.5 failed: ${status.error || "unknown error"}`);
    }
  }
  throw new Error("Seedance 1.5 video generation timed out");
}

/** Generate video via unified VectorEngine video API (Veo, Grok, Wan, Sora) */
async function generateUnifiedVideo(params: {
  prompt: string;
  imageUrl: string;
  model: string;
  referenceImage?: string;
  aspectRatio?: string;
}): Promise<string> {
  const { prompt, imageUrl, model, referenceImage, aspectRatio } = params;
  const result = await createVideo({
    model: model as any,
    prompt,
    imageUrl,
    referenceImage,
    aspectRatio,
  });

  const taskId = result.id;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await queryVideoTask(taskId);
    if (status.status === "completed" || status.status === "succeeded") {
      const videoUrl = status.output?.video_url || status.video_url;
      if (videoUrl) return videoUrl;
    }
    if (status.status === "failed") {
      throw new Error(`${model} failed: ${status.error || "unknown error"}`);
    }
  }
  throw new Error(`${model} video generation timed out`);
}

/** Legacy wrapper: generateKling3Video now routes through VectorEngine (Wan 2.6) */
async function generateKling3Video(params: {
  prompt: string;
  imageUrl: string;
  lastFrameUrl?: string;
  elementImageUrls?: string[];
  aspectRatio: string;
  duration: number;
  falApiKey?: string;
}): Promise<string> {
  return generateUnifiedVideo({
    prompt: params.prompt,
    imageUrl: params.imageUrl,
    model: "wan2.6-i2v",
    referenceImage: params.elementImageUrls?.[0],
    aspectRatio: params.aspectRatio === "portrait" ? "9:16" : "16:9",
  });
}

/** Legacy wrapper: generateVeo31Video now routes through VectorEngine */
async function generateVeo31Video(params: {
  prompt: string;
  imageUrl: string;
  lastFrameUrl?: string;
  aspectRatio: string;
  duration: number;
  referenceImageUrls?: string[];
  geminiKey?: string;
}): Promise<string> {
  return generateUnifiedVideo({
    prompt: params.prompt,
    imageUrl: params.imageUrl,
    model: "veo-3.1-4k",
    referenceImage: params.referenceImageUrls?.[0],
    aspectRatio: params.aspectRatio === "portrait" ? "9:16" : "16:9",
  });
}


/**
 * 统一图片生成：优先 VectorEngine nano-banana-pro (Gemini 3 Pro Image)
 * 当 nano-banana-pro 不可用时，自动 fallback 到 Seedream 5.0（火山引擎）
 * 返回 S3 URL（已上传）
 */
async function generateVEImage(params: {
  prompt: string;
  imageUrl?: string;   // 参考图 URL
  aspectRatio?: string; // e.g. "9:16" | "16:9" | "1:1"
  s3KeyPrefix?: string;
  userId?: number;
  assetId?: number;
}): Promise<string> {
  const { prompt, imageUrl, aspectRatio, s3KeyPrefix = "generated", userId, assetId } = params;

  let rawUrl: string | undefined;

  // 尝试 nano-banana-pro（Gemini 3 Pro Image via VectorEngine）
  try {
    const results = await generateNanoBananaImage({ prompt, imageUrl, aspectRatio });
    rawUrl = results[0]?.url;
  } catch (err: any) {
    // 无可用渠道时 fallback 到 Seedream 5.0
    const isUnavailable = err?.message?.includes("503") || err?.message?.includes("无可用渠道") || err?.message?.includes("No available channels");
    if (!isUnavailable) throw err;
    console.warn("[generateVEImage] nano-banana-pro unavailable, falling back to Seedream 5.0");
    const fallbackResults = await generateSeedreamImage({
      model: "doubao-seedream-5-0-260128",
      prompt,
      image: imageUrl,
      size: aspectRatio === "9:16" ? "2K" : "2K",
      watermark: false,
    });
    rawUrl = fallbackResults[0]?.url;
  }

  if (!rawUrl) throw new Error("Image generation returned no URL");

  // 上传到 S3
  const keyParts = [s3KeyPrefix];
  if (userId) keyParts.push(String(userId));
  if (assetId) keyParts.push(String(assetId));

  let buf: Buffer;
  let mimeType = "image/jpeg";

  if (rawUrl.startsWith("data:")) {
    // base64 data URL（Gemini 3 Pro Image 返回格式）
    const base64Match = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) throw new Error("Invalid base64 data URL");
    mimeType = base64Match[1];
    buf = Buffer.from(base64Match[2], "base64");
  } else {
    // 普通 URL，下载图片
    const resp = await fetch(rawUrl);
    if (!resp.ok) throw new Error(`Failed to download generated image: ${resp.status}`);
    buf = Buffer.from(await resp.arrayBuffer());
  }

  const ext = mimeType === "image/png" ? "png" : "jpg";
  keyParts.push(`${nanoid(10)}.${ext}`);
  const { url: s3Url } = await storagePut(keyParts.join("/"), buf, mimeType);
  return s3Url;
}

export const overseasRouter = router({
  // ── 列出所有项目 ──────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const rows = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(and(eq(overseasProjects.userId, ctx.user.id), eq(overseasProjects.isDeleted, false)))
      .orderBy(desc(overseasProjects.updatedAt));
    return rows;
  }),

  // ── 创建项目 ──────────────────────────────────────────────────────────────
  createProject: protectedProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
    const [result] = await (await getDb())!.insert(overseasProjects).values({
      userId: ctx.user.id,
      name: input.name,
      market: input.market,
      aspectRatio: input.aspectRatio,
      style: input.style,
      genre: input.genre,
      totalEpisodes: input.totalEpisodes,
      status: "draft",
    });
    const id = (result as any).insertId as number;
    const [project] = await (await getDb())!.select().from(overseasProjects).where(eq(overseasProjects.id, id));
    return project;
  }),

  // ── 更新项目 ──────────────────────────────────────────────────────────────
  updateProject: protectedProcedure.input(updateProjectSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    await (await getDb())!
      .update(overseasProjects)
      .set(rest)
      .where(and(eq(overseasProjects.id, id), eq(overseasProjects.userId, ctx.user.id)));
    const [project] = await (await getDb())!.select().from(overseasProjects).where(eq(overseasProjects.id, id));
    return project;
  }),

  // ── 删除项目 ──────────────────────────────────────────────────────────────
  deleteProject: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    await (await getDb())!
      .update(overseasProjects)
      .set({ isDeleted: true })
      .where(and(eq(overseasProjects.id, input.id), eq(overseasProjects.userId, ctx.user.id)));
    return { success: true };
  }),

  // ── 获取单个项目（含分镜） ────────────────────────────────────────────────
  getProject: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const [project] = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(and(eq(overseasProjects.id, input.id), eq(overseasProjects.userId, ctx.user.id)));
    if (!project) throw new Error("Project not found");

    const shots = await (await getDb())!
      .select()
      .from(scriptShots)
      .where(and(eq(scriptShots.projectId, input.id), eq(scriptShots.userId, ctx.user.id)))
      .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);

    return { project, shots };
  }),

  // ── 获取项目进度统计 ──────────────────────────────────────────────────────
  getProjectProgress: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const shots = await (await getDb())!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.projectId, input.projectId), eq(scriptShots.userId, ctx.user.id)));

      // 按集分组统计
      const byEpisode: Record<number, {
        total: number; draft: number; framesDone: number; videoDone: number; failed: number;
      }> = {};

      for (const shot of shots) {
        const ep = shot.episodeNumber;
        if (!byEpisode[ep]) byEpisode[ep] = { total: 0, draft: 0, framesDone: 0, videoDone: 0, failed: 0 };
        byEpisode[ep].total++;
        if (shot.status === "draft" || shot.status === "generating_frame") byEpisode[ep].draft++;
        else if (shot.status === "frame_done" || shot.status === "generating_video") byEpisode[ep].framesDone++;
        else if (shot.status === "done") byEpisode[ep].videoDone++;
        else if (shot.status === "failed") byEpisode[ep].failed++;
      }

      const totalShots = shots.length;
      const doneShots = shots.filter((s) => s.status === "done").length;
      const framesDoneShots = shots.filter((s) => s.firstFrameUrl).length;
      const failedShots = shots.filter((s) => s.status === "failed").length;

      return {
        totalShots,
        doneShots,
        framesDoneShots,
        failedShots,
        byEpisode,
        overallProgress: totalShots > 0 ? Math.round((doneShots / totalShots) * 100) : 0,
      };
    }),

  // ── AI 解析剧本，生成分镜表 ───────────────────────────────────────────────
  parseScript: protectedProcedure.input(parseScriptSchema).mutation(async ({ ctx, input }) => {
    const { projectId, episodeNumber, scriptText, language } = input;

    const [project] = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
    if (!project) throw new Error("Project not found");

    const aspectLabel = project.aspectRatio === "portrait" ? "vertical 9:16" : "horizontal 16:9";
    const langLabel = language === "en" ? "English" : language === "zh" ? "Chinese" : language;

    const systemPrompt = `You are a professional short drama director and script breakdown specialist.
Your task is to analyze a short drama script and break it down into individual shots for AI video generation.

Rules:
- Generate 20-30 shots per episode maximum. Do NOT invent shots not in the script.
- Each shot should be 4-8 seconds of video content
- All dialogue/narration must be in ${langLabel}
- Visual descriptions must be detailed enough for AI image generation
- Style: ${project.style} (photorealistic for realistic, etc.)
- Aspect ratio: ${aspectLabel}
- Genre: ${project.genre}
- NO background music, NO subtitles in visual descriptions
- Strictly follow the script content, do not add scenes not in the script`;

    const userPrompt = `Analyze this Episode ${episodeNumber} script and generate a shot breakdown:

${scriptText}

Return a JSON array of shots with this exact schema:
[
  {
    "shotNumber": 1,
    "sceneName": "Scene name",
    "shotType": "close_up|medium|wide|extreme_close|aerial|over_shoulder",
    "visualDescription": "Detailed English description of what's in the frame for AI image generation. Include: subject, action, setting, lighting, camera angle, mood. No subtitles, no background music.",
    "dialogue": "Character dialogue or narration in ${langLabel}, or empty string if none",
    "characters": "comma-separated character names in this shot",
    "emotion": "emotional tone: tense|romantic|dramatic|comedic|mysterious|action|sad|happy"
  }
]

Important: Return ONLY the JSON array, no markdown, no explanation.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "shot_breakdown",
          strict: true,
          schema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                shotNumber: { type: "integer" },
                sceneName: { type: "string" },
                shotType: { type: "string" },
                visualDescription: { type: "string" },
                dialogue: { type: "string" },
                characters: { type: "string" },
                emotion: { type: "string" },
              },
              required: ["shotNumber", "sceneName", "shotType", "visualDescription", "dialogue", "characters", "emotion"],
              additionalProperties: false,
            },
          },
        },
      },
    });

    const content = response.choices[0].message.content as string;
    let shots: Array<{
      shotNumber: number;
      sceneName: string;
      shotType: string;
      visualDescription: string;
      dialogue: string;
      characters: string;
      emotion: string;
    }>;

    try {
      shots = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    await (await getDb())!
      .delete(scriptShots)
      .where(
        and(
          eq(scriptShots.projectId, projectId),
          eq(scriptShots.userId, ctx.user.id),
          eq(scriptShots.episodeNumber, episodeNumber)
        )
      );

    if (shots.length > 0) {
      await (await getDb())!.insert(scriptShots).values(
        shots.map((s) => ({
          projectId,
          userId: ctx.user.id,
          episodeNumber,
          shotNumber: s.shotNumber,
          sceneName: s.sceneName,
          shotType: s.shotType,
          visualDescription: s.visualDescription,
          dialogue: s.dialogue,
          characters: s.characters,
          emotion: s.emotion,
          status: "draft" as const,
        }))
      );
    }

    const insertedShots = await (await getDb())!
      .select()
      .from(scriptShots)
      .where(
        and(
          eq(scriptShots.projectId, projectId),
          eq(scriptShots.userId, ctx.user.id),
          eq(scriptShots.episodeNumber, episodeNumber)
        )
      )
      .orderBy(scriptShots.shotNumber);

    return { shots: insertedShots, count: insertedShots.length };
  }),

  // ── 生成首帧或尾帧图片（支持 Seedream 4.5/5.0 + VE Gemini 3 Pro Image） ──────────────
  generateFrame: protectedProcedure.input(generateFrameSchema).mutation(async ({ ctx, input }) => {
    const { shotId, frameType, referenceImageUrls, imageEngine, subjectRefUrls } = input;

    const [shot] = await (await getDb())!
      .select()
      .from(scriptShots)
      .where(and(eq(scriptShots.id, shotId), eq(scriptShots.userId, ctx.user.id)));
    if (!shot) throw new Error("Shot not found");

    const [project] = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(eq(overseasProjects.id, shot.projectId));
    if (!project) throw new Error("Project not found");

    const aspectRatio = project.aspectRatio === "portrait" ? "9:16" : "16:9";
    const aspectLabel = project.aspectRatio === "portrait" ? "9:16 vertical portrait" : "16:9 horizontal landscape";
    const isLastFrame = frameType === "last";
    // 选择图片引擎：优先 input > shot > project > 默认 Seedream 4.5
    const chosenEngine = imageEngine || shot.imageEngine || project.imageEngine || "doubao-seedream-4-5-251128";
    const isSeedream = chosenEngine.startsWith("doubao-seedream");

    const styleMap: Record<string, string> = {
      realistic: "photorealistic, cinematic, real human, 8K, film grain",
      animation: "2D animation, cel-shaded, clean lines, vibrant colors",
      cg: "3D CGI, Unreal Engine 5, hyper-detailed, ray tracing",
    };
    const styleKw = styleMap[project.style] ?? "photorealistic, cinematic";

    // 生成帧提示词（针对不同模型优化）
    const framePromptResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert AI image prompt writer for ${project.style} short drama production.
Generate a detailed, cinematic image prompt for the ${isLastFrame ? "final/ending" : "opening/starting"} frame.
Style: ${styleKw}
Aspect ratio: ${aspectLabel}
Rules:
- Describe exact visual composition: subject position, pose, facial expression, action
- Include environment/background, lighting quality, color palette, atmosphere
- Specify camera angle and framing (close-up, medium shot, wide, etc.)
- For characters: describe clothing, hair, appearance details
- NO subtitles, NO text overlays, NO watermarks, NO background music
- Write in flowing descriptive English prose (NOT keyword lists)
- Keep under 100 words`,
        },
        {
          role: "user",
          content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the ${isLastFrame ? "LAST frame (final frozen moment before cut, emotional peak or resolution)" : "FIRST frame (opening composition as shot begins, establishing mood and positioning)"} prompt.
Return ONLY the prompt text.`,
        },
      ],
    });

    const framePrompt = (framePromptResponse.choices[0].message.content as string).trim();

    // 合并参考图（subjectRefUrls 优先）
    const allRefUrls = [...(subjectRefUrls ?? []), ...(referenceImageUrls ?? [])];
    const refImageUrl = allRefUrls.length > 0 ? allRefUrls[0] : undefined;

    let s3Url: string;

    if (isSeedream) {
      // 火山引擎 Seedream（即梦）生成帧
      const seedreamResults = await generateSeedreamImage({
        model: chosenEngine as any,
        prompt: framePrompt,
        image: refImageUrl,
        size: "2K",
        watermark: false,
      });
      const rawUrl = seedreamResults[0]?.url;
      if (!rawUrl) throw new Error("Seedream returned no URL");
      const resp = await fetch(rawUrl);
      const buf = Buffer.from(await resp.arrayBuffer());
      const key = `frames/${ctx.user.id}/${shot.id}-${frameType}-${nanoid(8)}.jpg`;
      const { url } = await storagePut(key, buf, "image/jpeg");
      s3Url = url;
    } else {
      // VectorEngine (nano-banana-pro / Gemini 3 Pro Image)
      s3Url = await generateVEImage({
        prompt: framePrompt,
        imageUrl: refImageUrl,
        aspectRatio,
        s3KeyPrefix: "frames",
        userId: ctx.user.id,
      });
    }

    if (frameType === "first") {
      await (await getDb())!
        .update(scriptShots)
        .set({ firstFrameUrl: s3Url, firstFramePrompt: framePrompt, status: "frame_done", imageEngine: chosenEngine })
        .where(eq(scriptShots.id, shotId));
    } else {
      await (await getDb())!
        .update(scriptShots)
        .set({ lastFrameUrl: s3Url, lastFramePrompt: framePrompt })
        .where(eq(scriptShots.id, shotId));
    }

    return { url: s3Url, prompt: framePrompt };
  }),

  // ── 生成视频  // ── 生成视频提示词（针对 Seedance 1.5 Pro 优化） ────────────────────────────────────────────
  generateVideoPrompt: protectedProcedure
    .input(z.object({ shotId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const [shot] = await (await getDb())!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");

      const [project] = await (await getDb())!
        .select()
        .from(overseasProjects)
        .where(eq(overseasProjects.id, shot.projectId));

      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human actors",
        animation: "2D animation style",
        cg: "3D CGI, Unreal Engine quality",
      };
      const styleKw = styleMap[project?.style ?? "realistic"] ?? "photorealistic, cinematic";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro), a state-of-the-art text-to-video model.
Seedance 1.5 Pro excels at:
- Smooth, natural character movement and expressions
- Cinematic camera work (dolly, pan, tilt, zoom)
- Consistent character appearance across frames
- Realistic physics and lighting

Write prompts that:
1. Start with the main subject and their action (what they're doing RIGHT NOW)
2. Describe the camera movement explicitly
3. Include lighting and atmosphere
4. Keep it 2-3 sentences, under 80 words
5. NO background music descriptions, NO subtitles, NO watermarks
Style: ${styleKw}`,
          },
          {
            role: "user",
            content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion/mood: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt for this shot.
${shot.dialogue ? `The character should be speaking the dialogue: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
          },
        ],
      });

      const videoPrompt = (response.choices[0].message.content as string).trim();

      await (await getDb())!
        .update(scriptShots)
        .set({ videoPrompt })
        .where(eq(scriptShots.id, input.shotId));

      return { videoPrompt };
    }),

  // ── 触发视频生成（支持 Kling 3.0 / Seedance 1.5 / Veo 3.1） ─────────────
  generateVideo: protectedProcedure.input(generateVideoSchema).mutation(async ({ ctx, input }) => {
    const { shotId, engine, duration, aspectRatio, resolution, smartDuration, generateAudio, useLastFrame, referenceImageUrls } = input;

    const [shot] = await (await getDb())!
      .select()
      .from(scriptShots)
      .where(and(eq(scriptShots.id, shotId), eq(scriptShots.userId, ctx.user.id)));
    if (!shot) throw new Error("Shot not found");
    if (!shot.firstFrameUrl) throw new Error("First frame image is required before generating video");
    if (!shot.videoPrompt) throw new Error("Video prompt is required. Generate it first.");

    await (await getDb())!
      .update(scriptShots)
      .set({ status: "generating_video", videoEngine: engine })
      .where(eq(scriptShots.id, shotId));

    const [jobResult] = await (await getDb())!.insert(videoJobs).values({
      userId: ctx.user.id,
      shotId,
      engine,
      status: "pending",
    });
    const jobId = (jobResult as any).insertId as number;

    try {
      let videoUrl: string;

      // All video generation now goes through VectorEngine
      await (await getDb())!.update(videoJobs).set({ status: "processing" }).where(eq(videoJobs.id, jobId));

      if (engine === "seedance_1_5") {
        videoUrl = await generateSeedance15Video({
          prompt: shot.videoPrompt,
          imageUrl: shot.firstFrameUrl,
          lastFrameUrl: useLastFrame && shot.lastFrameUrl ? shot.lastFrameUrl : undefined,
          aspectRatio,
          resolution: resolution as "480p" | "720p" | "1080p" | undefined,
          duration,
          smartDuration,
          generateAudio,
        });
      } else {
        // All other engines (veo_3_1, kling_3_0, grok_video_3, sora_2_pro, etc.)
        const model = ENGINE_TO_MODEL[engine] || "veo-3.1-4k";
        videoUrl = await generateUnifiedVideo({
          prompt: shot.videoPrompt,
          imageUrl: shot.firstFrameUrl,
          model,
          referenceImage: referenceImageUrls?.[0],
          aspectRatio,
        });
      }

      // 下载视频并上传到 S3
      const videoResp = await fetch(videoUrl);
      const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
      const videoKey = `overseas/${ctx.user.id}/videos/${shotId}-${nanoid(8)}.mp4`;
      const { url: s3VideoUrl } = await storagePut(videoKey, videoBuffer, "video/mp4");

      await (await getDb())!
        .update(scriptShots)
        .set({ videoUrl: s3VideoUrl, videoDuration: duration, status: "done" })
        .where(eq(scriptShots.id, shotId));
      await (await getDb())!
        .update(videoJobs)
        .set({ videoUrl: s3VideoUrl, status: "done" })
        .where(eq(videoJobs.id, jobId));

      return { videoUrl: s3VideoUrl };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await (await getDb())!
        .update(scriptShots)
        .set({ status: "failed", errorMessage })
        .where(eq(scriptShots.id, shotId));
      await (await getDb())!
        .update(videoJobs)
        .set({ status: "failed", errorMessage })
        .where(eq(videoJobs.id, jobId));
      throw err;
    }
  }),

  // ── 一键批量跑量（Agent 流水线：首帧→视频提示词→视频） ───────────────────
  batchRun: protectedProcedure.input(batchRunSchema).mutation(async ({ ctx, input }) => {
    const { projectId, episodeNumbers, engine, aspectRatio, resolution, smartDuration, duration, generateAudio, skipExisting, mode } = input;
    const doImage = mode === "image" || mode === "both";
    const doVideo = mode === "video" || mode === "both";

    const [project] = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
    if (!project) throw new Error("Project not found");

    // 获取全局参考资产（isGlobalRef = true）
    const globalAssets = await (await getDb())!
      .select()
      .from(overseasAssets)
      .where(
        and(
          eq(overseasAssets.projectId, projectId),
          eq(overseasAssets.userId, ctx.user.id),
          eq(overseasAssets.isGlobalRef, true)
        )
      )
      .orderBy(asc(overseasAssets.sortOrder));

    // 全局参考图 URLs（优先使用 mainImageUrl，其次 mjImageUrl）
    const globalRefUrls = globalAssets
      .map((a) => a.mainImageUrl || a.mjImageUrl)
      .filter(Boolean) as string[];

    // All video generation now goes through VectorEngine - no external API keys needed

    // 获取所有待处理的分镜
    const allShots = await (await getDb())!
      .select()
      .from(scriptShots)
      .where(
        and(
          eq(scriptShots.projectId, projectId),
          eq(scriptShots.userId, ctx.user.id)
        )
      )
      .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);

    const targetShots = allShots.filter((s) => episodeNumbers.includes(s.episodeNumber));

    // 过滤：跳过已完成的
    const shotsToProcess = skipExisting
      ? targetShots.filter((s) => s.status !== "done")
      : targetShots;

    let processed = 0;
    let failed = 0;
    const errors: Array<{ shotId: number; episodeNumber: number; shotNumber: number; error: string }> = [];

    // 并发处理（图片生成：3并发；视频生成：2并发，避免限流）
    // 图片生成和视频生成使用不同的并发限制
    const imageLimit = pLimit(3);  // Seedream/VE 图片生成：3并发
    const videoLimit = pLimit(2);  // 视频生成：2并发（API 限流较严）

    // 第一阶段：并发生成首帧图片
    if (doImage) {
      await Promise.all(
        shotsToProcess.map((shot) =>
          imageLimit(async () => {
            if (shot.firstFrameUrl) return; // 已有首帧，跳过
            try {
              await (await getDb())!
                .update(scriptShots)
                .set({ status: "generating_frame" })
                .where(eq(scriptShots.id, shot.id));

              const batchStyleMap: Record<string, string> = {
                realistic: "photorealistic, cinematic, real human, 8K, film grain",
                animation: "2D animation, cel-shaded, clean lines, vibrant colors",
                cg: "3D CGI, Unreal Engine 5, hyper-detailed, ray tracing",
              };
              const batchStyleKw = batchStyleMap[project.style] ?? "photorealistic, cinematic";
              const batchAspectLabel = project.aspectRatio === "portrait" ? "9:16 vertical portrait" : "16:9 horizontal landscape";

              const framePromptResponse = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `You are an expert AI image prompt writer for ${project.style} short drama production.
Generate a detailed, cinematic image prompt for the FIRST frame (opening composition).
Style: ${batchStyleKw}
Aspect ratio: ${batchAspectLabel}
Rules:
- Describe exact visual composition: subject position, pose, facial expression, action
- Include environment/background, lighting quality, color palette, atmosphere
- Specify camera angle and framing
- For characters: describe clothing, hair, appearance details
- NO subtitles, NO text overlays, NO watermarks
- Write in flowing descriptive English prose (NOT keyword lists)
- Keep under 100 words`,
                  },
                  {
                    role: "user",
                    content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the FIRST frame (opening composition as shot begins, establishing mood and positioning) prompt.
Return ONLY the prompt text.`,
                  },
                ],
              });

              const framePrompt = (framePromptResponse.choices[0].message.content as string).trim();

              const batchImageEngine = project.imageEngine || "doubao-seedream-4-5-251128";
              const batchIsSeedream = batchImageEngine.startsWith("doubao-seedream");
              const batchRefUrl = globalRefUrls.length > 0 ? globalRefUrls[0] : undefined;
              const batchAspectRatio = project.aspectRatio === "portrait" ? "9:16" : "16:9";

              let frameS3Url: string;
              if (batchIsSeedream) {
                const seedreamResults = await generateSeedreamImage({
                  model: batchImageEngine as any,
                  prompt: framePrompt,
                  image: batchRefUrl,
                  size: "2K",
                  watermark: false,
                });
                const rawUrl = seedreamResults[0]?.url;
                if (!rawUrl) throw new Error("Seedream returned no URL");
                const resp = await fetch(rawUrl);
                const buf = Buffer.from(await resp.arrayBuffer());
                const key = `frames/${ctx.user.id}/${shot.id}-first-${nanoid(8)}.jpg`;
                const { url } = await storagePut(key, buf, "image/jpeg");
                frameS3Url = url;
              } else {
                frameS3Url = await generateVEImage({
                  prompt: framePrompt,
                  imageUrl: batchRefUrl,
                  aspectRatio: batchAspectRatio,
                  s3KeyPrefix: "frames",
                  userId: ctx.user.id,
                });
              }

              await (await getDb())!
                .update(scriptShots)
                .set({ firstFrameUrl: frameS3Url, firstFramePrompt: framePrompt, status: "frame_done", imageEngine: batchImageEngine })
                .where(eq(scriptShots.id, shot.id));

              shot.firstFrameUrl = frameS3Url;
              shot.firstFramePrompt = framePrompt;
              shot.status = "frame_done";
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              await (await getDb())!
                .update(scriptShots)
                .set({ status: "failed", errorMessage })
                .where(eq(scriptShots.id, shot.id));
              errors.push({ shotId: shot.id, episodeNumber: shot.episodeNumber, shotNumber: shot.shotNumber, error: `[frame] ${errorMessage}` });
              failed++;
            }
          })
        )
      );
    }

    // 第二阶段：并发生成视频提示词（3并发，LLM 较快）
    if (doVideo) {
      await Promise.all(
        shotsToProcess.map((shot) =>
          imageLimit(async () => {
            if (shot.videoPrompt) return; // 已有提示词，跳过
            const batchVidStyleMap: Record<string, string> = {
              realistic: "photorealistic, cinematic, real human actors",
              animation: "2D animation style",
              cg: "3D CGI, Unreal Engine quality",
            };
            const batchVidStyleKw = batchVidStyleMap[project.style] ?? "photorealistic, cinematic";

            try {
              const vpResponse = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro).
Seedance 1.5 Pro excels at smooth character movement, cinematic camera work, and realistic lighting.
Write prompts that:
1. Start with the main subject and their action (what they're doing RIGHT NOW)
2. Describe the camera movement explicitly
3. Include lighting and atmosphere
4. Keep it 2-3 sentences, under 80 words
5. NO background music, NO subtitles, NO watermarks
Style: ${batchVidStyleKw}`,
                  },
                  {
                    role: "user",
                    content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt.
${shot.dialogue ? `Character speaks: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
                  },
                ],
              });

              const videoPrompt = (vpResponse.choices[0].message.content as string).trim();
              await (await getDb())!
                .update(scriptShots)
                .set({ videoPrompt })
                .where(eq(scriptShots.id, shot.id));
              shot.videoPrompt = videoPrompt;
            } catch (err) {
              // 视频提示词生成失败不影响整体流程，使用 visualDescription 作为备用
              shot.videoPrompt = shot.visualDescription ?? "";
            }
          })
        )
      );
    }

    // 第三阶段：并发生成视频（2并发，视频 API 耗时长且限流严）
    if (doVideo) {
      await Promise.all(
        shotsToProcess
          .filter((s) => !errors.find((e) => e.shotId === s.id)) // 跳过已失败的
          .map((shot) =>
            videoLimit(async () => {
              try {
                if (!shot.firstFrameUrl) {
                  errors.push({ shotId: shot.id, episodeNumber: shot.episodeNumber, shotNumber: shot.shotNumber, error: "[video] No first frame available" });
                  failed++;
                  return;
                }
                await (await getDb())!
                  .update(scriptShots)
                  .set({ status: "generating_video", videoEngine: engine })
                  .where(eq(scriptShots.id, shot.id));

                const [jobResult] = await (await getDb())!.insert(videoJobs).values({
                  userId: ctx.user.id,
                  shotId: shot.id,
                  engine,
                  status: "processing",
                });
                const jobId = (jobResult as any).insertId as number;

                let videoUrl: string;
                if (engine === "seedance_1_5") {
                  videoUrl = await generateSeedance15Video({
                    prompt: shot.videoPrompt ?? shot.visualDescription ?? "",
                    imageUrl: shot.firstFrameUrl!,
                    aspectRatio,
                    resolution: resolution as "480p" | "720p" | "1080p" | undefined,
                    duration,
                    smartDuration,
                    generateAudio,
                  });
                } else {
                  const model = ENGINE_TO_MODEL[engine] || "veo-3.1-4k";
                  videoUrl = await generateUnifiedVideo({
                    prompt: shot.videoPrompt ?? shot.visualDescription ?? "",
                    imageUrl: shot.firstFrameUrl!,
                    model,
                    referenceImage: globalRefUrls.length > 0 ? globalRefUrls[0] : undefined,
                    aspectRatio,
                  });
                }

                const videoResp = await fetch(videoUrl);
                const videoBuffer = Buffer.from(await videoResp.arrayBuffer());
                const videoKey = `overseas/${ctx.user.id}/videos/${shot.id}-${nanoid(8)}.mp4`;
                const { url: s3VideoUrl } = await storagePut(videoKey, videoBuffer, "video/mp4");

                await (await getDb())!
                  .update(scriptShots)
                  .set({ videoUrl: s3VideoUrl, videoDuration: duration, status: "done" })
                  .where(eq(scriptShots.id, shot.id));
                await (await getDb())!
                  .update(videoJobs)
                  .set({ videoUrl: s3VideoUrl, status: "done" })
                  .where(eq(videoJobs.id, jobId));

                processed++;
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                await (await getDb())!
                  .update(scriptShots)
                  .set({ status: "failed", errorMessage })
                  .where(eq(scriptShots.id, shot.id));
                errors.push({ shotId: shot.id, episodeNumber: shot.episodeNumber, shotNumber: shot.shotNumber, error: `[video] ${errorMessage}` });
                failed++;
              }
            })
          )
      );
    } else {
      // 仅图片模式：统计已处理数量
      processed = shotsToProcess.filter((s) => s.firstFrameUrl).length;
    }

    return {
      total: shotsToProcess.length,
      processed,
      failed,
      errors,
    };
  }),

  // ── 获取分镜列表（按集） ──────────────────────────────────────────────────
  listShots: protectedProcedure
    .input(z.object({ projectId: z.number().int(), episodeNumber: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(scriptShots.projectId, input.projectId),
        eq(scriptShots.userId, ctx.user.id),
      ];
      if (input.episodeNumber !== undefined) {
        conditions.push(eq(scriptShots.episodeNumber, input.episodeNumber));
      }
      const shots = await (await getDb())!
        .select()
        .from(scriptShots)
        .where(and(...conditions))
        .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);
      return shots;
    }),

  // ── 更新单个分镜 ──────────────────────────────────────────────────────────
  updateShot: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        visualDescription: z.string().optional(),
        dialogue: z.string().optional(),
        videoPrompt: z.string().optional(),
        shotType: z.string().optional(),
        emotion: z.string().optional(),
        firstFrameUrl: z.string().optional(),
        lastFrameUrl: z.string().optional(),
        firstFramePrompt: z.string().optional(),
        lastFramePrompt: z.string().optional(),
        imageEngine: z.string().optional(),
        videoEngine: VIDEO_ENGINE_ENUM.optional(),
        subjectRefUrls: z.string().optional(),
        videoDuration: z.number().int().optional(),
        status: z.enum(["draft", "generating_frame", "frame_done", "generating_video", "done", "failed"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await (await getDb())!
        .update(scriptShots)
        .set(rest)
        .where(and(eq(scriptShots.id, id), eq(scriptShots.userId, ctx.user.id)));
      const [shot] = await (await getDb())!.select().from(scriptShots).where(eq(scriptShots.id, id));
      return shot;
    }),

  // ── 删除分镜 ──────────────────────────────────────────────────────────────
  deleteShot: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await (await getDb())!
        .delete(scriptShots)
        .where(and(eq(scriptShots.id, input.id), eq(scriptShots.userId, ctx.user.id)));
      return { success: true };
    }),

  // ── 重置分镜状态（用于重新生成） ──────────────────────────────────────────
  resetShot: protectedProcedure
    .input(z.object({ id: z.number().int(), clearVideo: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { status: "draft", errorMessage: null };
      if (input.clearVideo) {
        updateData.videoUrl = null;
        updateData.videoPrompt = null;
        updateData.firstFrameUrl = null;
        updateData.lastFrameUrl = null;
        updateData.firstFramePrompt = null;
        updateData.lastFramePrompt = null;
      }
      await (await getDb())!
        .update(scriptShots)
        .set(updateData)
        .where(and(eq(scriptShots.id, input.id), eq(scriptShots.userId, ctx.user.id)));
      return { success: true };
    }),

  // ══════════════════════════════════════════════════════════════════════════
  // 资产管理（人物 / 场景 / 道具）
  // ══════════════════════════════════════════════════════════════════════════

  listAssets: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      type: z.enum(["character", "scene", "prop", "costume"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const conditions: ReturnType<typeof eq>[] = [
        eq(overseasAssets.projectId, input.projectId),
        eq(overseasAssets.userId, ctx.user.id),
      ];
      if (input.type) conditions.push(eq(overseasAssets.type, input.type));
      return db!.select().from(overseasAssets).where(and(...conditions)).orderBy(asc(overseasAssets.sortOrder), desc(overseasAssets.createdAt));
    }),

  createAsset: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      type: z.enum(["character", "scene", "prop", "costume"]),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [result] = await db!.insert(overseasAssets).values({
        projectId: input.projectId,
        userId: ctx.user.id,
        type: input.type,
        name: input.name,
        description: input.description,
        tags: input.tags,
      });
      const insertId = (result as any).insertId as number;
      const [asset] = await db!.select().from(overseasAssets).where(eq(overseasAssets.id, insertId));
      return asset;
    }),

  updateAsset: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().optional(),
      description: z.string().optional(),
      mjPrompt: z.string().optional(),
      mjImageUrl: z.string().optional(),
      mainImageUrl: z.string().optional(),
      viewFrontUrl: z.string().optional(),
      viewSideUrl: z.string().optional(),
      viewBackUrl: z.string().optional(),
      tags: z.string().optional(),
      isGlobalRef: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const db = await getDb();
      await db!.update(overseasAssets).set(rest).where(
        and(eq(overseasAssets.id, id), eq(overseasAssets.userId, ctx.user.id))
      );
      const [asset] = await db!.select().from(overseasAssets).where(eq(overseasAssets.id, id));
      return asset;
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await (await getDb())!.delete(overseasAssets).where(
        and(eq(overseasAssets.id, input.id), eq(overseasAssets.userId, ctx.user.id))
      );
      return { success: true };
    }),

  generateAssetMjPrompt: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      projectId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [asset] = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.id, input.assetId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (!asset) throw new Error("Asset not found");
      const [project] = await db!.select().from(overseasProjects).where(
        and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id))
      );
      if (!project) throw new Error("Project not found");

      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human, 8K",
        animation: "2D animation style, cel-shaded, vibrant colors",
        cg: "3D CGI render, Unreal Engine, hyper-detailed",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic";
      const aspectNote = project.aspectRatio === "portrait" ? "portrait 9:16" : "landscape 16:9";

      const typePrompts: Record<string, string> = {
        character: `Generate a Midjourney v7 prompt for a character reference sheet. Character: "${asset.name}". Description: ${asset.description ?? "(none)"}. Style: ${styleKw}. Format: ${aspectNote} full-body, front view, clean background, no text, no watermark.`,
        scene: `Generate a Midjourney v7 prompt for a scene/location reference. Scene: "${asset.name}". Description: ${asset.description ?? "(none)"}. Style: ${styleKw}. Format: wide 16:9 landscape establishing shot, cinematic, NO people, NO characters, NO humans, empty environment, no text, no watermark.`,
        prop: `Generate a Midjourney v7 prompt for a prop/object reference. Prop: "${asset.name}". Description: ${asset.description ?? "(none)"}. Style: ${styleKw}. Format: ${aspectNote} product shot, clean background, no text, no watermark.`,
      };

      const res = await invokeLLM({
        messages: [
          { role: "system", content: "You are a professional Midjourney prompt engineer. Output ONLY the raw prompt text, no explanation, no quotes, no markdown." },
          { role: "user", content: typePrompts[asset.type] },
        ],
      });
      const rawContent = res.choices[0]?.message?.content;
      const mjPrompt = (typeof rawContent === "string" ? rawContent : "").trim();
      await db!.update(overseasAssets).set({ mjPrompt }).where(eq(overseasAssets.id, asset.id));
      return { mjPrompt };
    }),

  // 单个资产生成精品剧方法论提示词（供前端逐个调用，避免超时）
  generateSingleAssetPrompt: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      projectId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [asset] = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.id, input.assetId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (!asset) throw new Error("Asset not found");
      const [project] = await db!.select().from(overseasProjects).where(
        and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id))
      );
      if (!project) throw new Error("Project not found");

      // 获取少量剧情背景
      const shots = await db!.select({
        sceneName: scriptShots.sceneName,
        visualDescription: scriptShots.visualDescription,
        characters: scriptShots.characters,
      }).from(scriptShots).where(
        and(eq(scriptShots.projectId, input.projectId), eq(scriptShots.userId, ctx.user.id))
      ).limit(15);
      const scriptSummary = shots.map(s =>
        `场景：${s.sceneName ?? ""} | 人物：${s.characters ?? ""} | 描述：${(s.visualDescription ?? "").slice(0, 80)}`
      ).join("\n");
      const scriptContext = scriptSummary ? `\n\n【剧情背景】\n${scriptSummary}` : "";

      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human, 8K, film grain",
        animation: "2D animation style, cel-shaded, vibrant colors",
        cg: "3D CGI render, Unreal Engine 5, hyper-detailed",
      };
      const styleZh: Record<string, string> = {
        realistic: "写实电影风格，真实人物，8K 高清，电影感光影",
        animation: "2D 动画风格，赛璐璐着色，鲜艳色彩",
        cg: "3D CGI 渲染，虚幻引擎5，超精细",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic";
      const styleZhKw = styleZh[project.style] ?? "写实电影风格";

      let systemPrompt = "";
      let userPrompt = "";

      if (asset.type === "character") {
        systemPrompt = `你是专业的影视美术设计师，精通角色设定和 Midjourney 提示词写作。请用叙事描述式风格生成提示词，不要关键词堆叠。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
        userPrompt = `请为以下角色生成一个完整的 Midjourney v7 英文提示词，用于生成角色设定参考图（左半边面部特写 + 右半边全身三视图，白色背景）。

角色名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 叙事描述式，不要关键词堆叠
- 包含：年龄感、五官细节（眼型/鼻型/嘴型/肤色）、体型、发型/发色、服装款式/颜色/材质、配饰、整体气质
- 明确左半边面部特写 + 右半边三视图的布局
- 白色干净背景，无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
      } else if (asset.type === "scene") {
        systemPrompt = `你是专业的影视美术设计师，精通场景设计和 Midjourney 提示词写作。请用叙事描述式风格生成提示词，不要关键词堆叠。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
        userPrompt = `请为以下场景生成一个完整的 Midjourney v7 英文提示词，用于生成场景参考图（16:9 横屏，无人物）。

场景名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 叙事描述式，不要关键词堆叠
- 包含：视角（建立镜头/俯拍/平视）、空间布局、光源与光线方向、色调、关键道具/家具/物件、氛围情绪
- 融合为流畅段落，像描述一个电影画面
- 无人物，专注于场景本身
- 16:9 横屏，establishing shot，无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
      } else if (asset.type === "prop") {
        systemPrompt = `你是专业的影视道具设计师，精通道具设定和 Midjourney 提示词写作。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
        userPrompt = `请为以下道具生成一个完整的 Midjourney v7 英文提示词，用于生成道具参考图（产品照风格，白色背景）。

道具名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 包含：材质、颜色、尺寸感、细节特征、使用痕迹/磨损感
- 产品照风格，白色干净背景，居中展示
- 无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
      } else if (asset.type === "costume") {
        systemPrompt = `你是专业的影视服装设计师，精通服装设定和 Midjourney 提示词写作。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
        userPrompt = `请为以下服装生成一个完整的 Midjourney v7 英文提示词，用于生成服装参考图（服装展示，白色背景，无人物）。

服装名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 包含：款式、颜色、材质、剪裁特点、配饰、整体风格感
- 服装平铺或人台展示，白色背景
- 无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
      } else {
        throw new Error(`Unsupported asset type: ${asset.type}`);
      }

      const res = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const rawContent = res.choices[0]?.message?.content;
      const mjPrompt = (typeof rawContent === "string" ? rawContent : "").trim();
      if (mjPrompt) {
        await db!.update(overseasAssets).set({ mjPrompt, stylePrompt: mjPrompt }).where(eq(overseasAssets.id, asset.id));
      }
      return { assetId: asset.id, mjPrompt };
    }),

  // 一键批量生成所有资产提示词（参考精品剧服化道方法论）
  batchGenerateAssetPrompts: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      assetIds: z.array(z.number().int()).optional(), // 不传则生成全部
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects).where(
        and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id))
      );
      if (!project) throw new Error("Project not found");

      // 从 scriptShots 获取剧情摘要作为上下文
      const shots = await db!.select({
        sceneName: scriptShots.sceneName,
        visualDescription: scriptShots.visualDescription,
        characters: scriptShots.characters,
      }).from(scriptShots).where(
        and(eq(scriptShots.projectId, input.projectId), eq(scriptShots.userId, ctx.user.id))
      ).limit(30);
      const scriptSummary = shots.map(s =>
        `场景：${s.sceneName ?? ""} | 人物：${s.characters ?? ""} | 描述：${(s.visualDescription ?? "").slice(0, 100)}`
      ).join("\n");
      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human, 8K, film grain",
        animation: "2D animation style, cel-shaded, vibrant colors",
        cg: "3D CGI render, Unreal Engine 5, hyper-detailed",
      };
      const styleZh: Record<string, string> = {
        realistic: "写实电影风格，真实人物，8K 高清，电影感光影",
        animation: "2D 动画风格，赛璐璐着色，鲜艳色彩",
        cg: "3D CGI 渲染，虚幻引擎5，超精细",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic";
      const styleZhKw = styleZh[project.style] ?? "写实电影风格";

      // 获取需要生成的资产
      let assets;
      if (input.assetIds && input.assetIds.length > 0) {
        assets = await db!.select().from(overseasAssets).where(
          and(eq(overseasAssets.userId, ctx.user.id), eq(overseasAssets.projectId, input.projectId))
        ).then(all => all.filter(a => input.assetIds!.includes(a.id)));
      } else {
        assets = await db!.select().from(overseasAssets).where(
          and(eq(overseasAssets.userId, ctx.user.id), eq(overseasAssets.projectId, input.projectId))
        );
      }

      if (assets.length === 0) throw new Error("没有找到需要生成提示词的资产");

      const scriptContext = scriptSummary ? `\n\n【剧情背景】\n${scriptSummary}` : "";

      // 批量生成（顺序处理避免 rate limit）
      let generated = 0;
      const errors: string[] = [];

      for (const asset of assets) {
        try {
          let systemPrompt = "";
          let userPrompt = "";

          if (asset.type === "character") {
            systemPrompt = `你是专业的影视美术设计师，精通角色设定和 Midjourney 提示词写作。请用叙事描述式风格生成提示词，不要关键词堆叠。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
            userPrompt = `请为以下角色生成一个完整的 Midjourney v7 英文提示词，用于生成角色设定参考图（左半边面部特写 + 右半边全身三视图，白色背景）。

角色名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 叙事描述式，不要关键词堆叠
- 包含：年龄感、五官细节（眼型/鼻型/嘴型/肤色）、体型、发型/发色、服装款式/颜色/材质、配饰、整体气质
- 明确左半边面部特写 + 右半边三视图的布局
- 白色干净背景，无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
          } else if (asset.type === "scene") {
            systemPrompt = `你是专业的影视美术设计师，精通场景设计和 Midjourney 提示词写作。请用叙事描述式风格生成提示词，不要关键词堆叠。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
            userPrompt = `请为以下场景生成一个完整的 Midjourney v7 英文提示词，用于生成场景参考图（16:9 横屏，无人物）。

场景名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 叙事描述式，不要关键词堆叠
- 包含：视角（建立镜头/俯拍/平视）、空间布局、光源与光线方向、色调、关键道具/家具/物件、氛围情绪
- 融合为流畅段落，像描述一个电影画面
- 无人物，专注于场景本身
- 16:9 横屏，establishing shot，无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
          } else if (asset.type === "prop") {
            systemPrompt = `你是专业的影视道具设计师，精通道具设定和 Midjourney 提示词写作。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
            userPrompt = `请为以下道具生成一个完整的 Midjourney v7 英文提示词，用于生成道具参考图（产品照风格，白色背景）。

道具名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 包含：材质、颜色、尺寸感、细节特征、使用痕迹/磨损感
- 产品照风格，白色干净背景，居中展示
- 无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
          } else if (asset.type === "costume") {
            systemPrompt = `你是专业的影视服装设计师，精通服装设定和 Midjourney 提示词写作。输出纯文本英文提示词，可直接用于 Midjourney v7。`;
            userPrompt = `请为以下服装生成一个完整的 Midjourney v7 英文提示词，用于生成服装参考图（服装展示，白色背景，无人物）。

服装名：${asset.name}
描述：${asset.description ?? "(无)"}
整体风格：${styleZhKw}${scriptContext}

要求：
- 包含：款式、颜色、材质、剪裁特点、配饰、整体风格感
- 服装平铺或人台展示，白色背景
- 无文字，无水印
- 风格：${styleKw}
- 仅输出英文提示词，不要解释`;
          } else {
            continue;
          }

          const res = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const rawContent = res.choices[0]?.message?.content;
          const mjPrompt = (typeof rawContent === "string" ? rawContent : "").trim();
          if (mjPrompt) {
            await db!.update(overseasAssets).set({ mjPrompt, stylePrompt: mjPrompt }).where(eq(overseasAssets.id, asset.id));
            generated++;
          }
          // Small delay to avoid rate limit
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          errors.push(`${asset.name}: ${(e as Error).message}`);
        }
      }

      return { generated, total: assets.length, errors };
    }),

  generateAssetImage: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      projectId: z.number().int(),
      viewType: z.enum(["style", "main", "front", "side", "back", "closeup", "multiangle"]).default("main"),
      imageModel: z.string().optional(),
      customPrompt: z.string().optional(),
      referenceImageUrl: z.string().optional(),
      resolution: z.string().optional(),
      aspectRatio: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [asset] = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.id, input.assetId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (!asset) throw new Error("Asset not found");
      const [project] = await db!.select().from(overseasProjects).where(
        and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id))
      );
      if (!project) throw new Error("Project not found");
      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human, 8K, film grain",
        animation: "2D animation, cel-shaded, clean lines, vibrant",
        cg: "3D CGI, Unreal Engine 5, hyper-detailed",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic";
      const isPortrait = project.aspectRatio === "portrait";
      const viewLabels: Record<string, string> = {
        style: "artistic style exploration, mood board reference",
        main: asset.type === "character" ? "full body, front facing, character reference sheet, white background" : (asset.type === "scene" ? "wide 16:9 landscape establishing shot, cinematic, no people, no characters, no humans, empty environment" : "product shot, centered, white background"),
        front: "front view, full body standing T-pose, white clean background, character turnaround",
        side: "side profile view, full body standing, white clean background, character turnaround",
        back: "back view, full body standing, white clean background, character turnaround",
        closeup: "close-up portrait, face detail, upper body, cinematic lighting",
        multiangle: "multi-angle view grid, 3x3 grid layout, different camera angles, establishing shots",
      };
      const basePrompt = input.customPrompt || `${asset.name}, ${asset.description ?? ""}`;
      const prompt = `${basePrompt}, ${viewLabels[input.viewType]}, ${styleKw}, no text, no watermark`;
      const refUrl = input.referenceImageUrl || asset.mjImageUrl || asset.styleImageUrl;
      // Scenes default to 16:9 landscape regardless of project setting
      const assetAspectRatio = input.aspectRatio || (asset.type === "scene" ? "16:9" : (isPortrait ? "9:16" : "16:9"));
      const chosenModel = input.imageModel || "doubao-seedream-4-5-251128";

      let s3Url: string;
      if (chosenModel.startsWith("doubao-seedream")) {
        // 火山引擎 API（豆包即梦）
        const { generateSeedreamImage } = await import("../lib/vectorengine");
        const seedreamResults = await generateSeedreamImage({
          model: chosenModel as any,
          prompt,
          image: refUrl || undefined,
          size: assetAspectRatio === "9:16" ? "2K" : "2K",
          watermark: false,
        });
        const seedUrl = seedreamResults[0]?.url;
        if (!seedUrl) throw new Error("Seedream returned no URL");
        const resp = await fetch(seedUrl);
        const buf = Buffer.from(await resp.arrayBuffer());
        const key = `overseas-assets/${ctx.user.id}/${asset.id}-${input.viewType}-${nanoid(6)}.jpg`;
        const { url } = await storagePut(key, buf, "image/jpeg");
        s3Url = url;
      } else {
        // VectorEngine API（nano-banana-pro 等）
        s3Url = await generateVEImage({
          prompt,
          imageUrl: refUrl || undefined,
          aspectRatio: assetAspectRatio,
          s3KeyPrefix: "overseas-assets",
          userId: ctx.user.id,
          assetId: asset.id,
        });
      }
      const fieldMap: Record<string, string> = {
        style: "styleImageUrl", main: "mainImageUrl",
        front: "viewFrontUrl", side: "viewSideUrl", back: "viewBackUrl",
        closeup: "viewCloseUpUrl", multiangle: "multiAngleGridUrl",
      };
      const updateData: any = { [fieldMap[input.viewType]]: s3Url };
      if (input.viewType === "style" && input.imageModel) updateData.styleModel = input.imageModel;
      if (input.viewType === "main" && input.imageModel) updateData.mainModel = input.imageModel;
      if (input.resolution) updateData.resolution = input.resolution;
      if (input.aspectRatio) updateData.aspectRatio = input.aspectRatio;
      await db!.update(overseasAssets).set(updateData).where(eq(overseasAssets.id, asset.id));
      return { url: s3Url, viewType: input.viewType };
    }),
  // ── 一键生成多视角图 ─────────────────────────────────────────────────────
  generateMultiView: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      projectId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [asset] = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.id, input.assetId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (!asset) throw new Error("Asset not found");
      const refUrl = asset.mainImageUrl || asset.mjImageUrl || asset.styleImageUrl;
      if (!refUrl) throw new Error("请先生成或上传主体图片");
      const [project] = await db!.select().from(overseasProjects).where(
        and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id))
      );
      if (!project) throw new Error("Project not found");
      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, 8K, film grain",
        animation: "2D animation, cel-shaded, clean lines",
        cg: "3D CGI, Unreal Engine 5, hyper-detailed",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic, cinematic";
      const results: Record<string, string> = {};
      const mvAspectRatio = project.aspectRatio === "portrait" ? "9:16" : "16:9";

      // Helper: generate via Seedream 5.0 (best for multi-view consistency)
      const genSeedream5 = async (prompt: string, refImageUrl: string | null, aspectRatio: string, field: string) => {
        const seedreamResults = await generateSeedreamImage({
          model: "doubao-seedream-5-0-260128" as any,
          prompt,
          image: refImageUrl || undefined,
          size: "2K",
          watermark: false,
        });
        const rawUrl = seedreamResults[0]?.url;
        if (!rawUrl) throw new Error("Seedream 5.0 returned no URL");
        const resp = await fetch(rawUrl);
        const buf = Buffer.from(await resp.arrayBuffer());
        const key = `overseas-assets/${ctx.user.id}/${asset.id}-${field}-${nanoid(6)}.jpg`;
        const { url } = await storagePut(key, buf, "image/jpeg");
        return url;
      };

      if (asset.type === "character") {
        const charDesc = asset.description ? `, ${asset.description}` : "";
        const views = [
          { field: "viewCloseUpUrl", label: `close-up portrait of ${asset.name}${charDesc}, face and upper body, cinematic lighting, ${styleKw}, white background, no text, no watermark` },
          { field: "viewFrontUrl", label: `full body front view of ${asset.name}${charDesc}, T-pose standing, white clean background, character reference sheet, ${styleKw}, no text, no watermark` },
          { field: "viewSideUrl", label: `full body side profile of ${asset.name}${charDesc}, standing, white clean background, character turnaround, ${styleKw}, no text, no watermark` },
          { field: "viewBackUrl", label: `full body back view of ${asset.name}${charDesc}, standing, white clean background, character turnaround, ${styleKw}, no text, no watermark` },
        ];
        for (const v of views) {
          try {
            const s3Url = await genSeedream5(v.label, refUrl, mvAspectRatio, v.field);
            results[v.field] = s3Url;
          } catch (e) { /* skip failed views */ }
        }
      } else if (asset.type === "scene") {
        try {
          const sceneDesc = asset.description ? `, ${asset.description}` : "";
          const prompt = `${asset.name}${sceneDesc}, cinematic establishing shot, 16:9 horizontal landscape, ${styleKw}, no people, no characters, no humans, no text, no watermark, empty environment, atmospheric lighting`;
          const s3Url = await genSeedream5(prompt, refUrl, "16:9", "multiAngleGridUrl");
          results.multiAngleGridUrl = s3Url;
        } catch (e) { /* skip */ }
      } else {
        // Prop or costume
        const propDesc = asset.description ? `, ${asset.description}` : "";
        const views = [
          { field: "viewFrontUrl", label: `${asset.name}${propDesc}, front view, product photography, white background, ${styleKw}, no text, no watermark` },
          { field: "viewSideUrl", label: `${asset.name}${propDesc}, side view, product photography, white background, ${styleKw}, no text, no watermark` },
          { field: "viewBackUrl", label: `${asset.name}${propDesc}, back view, product photography, white background, ${styleKw}, no text, no watermark` },
        ];
        for (const v of views) {
          try {
            const s3Url = await genSeedream5(v.label, refUrl, mvAspectRatio, v.field);
            results[v.field] = s3Url;
          } catch (e) { /* skip */ }
        }
      }
      if (Object.keys(results).length > 0) {
        await db!.update(overseasAssets).set(results).where(eq(overseasAssets.id, asset.id));
      }
      return { generated: Object.keys(results), results };
    }),

  // ── 批量导入多集剧本 ─────────────────────────────────────────────────────
  batchParseScripts: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scripts: z.array(z.object({
        episodeNumber: z.number().int().min(1),
        scriptText: z.string().min(10),
      })).min(1).max(100),
      language: z.string().default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { projectId, scripts, language } = input;
      const [project] = await (await getDb())!
        .select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const results: Array<{ episodeNumber: number; shotCount: number; error?: string }> = [];

      for (const ep of scripts) {
        try {
          const aspectLabel = project.aspectRatio === "portrait" ? "vertical 9:16" : "horizontal 16:9";
          const langLabel = language === "en" ? "English" : language === "zh" ? "Chinese" : language;

          const systemPrompt = `You are a professional short drama director and script breakdown specialist.
Your task is to analyze a short drama script and break it down into individual shots for AI video generation.

Rules:
- Generate 20-30 shots per episode maximum. Do NOT invent shots not in the script.
- Each shot should be 4-8 seconds of video content
- All dialogue/narration must be in ${langLabel}
- Visual descriptions must be detailed enough for AI image generation
- Style: ${project.style}
- Aspect ratio: ${aspectLabel}
- Genre: ${project.genre}
- NO background music, NO subtitles in visual descriptions
- Strictly follow the script content`;

          const userPrompt = `Analyze this Episode ${ep.episodeNumber} script and generate a shot breakdown:

${ep.scriptText}

Return a JSON array of shots with this exact schema:
[
  {
    "shotNumber": 1,
    "sceneName": "Scene name",
    "shotType": "close_up|medium|wide|extreme_close|aerial|over_shoulder",
    "visualDescription": "Detailed English description for AI image generation.",
    "dialogue": "Character dialogue in ${langLabel}, or empty string",
    "characters": "comma-separated character names",
    "emotion": "tense|romantic|dramatic|comedic|mysterious|action|sad|happy"
  }
]

Return ONLY the JSON array.`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const content = response.choices[0].message.content as string;
          let shots: Array<{
            shotNumber: number; sceneName: string; shotType: string;
            visualDescription: string; dialogue: string; characters: string; emotion: string;
          }>;

          try {
            const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            shots = JSON.parse(cleaned);
          } catch {
            results.push({ episodeNumber: ep.episodeNumber, shotCount: 0, error: "AI 返回格式错误" });
            continue;
          }

          // 删除旧分镜
          await (await getDb())!.delete(scriptShots).where(
            and(eq(scriptShots.projectId, projectId), eq(scriptShots.userId, ctx.user.id), eq(scriptShots.episodeNumber, ep.episodeNumber))
          );

          if (shots.length > 0) {
            await (await getDb())!.insert(scriptShots).values(
              shots.map(s => ({
                projectId, userId: ctx.user.id, episodeNumber: ep.episodeNumber,
                shotNumber: s.shotNumber, sceneName: s.sceneName, shotType: s.shotType,
                visualDescription: s.visualDescription, dialogue: s.dialogue,
                characters: s.characters, emotion: s.emotion, status: "draft" as const,
              }))
            );
          }

          results.push({ episodeNumber: ep.episodeNumber, shotCount: shots.length });
        } catch (err) {
          results.push({ episodeNumber: ep.episodeNumber, shotCount: 0, error: (err as Error).message });
        }
      }

      return { results, totalEpisodes: scripts.length };
    }),

  // ── 资产自动识别（从剧本中提取人物/场景/道具） ─────────────────────────────
  autoDetectAssets: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scriptText: z.string().min(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { projectId } = input;
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      // 获取所有已有分镜的文本
      let scriptContent = input.scriptText || "";
      if (!scriptContent) {
        const allShots = await db!.select().from(scriptShots)
          .where(and(eq(scriptShots.projectId, projectId), eq(scriptShots.userId, ctx.user.id)))
          .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);
        scriptContent = allShots.map(s =>
          `[EP${s.episodeNumber} S${s.shotNumber}] ${s.visualDescription || ""} ${s.dialogue || ""} Characters: ${s.characters || ""}`
        ).join("\n");
      }

      if (!scriptContent.trim()) throw new Error("No script content found. Please import scripts first.");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional film production asset manager. Analyze the script and extract all unique assets (characters, scenes, props) that need to be designed for production.

For each asset, provide:
- type: "character" | "scene" | "prop" | "costume"
- name: A concise English name (e.g., "LUCAS", "Abandoned Camp", "Tactical Knife", "Lucas Battle Armor")
- description: Brief English description of appearance/characteristics
- tags: comma-separated tags for categorization
Rules:
- Characters: Extract ALL named characters with physical descriptions
- Scenes: Extract ALL unique locations/environments
- Props: Extract important objects that appear repeatedly or are plot-significant
- Costumes: Extract distinctive outfits/clothing for main characters
- Do NOT duplicate entries
- Names should be in English, concise and clearr`,
          },
          {
            role: "user",
            content: `Analyze this script content and extract all production assets:\n\n${scriptContent.slice(0, 15000)}\n\nReturn a JSON array:\n[{"type":"character","name":"...","description":"...","tags":"..."}]\n\nReturn ONLY the JSON array.`,
          },
        ],
      });

      const content = response.choices[0].message.content as string;
      let detectedAssets: Array<{ type: "character" | "scene" | "prop"; name: string; description: string; tags: string }>;
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        detectedAssets = JSON.parse(cleaned);
      } catch {
        throw new Error("AI asset detection failed to return valid JSON");
      }

      // 获取已有资产名称，避免重复
      const existingAssets = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.projectId, projectId), eq(overseasAssets.userId, ctx.user.id)));
      const existingNames = new Set(existingAssets.map(a => a.name.toLowerCase()));

      const newAssets: typeof detectedAssets = [];
      const skipped: string[] = [];

      for (const asset of detectedAssets) {
        if (existingNames.has(asset.name.toLowerCase())) {
          skipped.push(asset.name);
          continue;
        }
        // 验证 type
        if (!["character", "scene", "prop", "costume"].includes(asset.type)) continue;
        newAssets.push(asset);
        existingNames.add(asset.name.toLowerCase());
      }

      // 批量创建
      const created: Array<{ id: number; name: string; type: string }> = [];
      for (const asset of newAssets) {
        const [result] = await db!.insert(overseasAssets).values({
          projectId, userId: ctx.user.id,
          type: asset.type, name: asset.name,
          description: asset.description, tags: asset.tags,
        });
        created.push({ id: (result as any).insertId as number, name: asset.name, type: asset.type });
      }

      return { created, skipped, total: detectedAssets.length };
    }),

  // ── S3 直传上传（主体图） ──────────────────────────────────────────────────
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      contentType: z.string().default("image/jpeg"),
      assetId: z.number().int().optional(),
      field: z.enum(["mjImageUrl", "mainImageUrl", "styleImageUrl", "viewFrontUrl", "viewSideUrl", "viewBackUrl", "viewCloseUpUrl", "multiAngleGridUrl", "referenceImageUrl"]).default("mjImageUrl"),
    }))
    .mutation(async ({ ctx, input }) => {
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `overseas-assets/${ctx.user.id}/${nanoid(12)}.${ext}`;
      return { key, field: input.field, assetId: input.assetId };
    }),

  uploadAssetToS3: protectedProcedure
    .input(z.object({
      assetId: z.number().int(),
      field: z.enum(["mjImageUrl", "mainImageUrl", "styleImageUrl", "viewFrontUrl", "viewSideUrl", "viewBackUrl", "viewCloseUpUrl", "multiAngleGridUrl", "referenceImageUrl"]),
      fileBase64: z.string(),
      contentType: z.string().default("image/jpeg"),
      fileName: z.string().default("image.jpg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [asset] = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.id, input.assetId), eq(overseasAssets.userId, ctx.user.id)));
      if (!asset) throw new Error("Asset not found");

      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `overseas-assets/${ctx.user.id}/${asset.id}-${input.field}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.contentType);

      await db!.update(overseasAssets)
        .set({ [input.field]: url })
        .where(eq(overseasAssets.id, input.assetId));

      return { url, field: input.field };
    }),

  // ── 批量自动生成生图和视频提示词 ──────────────────────────────────────────
  autoGeneratePrompts: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      episodeNumber: z.number().int(),
      shotIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      // 获取所有资产用于参考
      const assets = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.projectId, input.projectId), eq(overseasAssets.userId, ctx.user.id)));
      const assetDescriptions = assets.map(a => `${a.type}: ${a.name} - ${a.description || "no description"}`).join("\n");

      // 获取需要生成提示词的分镜
      let conditions = [
        eq(scriptShots.projectId, input.projectId),
        eq(scriptShots.userId, ctx.user.id),
        eq(scriptShots.episodeNumber, input.episodeNumber),
      ];
      const shotsToProcess = await db!.select().from(scriptShots)
        .where(and(...conditions))
        .orderBy(scriptShots.shotNumber);

      const filtered = input.shotIds
        ? shotsToProcess.filter(s => input.shotIds!.includes(s.id))
        : shotsToProcess;

      const aspectLabel = project.aspectRatio === "portrait" ? "vertical 9:16" : "horizontal 16:9";
      const styleMap: Record<string, string> = {
        realistic: "photorealistic, cinematic, real human, 8K, film grain",
        animation: "2D animation, cel-shaded, clean lines, vibrant",
        cg: "3D CGI, Unreal Engine 5, hyper-detailed",
      };
      const styleKw = styleMap[project.style] ?? "photorealistic";

      let generated = 0;
      const errors: Array<{ shotId: number; error: string }> = [];

      for (const shot of filtered) {
        try {
          // 生成生图提示词（如果没有）
          let imgGenerated = false;
          if (!shot.firstFramePrompt) {
            const imgPromptRes = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are an expert AI image prompt writer for ${project.style} short drama production.
Generate a detailed, cinematic image prompt for the FIRST frame (opening composition).
Style: ${styleKw}
Aspect ratio: ${aspectLabel}
Rules:
- Describe exact visual composition: subject position, pose, facial expression, action
- Include environment/background, lighting quality, color palette, atmosphere
- Specify camera angle and framing
- For characters: describe clothing, hair, appearance details
- NO subtitles, NO text overlays, NO watermarks
- Write in flowing descriptive English prose (NOT keyword lists)
- Keep under 100 words

Known production assets:\n${assetDescriptions}`,
                },
                {
                  role: "user",
                  content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the FIRST frame (opening composition as shot begins) prompt.
Return ONLY the prompt text.`,
                },
              ],
            });
            const firstFramePrompt = (imgPromptRes.choices[0].message.content as string).trim();
            await db!.update(scriptShots)
              .set({ firstFramePrompt })
              .where(eq(scriptShots.id, shot.id));
            imgGenerated = true;
          }

          // 生成视频提示词（针对 Seedance 1.5 Pro 优化）
          let vidGenerated = false;
          if (!shot.videoPrompt) {
            const vidStyleMap: Record<string, string> = {
              realistic: "photorealistic, cinematic, real human actors",
              animation: "2D animation style",
              cg: "3D CGI, Unreal Engine quality",
            };
            const vidStyleKw = vidStyleMap[project.style] ?? "photorealistic, cinematic";
            const vidPromptRes = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro).
Seedance 1.5 Pro excels at smooth character movement, cinematic camera work, and realistic lighting.
Write prompts that:
1. Start with the main subject and their action (what they're doing RIGHT NOW)
2. Describe the camera movement explicitly
3. Include lighting and atmosphere
4. Keep it 2-3 sentences, under 80 words
5. NO background music, NO subtitles, NO watermarks
Style: ${vidStyleKw}`,
                },
                {
                  role: "user",
                  content: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt.
${shot.dialogue ? `Character speaks: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
                },
              ],
            });
            const videoPrompt = (vidPromptRes.choices[0].message.content as string).trim();
            await db!.update(scriptShots)
              .set({ videoPrompt })
              .where(eq(scriptShots.id, shot.id));
            vidGenerated = true;
          }

          if (imgGenerated || vidGenerated) generated++;
        } catch (err) {
          errors.push({ shotId: shot.id, error: (err as Error).message });
        }
      }

      // 返回字段名与前端期望一致
      return { imagePrompts: generated, videoPrompts: generated, generated, errors, total: filtered.length };
    }),

  // ── Excel 分镜表导入 ───────────────────────────────────────────────────────
  importScriptFromExcel: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      episodeNumber: z.number().int().min(1),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      const shots: Array<{ shotNumber: number; sceneName: string; visualDescription: string; dialogue: string | null; characters: string | null }> = [];
      for (const row of rows) {
        const idKeys = Object.keys(row).filter(k => /^(编号|shot|id|#)/i.test(k.trim()));
        const sceneKeys = Object.keys(row).filter(k => /^(场景|scene)/i.test(k.trim()));
        const contentKeys = Object.keys(row).filter(k => /^(画面|content|visual|description)/i.test(k.trim()));
        const dialogueKeys = Object.keys(row).filter(k => /^(台词|lines|dialogue|dialog)/i.test(k.trim()));
        const charKeys = Object.keys(row).filter(k => /^(角色|char|character)/i.test(k.trim()));

        const idVal = idKeys.length > 0 ? row[idKeys[0]] : null;
        if (!idVal || typeof idVal !== "number") continue;

        const shotNum = Math.round(idVal as number);
        const sceneName = sceneKeys.length > 0 ? String(row[sceneKeys[0]] ?? "") : "";
        const visualDesc = contentKeys.length > 0 ? String(row[contentKeys[0]] ?? "") : "";
        const dialogue = dialogueKeys.length > 0 && row[dialogueKeys[0]] ? String(row[dialogueKeys[0]]) : null;
        const characters = charKeys.length > 0 && row[charKeys[0]] ? String(row[charKeys[0]]) : null;

        if (!visualDesc.trim()) continue;
        shots.push({ shotNumber: shotNum, sceneName, visualDescription: visualDesc, dialogue, characters });
      }

      if (shots.length === 0) throw new Error("未找到有效分镜数据，请确认 Excel 格式正确");

      await db!.delete(scriptShots)
        .where(and(
          eq(scriptShots.projectId, input.projectId),
          eq(scriptShots.episodeNumber, input.episodeNumber),
          eq(scriptShots.userId, ctx.user.id),
        ));

      for (const s of shots) {
        await db!.insert(scriptShots).values({
          projectId: input.projectId,
          userId: ctx.user.id,
          episodeNumber: input.episodeNumber,
          shotNumber: s.shotNumber,
          sceneName: s.sceneName || undefined,
          visualDescription: s.visualDescription,
          dialogue: s.dialogue ?? undefined,
          characters: s.characters ?? undefined,
          status: "draft",
        });
      }

      return { imported: shots.length, episodeNumber: input.episodeNumber };
    }),
  // ── 导出分镜表 Excel ─────────────────────────────────────────────────────
  exportShotsExcel: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      episodeNumber: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");
      let conditions = [
        eq(scriptShots.projectId, input.projectId),
        eq(scriptShots.userId, ctx.user.id),
      ];
      if (input.episodeNumber) conditions.push(eq(scriptShots.episodeNumber, input.episodeNumber));
      const shots = await db!.select().from(scriptShots)
        .where(and(...conditions))
        .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);
      if (shots.length === 0) throw new Error("没有分镜数据可导出");
      const rows = shots.map(s => ({
        "集数": s.episodeNumber,
        "镜号": s.shotNumber,
        "场景": s.sceneName ?? "",
        "景别": s.shotType ?? "",
        "画面描述": s.visualDescription ?? "",
        "台词": s.dialogue ?? "",
        "角色": s.characters ?? "",
        "情绪": s.emotion ?? "",
        "首帧提示词": s.firstFramePrompt ?? "",
        "视频提示词": s.videoPrompt ?? "",
        "首帧URL": s.firstFrameUrl ?? "",
        "视频URL": s.videoUrl ?? "",
        "状态": s.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "分镜表");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const key = `exports/${ctx.user.id}/${project.name}-shots-${nanoid(6)}.xlsx`;
      const { url } = await storagePut(key, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return { url, fileName: `${project.name}-分镜表.xlsx` };
    }),
  // ── LLM 对话助手 ───────────────────────────────────────────────────────
  chatWithLLM: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      message: z.string().min(1).max(8000),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).max(20).default([]),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");
      // 获取项目资产作为上下文
      const assets = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.projectId, input.projectId), eq(overseasAssets.userId, ctx.user.id)));
      const assetContext = assets.map(a => `[${a.type}] ${a.name}: ${a.description || ""}`).join("\n");
      const systemPrompt = `你是一个专业的 AI 影视制作助手，精通剧本写作、提示词优化、角色设计、场景描述、风格定义等。
当前项目信息：
- 项目名称：${project.name}
- 风格：${project.style}
- 画幅：${project.aspectRatio === "portrait" ? "竖屏 9:16" : "横屏 16:9"}
- 类型：${project.genre}
- 已有资产：
${assetContext || "暂无"}
${input.context ? `\n额外上下文：${input.context}` : ""}

请用中文回复，简洁专业，直接给出建议或内容。`;
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
        ...input.history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user", content: input.message },
      ];
      const response = await invokeLLM({ messages });
      const reply = (response.choices[0].message.content as string).trim();
      return { reply };
    }),
});

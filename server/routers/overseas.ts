import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { overseasProjects, scriptShots, videoJobs, overseasAssets, batchJobs } from "../../drizzle/schema";
import { eq, and, desc, asc, isNull, isNotNull } from "drizzle-orm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import * as XLSX from "xlsx";
import { callLLM } from "../services/llm-service";
import { generateImage, type ImageEngine } from "../services/image-service";
import { generateVideo, type VideoEngine } from "../services/video-service";
import {
  ASSET_PROMPT_SYSTEM,
  generateCameraDiagramPrompt,
  generateFramePrompts,
  generateProjectBible,
  generateMotionPrompt,
  generateSeedance2Prompt,
  generateStoryboardSketchPrompt,
  type Seedance2ReferenceImage,
  type ShotInfo,
} from "../services/prompt-engine";
import { ENV } from "../_core/env";
import { buildVisualStylePrompt, getVisualStylePreset, validateStyleEnhancers } from "../../shared/visualStyles";
import pLimit from "p-limit";
import { parseLlmJson } from "../lib/llm-json";

// ─── 项目 CRUD ────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(128),
  definition: z.string().optional(),
  market: z.string().default("us"),
  aspectRatio: z.enum(["landscape", "portrait"]).default("portrait"),
  style: z.enum(["realistic", "animation", "cg"]).default("realistic"),
  genre: z.string().default("romance"),
  visualStylePreset: z.string().default("natural_practical_light"),
  styleEnhancers: z.string().optional(),
  visualStylePrompt: z.string().optional(),
  projectBible: z.string().optional(),
  totalEpisodes: z.number().int().min(1).max(100).optional(),
  /** 工作流类型：精品剧为主流程；batch 仅保留旧数据兼容 */
  projectType: z.enum(["premium", "batch"]).default("premium"),
});

const VIDEO_ENGINE_ENUM = z.enum(["seedance_1_5", "seedance_2_0", "veo_3_1", "kling_3_0", "kling_3_0_omni", "runway_gen4", "hailuo_2_3", "grok_video_3", "sora_2_pro", "wan2_6"]);

const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.number().int(),
  characters: z.string().optional(),
  scenes: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  imageEngine: z.string().optional(),
  videoEngine: VIDEO_ENGINE_ENUM.optional(),
  projectType: z.enum(["premium", "batch"]).optional(),
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

const ASSET_TYPE_ENUM = z.enum(["character", "scene", "prop", "costume", "storyboard", "camera_diagram", "custom"]);

const premiumVisualSchema = z.object({
  shotId: z.number().int(),
  prompt: z.string().optional(),
  imageEngine: z.string().default("image2"),
  addToAssetLibrary: z.boolean().default(false),
});

const premiumVideoPromptSchema = z.object({
  shotId: z.number().int(),
  referenceAssetIds: z.array(z.number().int()).max(9).optional(),
  duration: z.number().int().min(4).max(15).default(15),
});

const premiumVideoSegmentPromptSchema = z.object({
  projectId: z.number().int(),
  shotIds: z.array(z.number().int()).min(1).max(6),
  referenceAssetIds: z.array(z.number().int()).max(9).optional(),
  duration: z.number().int().min(8).max(15).default(15),
});

const premiumVideoSchema = z.object({
  shotId: z.number().int(),
  prompt: z.string().optional(),
  referenceImageUrls: z.array(z.string().url()).max(9).optional(),
  duration: z.number().int().min(4).max(15).default(15),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
});

const shotVisualAssetSchema = z.object({
  shotId: z.number().int(),
  kind: z.enum(["storyboard", "camera_diagram"]),
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

// ─── 视频引擎映射（tRPC enum → VideoEngine） ──────────────────────────────

const ENGINE_ENUM_TO_VIDEO_ENGINE: Record<string, VideoEngine> = {
  "seedance_1_5": "seedance-1.5-pro",
  "seedance_2_0": "seedance-2.0",
  "veo_3_1": "veo-3.1",
  "kling_3_0": "kling-3.0",
  "kling_3_0_omni": "kling-3.0-omni",
  "runway_gen4": "runway-gen4",
  "hailuo_2_3": "hailuo-2.3",
  "grok_video_3": "grok-video-3",
  "sora_2_pro": "sora-2-pro",
  "wan2_6": "wan2.6",
};

const IMAGE_ENGINE_TO_SERVICE_ENGINE: Record<string, ImageEngine> = {
  image2: "image2",
  "doubao-seedream-4-5-251128": "seedream-4.5",
  "doubao-seedream-5-0-260128": "seedream-5.0",
  "seedream-4.5": "seedream-4.5",
  "seedream-5.0": "seedream-5.0",
  midjourney: "midjourney",
  "nano-banana-pro": "nano-banana-pro",
};

function toImageEngine(engine?: string): ImageEngine {
  return IMAGE_ENGINE_TO_SERVICE_ENGINE[engine ?? ""] ?? "image2";
}

function shotToInfo(shot: typeof scriptShots.$inferSelect, duration = 15): ShotInfo {
  return {
    shotNumber: shot.shotNumber,
    sceneName: shot.sceneName ?? "",
    shotType: shot.shotType ?? "medium shot",
    visualDescription: shot.visualDescription ?? "",
    dialogue: shot.dialogue ?? undefined,
    characters: shot.characters ?? undefined,
    emotion: shot.emotion ?? undefined,
    duration,
  };
}

function assetImageUrl(asset: typeof overseasAssets.$inferSelect): string | null {
  return (
    asset.referenceImageUrl ||
    asset.viewCloseUpUrl ||
    asset.mainImageUrl ||
    asset.multiAngleGridUrl ||
    asset.viewFrontUrl ||
    asset.mjImageUrl ||
    asset.styleImageUrl ||
    null
  );
}

function assetReferenceRole(asset: typeof overseasAssets.$inferSelect): Seedance2ReferenceImage["role"] {
  if (asset.type === "character") return "character";
  if (asset.type === "scene") return "scene";
  return "style";
}

function parseStyleEnhancers(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string").slice(0, 5);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5);
  }
  return [];
}

function resolveProjectVisualStyle(project: typeof overseasProjects.$inferSelect, styleEnhancers = parseStyleEnhancers(project.styleEnhancers)) {
  return project.visualStylePrompt?.trim() || buildVisualStylePrompt(getVisualStylePreset(project.visualStylePreset), styleEnhancers);
}

function parseEpisodeNumber(value?: string | null) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };
  if (value === "十") return 10;
  const tenIndex = value.indexOf("十");
  if (tenIndex >= 0) {
    const left = value.slice(0, tenIndex);
    const right = value.slice(tenIndex + 1);
    return (left ? digits[left] ?? 0 : 1) * 10 + (right ? digits[right] ?? 0 : 0);
  }
  return digits[value] ?? null;
}

function splitScriptLocally(scriptText: string) {
  const normalized = scriptText.replace(/\r\n/g, "\n").trim();
  const pattern = /(?:^|\n)\s*(?:第\s*([一二两三四五六七八九十百\d]+)\s*[集话]|EP(?:ISODE)?\.?\s*(\d+)|Episode\s*(\d+))\s*[:：、.\-\s]*([^\n]*)/gi;
  const matches = Array.from(normalized.matchAll(pattern));
  if (matches.length > 0) {
    return matches.map((match, index) => {
      const markerStart = match.index ?? 0;
      const nextStart = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
      const fullBlock = normalized.slice(markerStart, nextStart).trim();
      const firstLineEnd = fullBlock.indexOf("\n");
      const firstLine = firstLineEnd >= 0 ? fullBlock.slice(0, firstLineEnd) : fullBlock;
      const scriptBlock = firstLineEnd >= 0 ? fullBlock.slice(firstLineEnd + 1).trim() : fullBlock;
      const parsedNumber = parseEpisodeNumber(match[1] || match[2] || match[3]);
      return {
        episodeNumber: parsedNumber ?? index + 1,
        title: (match[4]?.trim() || firstLine.trim() || `第 ${index + 1} 集`).slice(0, 80),
        scriptText: scriptBlock.length >= 10 ? scriptBlock : fullBlock,
      };
    }).filter((episode) => episode.scriptText.length >= 10);
  }

  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length <= 1 || normalized.length <= 8000) {
    return [{ episodeNumber: 1, title: "第 1 集", scriptText: normalized }];
  }
  const episodes: Array<{ episodeNumber: number; title: string; scriptText: string }> = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length > 6000) {
      episodes.push({ episodeNumber: episodes.length + 1, title: `第 ${episodes.length + 1} 集`, scriptText: buffer.trim() });
      buffer = "";
    }
    buffer += `${paragraph}\n\n`;
  }
  if (buffer.trim()) {
    episodes.push({ episodeNumber: episodes.length + 1, title: `第 ${episodes.length + 1} 集`, scriptText: buffer.trim() });
  }
  return episodes;
}

export const overseasRouter = router({
  // ── 列出所有项目 ──────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const rows = await (await getDb())!
      .select()
      .from(overseasProjects)
      .where(and(
        eq(overseasProjects.userId, ctx.user.id),
        eq(overseasProjects.isDeleted, false),
        eq(overseasProjects.projectType, "premium")
      ))
      .orderBy(desc(overseasProjects.updatedAt));
    return rows;
  }),

  // ── 创建项目 ──────────────────────────────────────────────────────────────
  createProject: protectedProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
    const stylePreset = getVisualStylePreset(input.visualStylePreset);
    const { selectedIds } = validateStyleEnhancers(parseStyleEnhancers(input.styleEnhancers));
    const visualStylePrompt = input.visualStylePrompt?.trim() || buildVisualStylePrompt(stylePreset, selectedIds);
    const [result] = await (await getDb())!.insert(overseasProjects).values({
      userId: ctx.user.id,
      name: input.name,
      definition: input.definition,
      market: input.market,
      aspectRatio: input.aspectRatio,
      style: input.style,
      genre: input.genre,
      visualStylePreset: stylePreset.id,
      styleEnhancers: JSON.stringify(selectedIds),
      visualStylePrompt,
      projectBible: input.projectBible,
      totalEpisodes: input.totalEpisodes,
      projectType: "premium",
      videoEngine: "seedance_2_0",
      status: "draft",
    });
    const id = (result as any).insertId as number;
    const [project] = await (await getDb())!.select().from(overseasProjects).where(eq(overseasProjects.id, id));
    return project;
  }),

  // ── 更新项目 ──────────────────────────────────────────────────────────────
  updateProject: protectedProcedure.input(updateProjectSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const styleEnhancers = parseStyleEnhancers(rest.styleEnhancers);
    if (rest.visualStylePreset && !rest.visualStylePrompt?.trim()) {
      rest.visualStylePrompt = buildVisualStylePrompt(getVisualStylePreset(rest.visualStylePreset), styleEnhancers);
    }
    if (rest.styleEnhancers) {
      rest.styleEnhancers = JSON.stringify(validateStyleEnhancers(styleEnhancers).selectedIds);
    }
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

  // ── 生成项目圣经：后续所有提示词的统一导演手册 ─────────────────────────────
  generateProjectBible: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scriptText: z.string().min(10).max(200000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const aspectRatio = project.aspectRatio === "portrait" ? "9:16" : "16:9";
      const styleEnhancers = parseStyleEnhancers(project.styleEnhancers);
      const bible = await generateProjectBible(input.scriptText, {
        projectDefinition: project.definition,
        projectBible: project.projectBible,
        visualStylePreset: project.visualStylePreset,
        styleEnhancers,
        visualStylePrompt: resolveProjectVisualStyle(project, styleEnhancers),
        aspectRatio,
      });

      await db!
        .update(overseasProjects)
        .set({
          projectBible: bible.projectBible,
          characters: JSON.stringify(bible.mainCharacters),
          scenes: JSON.stringify(bible.coreLocations),
        })
        .where(eq(overseasProjects.id, project.id));

      return bible;
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

  // ── AI 解析剧本，生成分镜表（异步任务模式，立即返回 jobId） ──────────────────
  parseScript: protectedProcedure.input(parseScriptSchema).mutation(async ({ ctx, input }) => {
    const { projectId, episodeNumber, scriptText, language } = input;

    const db = await getDb();
    const [project] = await db!
      .select()
      .from(overseasProjects)
      .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
    if (!project) throw new Error("Project not found");

    // 创建任务记录，立即返回 jobId
    const [jobRow] = await db!.insert(batchJobs).values({
      userId: ctx.user.id,
      projectId,
      type: "parseScript",
      status: "running",
      total: 1,
      current: 0,
      currentName: `第 ${episodeNumber} 集`,
      succeeded: 0,
      failed: 0,
    });
    const jobId = (jobRow as any).insertId as number;

    // 后台异步执行
    setImmediate(async () => {
      try {
        const aspectLabel = project.aspectRatio === "portrait" ? "vertical 9:16" : "horizontal 16:9";
        const langLabel = language === "en" ? "English" : language === "zh" ? "Chinese" : language;
        const visualStyle = resolveProjectVisualStyle(project);

        const systemPrompt = `You are a professional film director, performance coach, and AI video shot breakdown specialist.
Break the script into shots for a premium Seedance 2.0 workflow.

Rules:
- Do not invent events not in the script.
- Do not force a fixed episode count or fixed shot duration.
- Each shot should usually be 6-15 seconds. Choose duration by dialogue length, action complexity, performance pauses, and visual density.
- A shot can carry only one main dramatic task. If dialogue is too long or action is too dense, split into more shots.
- Dialogue shots need pauses, tone, subtext, and reaction time. Chinese normal speed is 4-6 characters/sec; restrained speech is 2.5-4 characters/sec; argument can be 6-8 characters/sec.
- Performance must include negative space: hesitation, breath, gaze shift, small hand movement, silence before or after a line.
- Visual descriptions must use visible actions, composition, camera, lighting, material, atmosphere, and continuity constraints.
- All dialogue/narration must be in ${langLabel}
- Aspect ratio: ${aspectLabel}
- Project bible: ${project.projectBible || "not yet generated"}
- Visual style lock:
${visualStyle}
- NO subtitles in visual descriptions.`;

        const userPrompt = `Analyze this Episode ${episodeNumber} script and generate a shot breakdown:

${scriptText}

Return a JSON array of shots with this exact schema:
[
  {
    "shotNumber": 1,
    "sceneName": "Scene name",
    "shotType": "close_up|medium|wide|extreme_close|aerial|over_shoulder",
    "visualDescription": "中文分镜画面设计：主体、动作、空间、摄影机位置、光影、空气介质、材质、表演留白和连续性约束。不要字幕，不要背景音乐。",
    "dialogue": "Character dialogue or narration in ${langLabel}, or empty string if none",
    "characters": "comma-separated character names in this shot",
    "emotion": "emotional tone plus performance subtext",
    "durationSec": 12
  }
]

Important: Return ONLY the JSON array, no markdown, no explanation.`;

        const response = await callLLM({
          systemPrompt,
          prompt: userPrompt,
          responseFormat: {
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
                  durationSec: { type: "integer" },
                },
                  required: ["shotNumber", "sceneName", "shotType", "visualDescription", "dialogue", "characters", "emotion", "durationSec"],
                  additionalProperties: false,
                },
              },
            },
          },
        });

        let shots: Array<{
          shotNumber: number; sceneName: string; shotType: string;
          visualDescription: string; dialogue: string; characters: string; emotion: string; durationSec?: number;
        }>;
        try {
          shots = parseLlmJson(response, "分镜设计");
        } catch (err) {
          await db!.update(batchJobs).set({ status: "done", failed: 1, errorMsg: (err as Error).message }).where(eq(batchJobs.id, jobId));
          return;
        }

        const dbInst = await getDb();
        await dbInst!
          .delete(scriptShots)
          .where(and(eq(scriptShots.projectId, projectId), eq(scriptShots.userId, ctx.user.id), eq(scriptShots.episodeNumber, episodeNumber)));

        if (shots.length > 0) {
          await dbInst!.insert(scriptShots).values(
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
              videoDuration: Math.max(4, Math.min(15, s.durationSec ?? 12)),
              status: "draft" as const,
            }))
          );
        }

        await db!.update(batchJobs).set({ status: "done", current: 1, succeeded: 1 }).where(eq(batchJobs.id, jobId));
      } catch (err) {
        await db!.update(batchJobs).set({ status: "done", failed: 1, errorMsg: (err as Error).message }).where(eq(batchJobs.id, jobId));
      }
    });

    return { jobId, episodeNumber };
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
    const framePromptResponse = await callLLM({
      systemPrompt: `You are an expert AI image prompt writer for ${project.style} short drama production.
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
      prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the ${isLastFrame ? "LAST frame (final frozen moment before cut, emotional peak or resolution)" : "FIRST frame (opening composition as shot begins, establishing mood and positioning)"} prompt.
Return ONLY the prompt text.`,
    });

    const framePrompt = framePromptResponse.trim();

    // 合并参考图（subjectRefUrls 优先）
    const allRefUrls = [...(subjectRefUrls ?? []), ...(referenceImageUrls ?? [])];
    const refImageUrl = allRefUrls.length > 0 ? allRefUrls[0] : undefined;

    // 选择 image-service 引擎
    const imgServiceEngine: "seedream-4.5" | "seedream-5.0" | "nano-banana-pro" = isSeedream
      ? (chosenEngine === "doubao-seedream-5-0-260128" ? "seedream-5.0" : "seedream-4.5")
      : "nano-banana-pro";

    const { url: s3Url } = await generateImage({
      prompt: framePrompt,
      engine: imgServiceEngine,
      aspectRatio: aspectRatio as "9:16" | "16:9",
      referenceImageUrl: refImageUrl,
      s3KeyPrefix: `frames/${ctx.user.id}`,
    });

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

      const response = await callLLM({
        systemPrompt: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro), a state-of-the-art text-to-video model.
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
        prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion/mood: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt for this shot.
${shot.dialogue ? `The character should be speaking the dialogue: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
      });

      const videoPrompt = response.trim();

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
    // 精品剧（Seedance 2.0）不需要首帧图，但仍需视频提示词
    if (engine !== "seedance_2_0" && !shot.firstFrameUrl) throw new Error("First frame image is required before generating video");
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
      // All video generation now goes through video-service
      await (await getDb())!.update(videoJobs).set({ status: "processing" }).where(eq(videoJobs.id, jobId));

      const videoEngine = ENGINE_ENUM_TO_VIDEO_ENGINE[engine] ?? "seedance-1.5-pro";
      const { url: s3VideoUrl } = await generateVideo({
        engine: videoEngine,
        prompt: shot.videoPrompt,
        // 精品剧（Seedance 2.0）：传 referenceImageUrls，不需要首帧
        referenceImageUrls: engine === "seedance_2_0" ? (referenceImageUrls ?? []) : undefined,
        // 跑量剧（Seedance 1.5 Pro）：首帧 + 可选尾帧
        firstFrameUrl: engine === "seedance_1_5" ? (shot.firstFrameUrl ?? undefined) : undefined,
        lastFrameUrl: engine === "seedance_1_5" && useLastFrame && shot.lastFrameUrl ? shot.lastFrameUrl : undefined,
        // 通用引擎：首帧作为 imageUrl
        imageUrl: (engine !== "seedance_1_5" && engine !== "seedance_2_0") ? (shot.firstFrameUrl ?? undefined) : undefined,
        referenceImage: (engine !== "seedance_1_5" && engine !== "seedance_2_0") ? referenceImageUrls?.[0] : undefined,
        aspectRatio: aspectRatio as "9:16" | "16:9",
        resolution: resolution as "480p" | "720p" | "1080p",
        duration,
        smartDuration,
        s3KeyPrefix: `overseas/${ctx.user.id}/videos`,
      });

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

              const framePromptResponse = await callLLM({
                systemPrompt: `You are an expert AI image prompt writer for ${project.style} short drama production.
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
                prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the FIRST frame (opening composition as shot begins, establishing mood and positioning) prompt.
Return ONLY the prompt text.`,
              });

              const framePrompt = framePromptResponse.trim();

              const batchImageEngine = project.imageEngine || "doubao-seedream-4-5-251128";
              const batchIsSeedream = batchImageEngine.startsWith("doubao-seedream");
              const batchRefUrl = globalRefUrls.length > 0 ? globalRefUrls[0] : undefined;
              const batchAspectRatio = project.aspectRatio === "portrait" ? "9:16" : "16:9";

              const batchImgEngine: "seedream-4.5" | "seedream-5.0" | "nano-banana-pro" = batchIsSeedream
                ? (batchImageEngine === "doubao-seedream-5-0-260128" ? "seedream-5.0" : "seedream-4.5")
                : "nano-banana-pro";
              const { url: frameS3Url } = await generateImage({
                prompt: framePrompt,
                engine: batchImgEngine,
                aspectRatio: batchAspectRatio as "9:16" | "16:9",
                referenceImageUrl: batchRefUrl,
                s3KeyPrefix: `frames/${ctx.user.id}`,
              });

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
              const vpResponse = await callLLM({
                systemPrompt: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro).
Seedance 1.5 Pro excels at smooth character movement, cinematic camera work, and realistic lighting.
Write prompts that:
1. Start with the main subject and their action (what they're doing RIGHT NOW)
2. Describe the camera movement explicitly
3. Include lighting and atmosphere
4. Keep it 2-3 sentences, under 80 words
5. NO background music, NO subtitles, NO watermarks
Style: ${batchVidStyleKw}`,
                prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt.
${shot.dialogue ? `Character speaks: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
              });

              const videoPrompt = vpResponse.trim();
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

                const batchVideoEngine = ENGINE_ENUM_TO_VIDEO_ENGINE[engine] ?? "seedance-1.5-pro";
                const { url: s3VideoUrl } = await generateVideo({
                  engine: batchVideoEngine,
                  prompt: shot.videoPrompt ?? shot.visualDescription ?? "",
                  // 精品剧（Seedance 2.0）：全局参考图
                  referenceImageUrls: engine === "seedance_2_0" ? (globalRefUrls.length > 0 ? globalRefUrls : undefined) : undefined,
                  // 跑量剧（Seedance 1.5 Pro）：首帧 + 尾帧
                  firstFrameUrl: engine === "seedance_1_5" ? (shot.firstFrameUrl ?? undefined) : undefined,
                  lastFrameUrl: engine === "seedance_1_5" && shot.lastFrameUrl ? shot.lastFrameUrl : undefined,
                  // 通用引擎
                  imageUrl: (engine !== "seedance_1_5" && engine !== "seedance_2_0") ? (shot.firstFrameUrl ?? undefined) : undefined,
                  referenceImage: (engine !== "seedance_1_5" && engine !== "seedance_2_0") && globalRefUrls.length > 0 ? globalRefUrls[0] : undefined,
                  aspectRatio: aspectRatio as "9:16" | "16:9",
                  resolution: resolution as "480p" | "720p" | "1080p",
                  duration,
                  smartDuration,
                  s3KeyPrefix: `overseas/${ctx.user.id}/videos`,
                });

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
      type: ASSET_TYPE_ENUM.optional(),
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
      type: ASSET_TYPE_ENUM.default("custom"),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      tags: z.string().optional(),
      referenceImageUrl: z.string().url().optional(),
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
        referenceImageUrl: input.referenceImageUrl,
        mainImageUrl: input.referenceImageUrl,
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
      referenceImageUrl: z.string().optional(),
      viewFrontUrl: z.string().optional(),
      viewSideUrl: z.string().optional(),
      viewBackUrl: z.string().optional(),
      viewCloseUpUrl: z.string().optional(),
      multiAngleGridUrl: z.string().optional(),
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

      const res = await callLLM({
        systemPrompt: "You are a professional Midjourney prompt engineer. Output ONLY the raw prompt text, no explanation, no quotes, no markdown.",
        prompt: typePrompts[asset.type],
      });
      const rawContent = res;
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

      const res = await callLLM({
        systemPrompt: ASSET_PROMPT_SYSTEM,
        prompt: `请为这个已存在资产重写一条稳定、可编辑、可复用的中文资产提示词。

资产类型：${asset.type}
资产名称：${asset.name}
现有描述：
${asset.description || "未填写"}

项目定义：
${project.definition || "未填写"}

项目圣经：
${project.projectBible || "未生成"}

摄影风格锁定：
${resolveProjectVisualStyle(project)}

剧情背景：
${scriptSummary || "暂无分镜背景"}

只输出 JSON，assets 数组里只放这一个资产。`,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "single_asset_prompt",
            strict: true,
            schema: {
              type: "object",
              properties: {
                assets: {
                  type: "array",
                  minItems: 1,
                  maxItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["character", "scene", "costume", "prop", "custom"] },
                      name: { type: "string" },
                      status: { type: "string", enum: ["confirmed", "needs_user_input"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      mainWeight: { type: "string" },
                      supportingWeight: { type: "string" },
                      assetPrompt: { type: "string" },
                      continuityRule: { type: "string" },
                      variationRule: { type: "string" },
                      usedInEpisodes: { type: "string" },
                      conflictCheck: { type: "string" },
                    },
                    required: ["type", "name", "status", "priority", "mainWeight", "supportingWeight", "assetPrompt", "continuityRule", "variationRule", "usedInEpisodes", "conflictCheck"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["assets"],
              additionalProperties: false,
            },
          },
        },
      });
      const parsed = parseLlmJson<{ assets: Array<{ assetPrompt: string; mainWeight: string; supportingWeight: string; continuityRule: string; variationRule: string; conflictCheck: string; priority: string; status: string; usedInEpisodes: string }> }>(res, "资产提示词");
      const next = parsed.assets[0];
      const mjPrompt = next.assetPrompt.trim();
      if (mjPrompt) {
        await db!.update(overseasAssets).set({
          description: [next.mainWeight, next.supportingWeight, `连续性：${next.continuityRule}`, `变化规则：${next.variationRule}`, `待确认：${next.conflictCheck}`].join("\n"),
          mjPrompt,
          stylePrompt: mjPrompt,
          tags: `${next.priority},${next.status},${next.usedInEpisodes}`,
        }).where(eq(overseasAssets.id, asset.id));
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
          } else {
            continue;
          }

          const res = await callLLM({ systemPrompt, prompt: userPrompt });
          const rawContent = res;
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
        style: asset.type === "character"
          ? "single person full body portrait, front facing standing pose, pure white clean background, uniform studio lighting, no shadows, face clearly visible, facial features detailed, costume details prominent, --ar 9:16 --style raw --q 2"
          : "wide cinematic establishing shot, 16:9 horizontal landscape, photorealistic, 4K, no people, no humans, no characters, empty environment, atmospheric lighting, --ar 16:9 --style raw --q 2",
        main: asset.type === "character"
          ? "single person full body front view standing pose, pure white clean background, uniform studio lighting, no shadows, face clearly visible, no text, no watermark, --ar 9:16 --style raw --q 2"
          : "wide 16:9 landscape establishing shot, cinematic, no people, no characters, no humans, empty environment, photorealistic, 4K, --ar 16:9 --style raw --q 2",
        front: "full body front view standing pose, pure white background, character design reference, arms slightly away from body, studio lighting, no shadows, --ar 2:3 --style raw --q 2",
        side: "full body side profile view standing pose, pure white background, character design reference, arms slightly away from body, studio lighting, no shadows, --ar 2:3 --style raw --q 2",
        back: "full body back view standing pose, pure white background, character design reference, arms slightly away from body, studio lighting, no shadows, --ar 2:3 --style raw --q 2",
        closeup: "close-up portrait, face and upper body, cinematic lighting, deep gray gradient background, face details prominent, --ar 2:3 --style raw --q 2",
        multiangle: asset.type === "character"
          ? "professional character design reference sheet, 16:9 horizontal, pure white background, uniform studio lighting, no shadows, left one-third area close-up face portrait showing facial features and expression details, right two-thirds area three standing poses front view side view back view, arms slightly away from body, character model design style, 4K ultra detailed, --ar 16:9 --style raw --q 2"
          : "cinematic establishing shot, 16:9, no people, no humans, empty environment, photorealistic, 4K, --ar 16:9 --style raw --q 2",
      };
      const basePrompt = input.customPrompt || `${asset.name}, ${asset.description ?? ""}`;
      const prompt = `${basePrompt}, ${viewLabels[input.viewType]}, ${styleKw}, no text, no watermark`;
      // 场景默认 16:9，人物默认 9:16
      const assetAspectRatio = input.aspectRatio || (asset.type === "scene" ? "16:9" : "9:16");
      // 场景默认用 MJ（真实感更强），人物默认用 Seedream
      const chosenModel = input.imageModel || (asset.type === "scene" ? "midjourney" : "doubao-seedream-4-5-251128");
      let imgEngine: "seedream-4.5" | "seedream-5.0" | "midjourney" | "nano-banana-pro";
      if (chosenModel === "doubao-seedream-5-0-260128") {
        imgEngine = "seedream-5.0";
      } else if (chosenModel.startsWith("doubao-seedream")) {
        imgEngine = "seedream-4.5";
      } else if (chosenModel === "midjourney") {
        imgEngine = "midjourney";
      } else {
        imgEngine = "nano-banana-pro";
      }
      const { url: s3Url } = await generateImage({
        prompt,
        engine: imgEngine,
        aspectRatio: assetAspectRatio as "9:16" | "16:9" | "1:1" | "3:4" | "4:3",
        s3KeyPrefix: `overseas-assets/${ctx.user.id}`,
      });
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

      if (asset.type === "character") {
        // 人物：用 Seedream 5.0 生成 1 张 16:9 专业角色参考设计图
        // 布局：左 1/3 面部近景 + 右 2/3 三姿态转身图（正/侧/背）
        const charDesc = asset.description ? `, ${asset.description}` : "";
        const charRefPrompt = `${asset.name}${charDesc}, professional character design reference sheet, 16:9 horizontal, pure white background, uniform studio photography lighting, no shadows, left one-third area shows close-up face portrait with clear facial features and expression details, right two-thirds area shows three standing poses: front view standing pose, side view standing pose, back view standing pose, arms slightly away from body, character model design style, ${styleKw}, 4K ultra detailed, no text, no watermark`;
        try {
          const { url } = await generateImage({
            prompt: charRefPrompt,
            engine: "seedream-5.0",
            aspectRatio: "16:9",
            s3KeyPrefix: `overseas-assets/${ctx.user.id}`,
          });
          results.multiAngleGridUrl = url;
        } catch (e) { /* skip on failure */ }
      } else if (asset.type === "scene") {
        // 场景：用 LLM 根据剧本描述动态生成 4 个不同视角的 prompt，再用 Seedream 5.0 生成 4 张独立 4K 场景图
        const sceneDesc = asset.description ?? "";
        const llmScenePrompt = `你是专业的 AI 影片制作提示词工程师。请根据以下场景信息，生成 4 个用于 Midjourney 7（MJ7）的场景参考图英文提示词。
【场景信息】
场景名称：${asset.name}
场景描述：${sceneDesc || "无"}
整体风格：${styleKw}

【要求】
- 根据剧本内容分析该场景的视觉特点，生成 4 个不同拍摄角度的场景图提示词
- 每个提示词应强调该场景的不同特征：全景建立镜头、内景中景、环境细节特写、氛围光影
- 所有提示词必须：无人物、无文字、无水印、写实风格、16:9画幅、4K
- 每个提示词末尾加上：--ar 16:9 --style raw --q 2

请严格输出以下 JSON 格式：
{
  "view1": "English MJ prompt for wide establishing shot --ar 16:9 --style raw --q 2",
  "view2": "English MJ prompt for interior medium shot --ar 16:9 --style raw --q 2",
  "view3": "English MJ prompt for close-up detail shot --ar 16:9 --style raw --q 2",
  "view4": "English MJ prompt for mood atmosphere shot --ar 16:9 --style raw --q 2"
}`;
        // Step 1: LLM 动态生成 4 个视角的 prompt
        let scenePrompts: { view1: string; view2: string; view3: string; view4: string } | null = null;
        try {
          const llmRaw = await callLLM({ prompt: llmScenePrompt });
          scenePrompts = parseLlmJson(llmRaw, "场景多视角提示词");
        } catch { /* 降级为固定模板 */ }
        const baseScene = `${asset.name}${sceneDesc ? ", " + sceneDesc : ""}`;
        const sceneViews: Array<{ field: string; prompt: string }> = [
          { field: "viewFrontUrl", prompt: scenePrompts?.view1 ?? `${baseScene}, wide establishing shot, cinematic 16:9, ${styleKw}, no people, no humans, empty environment, photorealistic, 4K, atmospheric lighting, no text, no watermark` },
          { field: "viewSideUrl", prompt: scenePrompts?.view2 ?? `${baseScene}, interior medium shot, cinematic 16:9, ${styleKw}, no people, no humans, detailed environment, photorealistic, 4K, warm ambient lighting, no text, no watermark` },
          { field: "viewBackUrl", prompt: scenePrompts?.view3 ?? `${baseScene}, close-up detail shot, cinematic 16:9, ${styleKw}, no people, no humans, texture and material detail, photorealistic, 4K, dramatic lighting, no text, no watermark` },
          { field: "viewCloseUpUrl", prompt: scenePrompts?.view4 ?? `${baseScene}, mood atmosphere shot, cinematic 16:9, ${styleKw}, no people, no humans, golden hour or dramatic sky, photorealistic, 4K, cinematic color grading, no text, no watermark` },
        ];
        // Step 2: 用 Seedream 5.0 并行生成 4 张场景图
        await Promise.all(sceneViews.map(async (v) => {
          try {
            const { url } = await generateImage({
              prompt: v.prompt,
              engine: "seedream-5.0",
              aspectRatio: "16:9",
              s3KeyPrefix: `overseas-assets/${ctx.user.id}`,
            });
            results[v.field] = url;
          } catch (e) { /* skip failed views */ }
        }));
      }
      if (Object.keys(results).length > 0) {
        await db!.update(overseasAssets).set(results).where(eq(overseasAssets.id, asset.id));
      }
      return { generated: Object.keys(results), results };
    }),

  // ── 精品剧：智能分集（长剧本 → 多集脚本块）──────────────────────────────
  splitScriptIntoEpisodes: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scriptText: z.string().min(10).max(200000),
      targetEpisodes: z.number().int().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const response = await callLLM({
        systemPrompt: `你是专业短剧统筹。请把长剧本智能拆分成连续集数，保留原文剧情顺序，不改写核心情节。

规则：
- 如果原文已有“第X集 / EP X / Episode X”标记，优先按原标记切分。
- 如果没有明确标记，根据剧情转折和场景段落拆成合理集数。
- 每集 scriptText 必须包含足够内容供后续分镜拆解，不能只写摘要。
- 不要创造原剧本不存在的剧情。
- 只返回 JSON。`,
        prompt: `项目总集数参考：${input.targetEpisodes ?? project.totalEpisodes ?? "未指定"}

剧本：
${input.scriptText.slice(0, 120000)}

请输出 JSON：
{
  "episodes": [
    { "episodeNumber": 1, "title": "本集标题", "scriptText": "本集完整剧本文本" }
  ]
}`,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "premium_episode_split",
            strict: true,
            schema: {
              type: "object",
              properties: {
                episodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      episodeNumber: { type: "integer" },
                      title: { type: "string" },
                      scriptText: { type: "string" },
                    },
                    required: ["episodeNumber", "title", "scriptText"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["episodes"],
              additionalProperties: false,
            },
          },
        },
      });

      let parsed: { episodes: Array<{ episodeNumber: number; title: string; scriptText: string }> };
      try {
        parsed = parseLlmJson(response, "智能分集");
      } catch {
        parsed = { episodes: splitScriptLocally(input.scriptText) };
      }
      const episodes = parsed.episodes
        .filter((ep) => ep.episodeNumber > 0 && ep.scriptText.trim().length >= 10)
        .sort((a, b) => a.episodeNumber - b.episodeNumber);
      if (episodes.length === 0) throw new Error("未能识别出有效集数");
      return { episodes };
    }),

  // ── 批量导入多集剧本（异步任务模式，立即返回 jobId） ────────────────────────
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
      const db = await getDb();
      const [project] = await db!
        .select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      // 创建任务记录，立即返回 jobId
      const [jobRow] = await db!.insert(batchJobs).values({
        userId: ctx.user.id,
        projectId,
        type: "batchParseScripts",
        status: "running",
        total: scripts.length,
        current: 0,
        currentName: `第 ${scripts[0].episodeNumber} 集`,
        succeeded: 0,
        failed: 0,
      });
      const jobId = (jobRow as any).insertId as number;

      // 后台异步执行
      setImmediate(async () => {
        let succeeded = 0;
        let failed = 0;
        for (let i = 0; i < scripts.length; i++) {
          const ep = scripts[i];
          await db!.update(batchJobs).set({ current: i, currentName: `第 ${ep.episodeNumber} 集` }).where(eq(batchJobs.id, jobId));
          try {
            const aspectLabel = project.aspectRatio === "portrait" ? "vertical 9:16" : "horizontal 16:9";
            const langLabel = language === "en" ? "English" : language === "zh" ? "Chinese" : language;
            const visualStyle = resolveProjectVisualStyle(project);

            const systemPrompt = `You are a professional film director, performance coach, and AI video shot breakdown specialist.
Break the script into shots for a premium Seedance 2.0 workflow.

Rules:
- Do not invent events not in the script.
- Do not force fixed shot duration.
- Each shot should usually be 6-15 seconds. Choose duration by dialogue length, action complexity, performance pauses, and visual density.
- One shot = one main dramatic task. Split if dialogue is too long, action is too dense, or multiple characters all need focus.
- Dialogue shots need pauses, tone, subtext, and reaction time. Chinese normal speed is 4-6 characters/sec; restrained speech is 2.5-4 characters/sec; argument can be 6-8 characters/sec.
- Performance must include negative space: hesitation, breath, gaze shift, small hand movement, silence before or after a line.
- Visual descriptions must use visible actions, composition, camera, lighting, material, atmosphere, and continuity constraints.
- All dialogue/narration must be in ${langLabel}
- Aspect ratio: ${aspectLabel}
- Project bible: ${project.projectBible || "not yet generated"}
- Visual style lock:
${visualStyle}
- NO subtitles in visual descriptions.`;

            const userPrompt = `Analyze this Episode ${ep.episodeNumber} script and generate a shot breakdown:

${ep.scriptText}

Return a JSON array of shots with this exact schema:
[
  {
    "shotNumber": 1,
    "sceneName": "Scene name",
    "shotType": "close_up|medium|wide|extreme_close|aerial|over_shoulder",
    "visualDescription": "中文分镜画面设计：主体、动作、空间、摄影机位置、光影、空气介质、材质、表演留白和连续性约束。",
    "dialogue": "Character dialogue in ${langLabel}, or empty string",
    "characters": "comma-separated character names",
    "emotion": "emotional tone plus performance subtext",
    "durationSec": 12
  }
]

Return ONLY the JSON array.`;

            const response = await callLLM({ systemPrompt, prompt: userPrompt });

            let shots: Array<{
              shotNumber: number; sceneName: string; shotType: string;
              visualDescription: string; dialogue: string; characters: string; emotion: string; durationSec?: number;
            }>;
            try {
              shots = parseLlmJson(response, "分镜设计");
            } catch {
              failed++;
              continue;
            }

            const dbInst = await getDb();
            await dbInst!.delete(scriptShots).where(
              and(eq(scriptShots.projectId, projectId), eq(scriptShots.userId, ctx.user.id), eq(scriptShots.episodeNumber, ep.episodeNumber))
            );

            if (shots.length > 0) {
              await dbInst!.insert(scriptShots).values(
                shots.map(s => ({
                  projectId, userId: ctx.user.id, episodeNumber: ep.episodeNumber,
                  shotNumber: s.shotNumber, sceneName: s.sceneName, shotType: s.shotType,
                  visualDescription: s.visualDescription, dialogue: s.dialogue,
                  characters: s.characters,
                  emotion: s.emotion,
                  videoDuration: Math.max(4, Math.min(15, s.durationSec ?? 12)),
                  status: "draft" as const,
                }))
              );
            }
            succeeded++;
          } catch {
            failed++;
          }
          // 集间间隔，避免限流
          if (i < scripts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
        await db!.update(batchJobs).set({ status: "done", current: scripts.length, succeeded, failed }).where(eq(batchJobs.id, jobId));
      });

      return { jobId, totalEpisodes: scripts.length };
    }),

  // ── 深度剧本解析（真人剧，克隆精品剧 analyzeScript，去除机甲/Q版） ──────────
  analyzeScriptFull: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scriptText: z.string().min(10).max(200000),
    }))
    .mutation(async ({ ctx, input }) => {
      const { projectId, scriptText } = input;
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const response = await callLLM({
        systemPrompt: ASSET_PROMPT_SYSTEM,
        prompt: `项目定义：
${project.definition || "未填写"}

项目圣经：
${project.projectBible || "未生成"}

摄影风格锁定：
${resolveProjectVisualStyle(project)}

剧本：
${scriptText.slice(0, 80000)}

请提取人物、场景、服化道、道具和自定义资产，并输出 JSON。`,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "asset_prompt_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                assets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["character", "scene", "costume", "prop", "custom"] },
                      name: { type: "string" },
                      status: { type: "string", enum: ["confirmed", "needs_user_input"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      mainWeight: { type: "string" },
                      supportingWeight: { type: "string" },
                      assetPrompt: { type: "string" },
                      continuityRule: { type: "string" },
                      variationRule: { type: "string" },
                      usedInEpisodes: { type: "string" },
                      conflictCheck: { type: "string" },
                    },
                    required: [
                      "type",
                      "name",
                      "status",
                      "priority",
                      "mainWeight",
                      "supportingWeight",
                      "assetPrompt",
                      "continuityRule",
                      "variationRule",
                      "usedInEpisodes",
                      "conflictCheck",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["assets"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = parseLlmJson<{
        assets: Array<{
          type: "character" | "scene" | "costume" | "prop" | "custom";
          name: string;
          status: "confirmed" | "needs_user_input";
          priority: "high" | "medium" | "low";
          mainWeight: string;
          supportingWeight: string;
          assetPrompt: string;
          continuityRule: string;
          variationRule: string;
          usedInEpisodes: string;
          conflictCheck: string;
        }>;
      }>(response, "资产识别");

      // 获取已有资产名称，避免重复
      const existingAssets = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.projectId, projectId), eq(overseasAssets.userId, ctx.user.id)));
      const existingNames = new Set(existingAssets.map(a => a.name.toLowerCase()));

      const created: Array<{ id: number; name: string; type: string }> = [];
      const skipped: string[] = [];

      for (const asset of parsed.assets) {
        const normalizedName = asset.name.toLowerCase();
        if (existingNames.has(normalizedName)) { skipped.push(asset.name); continue; }
        const description = [
          asset.mainWeight,
          asset.supportingWeight,
          `连续性：${asset.continuityRule}`,
          asset.variationRule ? `变化规则：${asset.variationRule}` : "",
          asset.conflictCheck ? `待确认：${asset.conflictCheck}` : "",
        ].filter(Boolean).join("\n");
        const [result] = await db!.insert(overseasAssets).values({
          projectId, userId: ctx.user.id,
          type: asset.type,
          name: asset.name,
          description,
          mjPrompt: asset.assetPrompt,
          stylePrompt: asset.assetPrompt,
          tags: `${asset.priority},${asset.status},${asset.usedInEpisodes}`,
        });
        created.push({ id: (result as any).insertId, name: asset.name, type: asset.type });
        existingNames.add(normalizedName);
      }

      return {
        created,
        skipped,
        addedCount: created.length,
        characters: created.filter(a => a.type === "character").length,
        scenes: created.filter(a => a.type === "scene").length,
        costumes: created.filter(a => a.type === "costume").length,
        props: created.filter(a => a.type === "prop").length,
        custom: created.filter(a => a.type === "custom").length,
      };
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

      const response = await callLLM({
        systemPrompt: `You are a professional film production asset manager. Analyze the script and extract all unique assets (characters, scenes, props) that need to be designed for production.

For each asset, provide:
- type: "character" | "scene"
- name: A concise English name (e.g., "LUCAS", "Abandoned Camp")
- description: Brief English description of appearance/characteristics
- tags: comma-separated tags for categorization
Rules:
- Characters: Extract ALL named characters with physical descriptions
- Scenes: Extract ALL unique locations/environments
- Do NOT duplicate entries
- Names should be in English, concise and clear`,
        prompt: `Analyze this script content and extract all production assets:\n\n${scriptContent.slice(0, 15000)}\n\nReturn a JSON array:\n[{"type":"character","name":"...","description":"...","tags":"..."}]\n\nReturn ONLY the JSON array.`,
      });

      const content = response;
      let detectedAssets: Array<{ type: "character" | "scene"; name: string; description: string; tags: string }>;
      try {
        detectedAssets = parseLlmJson(content, "资产识别");
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
        if (!["character", "scene"].includes(asset.type)) continue;
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
      field: z.enum(["mjImageUrl", "mainImageUrl", "styleImageUrl", "viewFrontUrl", "viewSideUrl", "viewBackUrl", "viewCloseUpUrl", "multiAngleGridUrl", "referenceImageUrl"]).default("referenceImageUrl"),
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
            const imgPromptRes = await callLLM({
              systemPrompt: `You are an expert AI image prompt writer for ${project.style} short drama production.
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
              prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write the FIRST frame (opening composition as shot begins) prompt.
Return ONLY the prompt text.`,
            });
            const firstFramePrompt = imgPromptRes.trim();
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
            const vidPromptRes = await callLLM({
              systemPrompt: `You are an expert AI video prompt writer for Seedance 1.5 Pro (doubao-seedance-1-5-pro).
Seedance 1.5 Pro excels at smooth character movement, cinematic camera work, and realistic lighting.
Write prompts that:
1. Start with the main subject and their action (what they're doing RIGHT NOW)
2. Describe the camera movement explicitly
3. Include lighting and atmosphere
4. Keep it 2-3 sentences, under 80 words
5. NO background music, NO subtitles, NO watermarks
Style: ${vidStyleKw}`,
              prompt: `Shot: ${shot.visualDescription}
${shot.dialogue ? `Spoken dialogue: "${shot.dialogue}"` : ""}
Characters: ${shot.characters || "none"}
Emotion: ${shot.emotion || "neutral"}
Shot type: ${shot.shotType || "medium shot"}
Scene: ${shot.sceneName || ""}

Write a Seedance 1.5 Pro video prompt.
${shot.dialogue ? `Character speaks: "${shot.dialogue}"` : ""}
Return ONLY the prompt text.`,
            });
            const videoPrompt = vidPromptRes.trim();
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
      // 将 history 拼入 prompt（callLLM 为单轮接口）
      const historyText = input.history.length > 0
        ? input.history.map(h => `${h.role === "user" ? "用户" : "助手"}：${h.content}`).join("\n") + "\n\n"
        : "";
      const response = await callLLM({
        systemPrompt,
        prompt: `${historyText}用户：${input.message}`,
      });
      const reply = response.trim();
      return { reply };
    }),

  // 查询批量任务进度
  getBatchJob: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const [job] = await db!.select().from(batchJobs)
        .where(and(eq(batchJobs.id, input.jobId), eq(batchJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      return job;
    }),

  // 一键批量生成所有资产图片（异步后台执行，立即返回 jobId）
  batchGenerateAllImages: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      overwrite: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!.select().from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const assets = await db!.select().from(overseasAssets)
        .where(and(eq(overseasAssets.projectId, input.projectId), eq(overseasAssets.userId, ctx.user.id)))
        .orderBy(asc(overseasAssets.sortOrder));

      // 创建批量任务记录，立即返回 jobId
      const [jobRow] = await db!.insert(batchJobs).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        type: "generateAllImages",
        status: "running",
        total: assets.length,
        current: 0,
        currentName: "",
        succeeded: 0,
        failed: 0,
      });
      const jobId = (jobRow as any).insertId as number;
      const userId = ctx.user.id;

      // 后台异步执行，不阻塞 HTTP 请求
      setImmediate(async () => {
        let succeeded = 0;
        let failed = 0;
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i];
          await db!.update(batchJobs).set({ current: i + 1, currentName: asset.name }).where(eq(batchJobs.id, jobId));
          try {
            if (asset.type === "character") {
              if (!input.overwrite && asset.mainImageUrl) { succeeded++; continue; }
              const styleMap: Record<string, string> = {
                realistic: "photorealistic, cinematic, 8K, film grain",
                anime: "anime style, vibrant colors, detailed illustration",
                cartoon: "cartoon style, bold outlines, flat colors",
                watercolor: "watercolor painting, soft edges, artistic",
              };
              const styleKw = styleMap[project.style ?? "realistic"] ?? "photorealistic, cinematic, 8K";
              const mjPrompt = asset.mjPrompt ||
                `${asset.name}, ${asset.description ?? ""}, full body portrait, solo, front view, pure white background, clean studio lighting, sharp face details, ${styleKw}, 9:16 --ar 9:16 --style raw --q 2`;
              const { url } = await generateImage({
                prompt: mjPrompt,
                engine: "midjourney",
                s3KeyPrefix: `overseas-assets/${userId}`,
              });
              await db!.update(overseasAssets).set({ mainImageUrl: url }).where(eq(overseasAssets.id, asset.id));
              succeeded++;
            } else if (asset.type === "scene") {
              if (!input.overwrite && (asset.viewFrontUrl || asset.viewSideUrl)) { succeeded++; continue; }
              const styleMap: Record<string, string> = {
                realistic: "photorealistic, cinematic, 8K, film grain",
                anime: "anime style, vibrant colors, detailed illustration",
                cartoon: "cartoon style, bold outlines, flat colors",
                watercolor: "watercolor painting, soft edges, artistic",
              };
              const styleKw = styleMap[project.style ?? "realistic"] ?? "photorealistic, cinematic, 8K";
              const sceneDesc = asset.description ?? "";
              const llmScenePrompt = `你是专业的 AI 影片制作提示词工程师。请根据以下场景信息，生成 4 个用于 Seedream 5.0 的场景参考图英文提示词。\n场景名称：${asset.name}\n场景描述：${sceneDesc || "无"}\n整体风格：${styleKw}\n要求：生成 4 个不同拍摄角度的场景图提示词（全景建立镜头、内景中景、环境细节特写、氛围光影）。所有提示词必须：无人物、无文字、写实风格、16:9画幅、4K。\n请严格输出 JSON 格式：{"view1": "...", "view2": "...", "view3": "...", "view4": "..."}`;
              let scenePrompts: { view1: string; view2: string; view3: string; view4: string } | null = null;
              try {
                const llmRaw = await callLLM({ prompt: llmScenePrompt });
                scenePrompts = parseLlmJson(llmRaw, "场景多视角提示词");
              } catch { /* 降级为固定模板 */ }
              const baseScene = `${asset.name}${sceneDesc ? ", " + sceneDesc : ""}`;
              const sceneViews: Array<{ field: string; prompt: string }> = [
                { field: "viewFrontUrl", prompt: scenePrompts?.view1 ?? `${baseScene}, wide establishing shot, cinematic 16:9, ${styleKw}, no people, no humans, photorealistic, 4K, atmospheric lighting` },
                { field: "viewSideUrl", prompt: scenePrompts?.view2 ?? `${baseScene}, interior medium shot, cinematic 16:9, ${styleKw}, no people, no humans, photorealistic, 4K, warm ambient lighting` },
                { field: "viewBackUrl", prompt: scenePrompts?.view3 ?? `${baseScene}, close-up detail shot, cinematic 16:9, ${styleKw}, no people, no humans, photorealistic, 4K, dramatic lighting` },
                { field: "viewCloseUpUrl", prompt: scenePrompts?.view4 ?? `${baseScene}, mood atmosphere shot, cinematic 16:9, ${styleKw}, no people, no humans, photorealistic, 4K, cinematic color grading` },
              ];
              const sceneResults: Record<string, string> = {};
              await Promise.all(sceneViews.map(async (v) => {
                try {
                  const { url: savedUrl } = await generateImage({
                    prompt: v.prompt,
                    engine: "seedream-5.0",
                    aspectRatio: "16:9",
                    s3KeyPrefix: `overseas-assets/${userId}`,
                  });
                  sceneResults[v.field] = savedUrl;
                } catch { /* skip */ }
              }));
              if (Object.keys(sceneResults).length > 0) {
                await db!.update(overseasAssets).set(sceneResults).where(eq(overseasAssets.id, asset.id));
              }
              succeeded++;
            }
            await new Promise(r => setTimeout(r, 1500));
          } catch {
            failed++;
          }
          await db!.update(batchJobs).set({ succeeded, failed }).where(eq(batchJobs.id, jobId));
        }
        await db!.update(batchJobs).set({ status: "done", succeeded, failed }).where(eq(batchJobs.id, jobId));
      });

      return { jobId, total: assets.length };
    }),

  // ── 精品剧：生成分镜草图（image2 黑白简笔画）──────────────────────────────
  generateStoryboardSketch: protectedProcedure
    .input(premiumVisualSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, shot.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const prompt = input.prompt?.trim() || await generateStoryboardSketchPrompt(
        shotToInfo(shot, shot.videoDuration ?? 15),
        resolveProjectVisualStyle(project),
        {
          projectDefinition: project.definition,
          projectBible: project.projectBible,
          visualStylePreset: project.visualStylePreset,
          styleEnhancers: parseStyleEnhancers(project.styleEnhancers),
          visualStylePrompt: resolveProjectVisualStyle(project),
          aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
        }
      );
      const aspectRatio = project.aspectRatio === "landscape" ? "16:9" : "9:16";
      const { url } = await generateImage({
        prompt,
        engine: toImageEngine(input.imageEngine),
        aspectRatio,
        s3KeyPrefix: `premium-storyboards/${ctx.user.id}/${shot.projectId}`,
      });

      await db!
        .update(scriptShots)
        .set({ storyboardPrompt: prompt, storyboardSketchUrl: url })
        .where(eq(scriptShots.id, shot.id));

      let assetId: number | null = null;
      if (input.addToAssetLibrary) {
        const [result] = await db!.insert(overseasAssets).values({
          projectId: shot.projectId,
          userId: ctx.user.id,
          type: "storyboard",
          name: `EP${shot.episodeNumber}-${shot.shotNumber} 分镜草图`,
          description: shot.visualDescription,
          referenceImageUrl: url,
          mainImageUrl: url,
          tags: `episode:${shot.episodeNumber},shot:${shot.shotNumber}`,
        });
        assetId = (result as any).insertId as number;
      }

      return { shotId: shot.id, prompt, url, assetId };
    }),

  // ── 精品剧：生成视频提示词（Seedance 2.0 多参考）──────────────────────────
  generatePremiumVideoPrompt: protectedProcedure
    .input(premiumVideoPromptSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, shot.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      let assets = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.projectId, shot.projectId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (input.referenceAssetIds?.length) {
        const ids = new Set(input.referenceAssetIds);
        assets = assets.filter((asset) => ids.has(asset.id));
      }

      const referenceImages: Seedance2ReferenceImage[] = assets
        .map((asset) => {
          const url = assetImageUrl(asset);
          if (!url) return null;
          return { role: assetReferenceRole(asset), url, name: asset.name };
        })
        .filter((item): item is Seedance2ReferenceImage => !!item)
        .slice(0, 9);

      const prompt = await generateSeedance2Prompt(
        shotToInfo(shot, input.duration),
        referenceImages,
        {
          projectDefinition: project.definition,
          projectBible: project.projectBible,
          visualStylePreset: project.visualStylePreset,
          styleEnhancers: parseStyleEnhancers(project.styleEnhancers),
          visualStylePrompt: resolveProjectVisualStyle(project),
          aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
        }
      );
      const referenceImageUrls = referenceImages.map((item) => item.url);

      await db!
        .update(scriptShots)
        .set({
          videoPrompt: prompt,
          subjectRefUrls: JSON.stringify(referenceImageUrls),
          videoDuration: input.duration,
          videoEngine: "seedance_2_0",
        })
        .where(eq(scriptShots.id, shot.id));

      return { shotId: shot.id, prompt, referenceImageUrls };
    }),

  // ── 精品剧：多个分镜合成一个 15 秒 Seedance 2.0 视频段提示词 ───────────────
  generateVideoSegmentPrompt: protectedProcedure
    .input(premiumVideoSegmentPromptSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, input.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const allProjectShots = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.projectId, input.projectId), eq(scriptShots.userId, ctx.user.id)))
        .orderBy(scriptShots.episodeNumber, scriptShots.shotNumber);
      const shotIdSet = new Set(input.shotIds);
      const shots = allProjectShots.filter((shot) => shotIdSet.has(shot.id));
      if (shots.length === 0) throw new Error("未找到可用于合成视频段的分镜");

      let assets = await db!.select().from(overseasAssets).where(
        and(eq(overseasAssets.projectId, input.projectId), eq(overseasAssets.userId, ctx.user.id))
      );
      if (input.referenceAssetIds?.length) {
        const ids = new Set(input.referenceAssetIds);
        assets = assets.filter((asset) => ids.has(asset.id));
      }

      const referenceImages: Seedance2ReferenceImage[] = assets
        .map((asset) => {
          const url = assetImageUrl(asset);
          if (!url) return null;
          return { role: assetReferenceRole(asset), url, name: asset.name };
        })
        .filter((item): item is Seedance2ReferenceImage => !!item)
        .slice(0, 9);

      const firstShot = shots[0];
      const combinedShot: ShotInfo = {
        shotNumber: firstShot.shotNumber,
        sceneName: Array.from(new Set(shots.map((shot) => shot.sceneName).filter(Boolean))).join(" / ") || firstShot.sceneName || "",
        shotType: "video segment composed from multiple storyboard shots",
        visualDescription: shots
          .map((shot, index) => {
            const dialogue = shot.dialogue ? ` 台词：${shot.dialogue}` : "";
            const emotion = shot.emotion ? ` 情绪：${shot.emotion}` : "";
            return `分镜${index + 1}（EP${shot.episodeNumber}-${shot.shotNumber}）：${shot.visualDescription || ""}${dialogue}${emotion}`;
          })
          .join("\n"),
        dialogue: shots.map((shot) => shot.dialogue).filter(Boolean).join("\n") || undefined,
        characters: Array.from(new Set(shots.map((shot) => shot.characters).filter(Boolean))).join("、") || undefined,
        emotion: Array.from(new Set(shots.map((shot) => shot.emotion).filter(Boolean))).join("、") || undefined,
        duration: input.duration,
      };

      const prompt = await generateSeedance2Prompt(
        combinedShot,
        referenceImages,
        {
          projectDefinition: project.definition,
          projectBible: project.projectBible,
          visualStylePreset: project.visualStylePreset,
          styleEnhancers: parseStyleEnhancers(project.styleEnhancers),
          visualStylePrompt: resolveProjectVisualStyle(project),
          aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
        }
      );
      const referenceImageUrls = referenceImages.map((item) => item.url);

      await db!
        .update(scriptShots)
        .set({
          videoPrompt: prompt,
          subjectRefUrls: JSON.stringify(referenceImageUrls),
          videoDuration: input.duration,
          videoEngine: "seedance_2_0",
        })
        .where(and(eq(scriptShots.id, firstShot.id), eq(scriptShots.userId, ctx.user.id)));

      return { shotId: firstShot.id, shotIds: shots.map((shot) => shot.id), prompt, referenceImageUrls };
    }),

  // ── 精品剧：生成 15 秒调度与机位示意图（image2）───────────────────────────
  generateCameraDiagram: protectedProcedure
    .input(premiumVisualSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, shot.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const prompt = input.prompt?.trim() || await generateCameraDiagramPrompt(
        shotToInfo(shot, shot.videoDuration ?? 15),
        shot.videoPrompt ?? undefined,
        {
          projectDefinition: project.definition,
          projectBible: project.projectBible,
          visualStylePreset: project.visualStylePreset,
          styleEnhancers: parseStyleEnhancers(project.styleEnhancers),
          visualStylePrompt: resolveProjectVisualStyle(project),
          aspectRatio: project.aspectRatio === "portrait" ? "9:16" : "16:9",
        }
      );
      const aspectRatio = project.aspectRatio === "landscape" ? "16:9" : "9:16";
      const { url } = await generateImage({
        prompt,
        engine: toImageEngine(input.imageEngine),
        aspectRatio,
        s3KeyPrefix: `premium-camera-diagrams/${ctx.user.id}/${shot.projectId}`,
      });

      await db!
        .update(scriptShots)
        .set({ cameraDiagramPrompt: prompt, cameraDiagramUrl: url })
        .where(eq(scriptShots.id, shot.id));

      let assetId: number | null = null;
      if (input.addToAssetLibrary) {
        const [result] = await db!.insert(overseasAssets).values({
          projectId: shot.projectId,
          userId: ctx.user.id,
          type: "camera_diagram",
          name: `EP${shot.episodeNumber}-${shot.shotNumber} 机位示意图`,
          description: shot.videoPrompt || shot.visualDescription,
          referenceImageUrl: url,
          mainImageUrl: url,
          tags: `episode:${shot.episodeNumber},shot:${shot.shotNumber}`,
        });
        assetId = (result as any).insertId as number;
      }

      return { shotId: shot.id, prompt, url, assetId };
    }),

  // ── 精品剧：把分镜草图/机位图加入资产库 ─────────────────────────────────
  addShotVisualToAssetLibrary: protectedProcedure
    .input(shotVisualAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");

      const isStoryboard = input.kind === "storyboard";
      const url = isStoryboard ? shot.storyboardSketchUrl : shot.cameraDiagramUrl;
      const prompt = isStoryboard ? shot.storyboardPrompt : shot.cameraDiagramPrompt;
      if (!url) throw new Error(isStoryboard ? "分镜草图尚未生成" : "机位示意图尚未生成");

      const [result] = await db!.insert(overseasAssets).values({
        projectId: shot.projectId,
        userId: ctx.user.id,
        type: input.kind,
        name: `EP${shot.episodeNumber}-${shot.shotNumber} ${isStoryboard ? "分镜草图" : "机位示意图"}`,
        description: prompt || shot.visualDescription,
        referenceImageUrl: url,
        mainImageUrl: url,
        tags: `episode:${shot.episodeNumber},shot:${shot.shotNumber}`,
      });

      return { assetId: (result as any).insertId as number, url };
    }),

  // ── 精品剧：Seedance 2.0 多参考视频生成 ──────────────────────────────────
  generatePremiumVideo: protectedProcedure
    .input(premiumVideoSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");
      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(and(eq(overseasProjects.id, shot.projectId), eq(overseasProjects.userId, ctx.user.id)));
      if (!project) throw new Error("Project not found");

      const prompt = input.prompt?.trim() || shot.videoPrompt;
      if (!prompt?.trim()) throw new Error("请先生成或填写 Seedance 2.0 视频提示词");
      let referenceImageUrls = input.referenceImageUrls;
      if (!referenceImageUrls?.length && shot.subjectRefUrls) {
        try {
          referenceImageUrls = JSON.parse(shot.subjectRefUrls) as string[];
        } catch {
          referenceImageUrls = [];
        }
      }
      const aspectRatio = input.aspectRatio ?? (project.aspectRatio === "landscape" ? "16:9" : "9:16");

      await db!
        .update(scriptShots)
        .set({ status: "generating_video", errorMessage: null })
        .where(eq(scriptShots.id, shot.id));

      try {
        const { url: s3VideoUrl, taskId } = await generateVideo({
          prompt,
          engine: "seedance-2.0",
          referenceImageUrls: referenceImageUrls?.slice(0, 9),
          duration: input.duration,
          aspectRatio,
          s3KeyPrefix: `premium-videos/${ctx.user.id}/${shot.projectId}`,
        });

        await db!.insert(videoJobs).values({
          userId: ctx.user.id,
          shotId: shot.id,
          engine: "seedance_2_0",
          externalJobId: taskId,
          status: "done",
          videoUrl: s3VideoUrl,
        });
        await db!
          .update(scriptShots)
          .set({
            videoUrl: s3VideoUrl,
            videoPrompt: prompt,
            subjectRefUrls: JSON.stringify(referenceImageUrls ?? []),
            videoDuration: input.duration,
            videoEngine: "seedance_2_0",
            status: "done",
          })
          .where(eq(scriptShots.id, shot.id));

        return { shotId: shot.id, videoUrl: s3VideoUrl, taskId };
      } catch (err: any) {
        await db!
          .update(scriptShots)
          .set({ status: "failed", errorMessage: err?.message ?? "视频生成失败" })
          .where(eq(scriptShots.id, shot.id));
        throw err;
      }
    }),

  // ── 生成首尾帧提示词（跑量剧）────────────────────────────────────────────────
  /**
   * 根据分镜描述 + 项目角色/场景信息，调用 prompt-engine 生成首帧和尾帧提示词，
   * 并保存到 scriptShots 表。
   */
  generateFramePrompts: protectedProcedure
    .input(z.object({ shotId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");

      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(eq(overseasProjects.id, shot.projectId));
      if (!project) throw new Error("Project not found");

      // 解析项目角色和场景列表（JSON 字符串 → 数组）
      let characterMap: Record<string, string> = {};
      let sceneMap: Record<string, string> = {};
      try {
        const chars = JSON.parse(project.characters ?? "[]") as Array<{ name: string; description?: string }>;
        for (const c of chars) characterMap[c.name] = c.description ?? "";
      } catch { /* ignore */ }
      try {
        const scenes = JSON.parse(project.scenes ?? "[]") as Array<{ name: string; description?: string }>;
        for (const s of scenes) sceneMap[s.name] = s.description ?? "";
      } catch { /* ignore */ }

      const shotInfo: ShotInfo = {
        shotNumber: shot.shotNumber,
        sceneName: shot.sceneName ?? "",
        shotType: shot.shotType ?? "medium shot",
        visualDescription: shot.visualDescription ?? "",
        dialogue: shot.dialogue ?? undefined,
        characters: shot.characters ?? undefined,
        emotion: shot.emotion ?? undefined,
        duration: shot.videoDuration ?? 5,
      };

      const { firstFrame, lastFrame } = await generateFramePrompts(shotInfo, characterMap, sceneMap);

      await db!
        .update(scriptShots)
        .set({ firstFramePrompt: firstFrame, lastFramePrompt: lastFrame })
        .where(eq(scriptShots.id, input.shotId));

      return { shotId: input.shotId, firstFramePrompt: firstFrame, lastFramePrompt: lastFrame };
    }),

  // ── 生成首尾帧图片（跑量剧）────────────────────────────────────────────────
  /**
   * 使用 image-service 生成首帧图和（可选）尾帧图，保存 S3 URL 到 scriptShots。
   * 要求 shot 已有 firstFramePrompt（可先调用 generateFramePrompts）。
   */
  generateFrameImages: protectedProcedure
    .input(z.object({
      shotId: z.number().int(),
      /** 图片引擎，默认 seedream-4.5 */
      imageEngine: z.string().default("seedream-4.5"),
      /** 是否同时生成尾帧图，默认 true */
      generateLastFrame: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const [shot] = await db!
        .select()
        .from(scriptShots)
        .where(and(eq(scriptShots.id, input.shotId), eq(scriptShots.userId, ctx.user.id)));
      if (!shot) throw new Error("Shot not found");
      if (!shot.firstFramePrompt) throw new Error("首帧提示词不存在，请先生成首尾帧提示词");

      const [project] = await db!
        .select()
        .from(overseasProjects)
        .where(eq(overseasProjects.id, shot.projectId));

      const aspectRatio = (project?.aspectRatio === "landscape" ? "16:9" : "9:16") as "16:9" | "9:16";
      const s3Prefix = `overseas-frames/${ctx.user.id}/${shot.projectId}`;

      // 标记生成中
      await db!.update(scriptShots).set({ status: "generating_frame" }).where(eq(scriptShots.id, input.shotId));

      try {
        // 生成首帧
        const { url: firstFrameUrl } = await generateImage({
          prompt: shot.firstFramePrompt,
          engine: input.imageEngine as any,
          aspectRatio,
          s3KeyPrefix: s3Prefix,
        });

        const updates: Record<string, string> = { firstFrameUrl, imageEngine: input.imageEngine, status: "frame_done" };

        // 生成尾帧（如有提示词且要求生成）
        if (input.generateLastFrame && shot.lastFramePrompt) {
          const { url: lastFrameUrl } = await generateImage({
            prompt: shot.lastFramePrompt,
            engine: input.imageEngine as any,
            aspectRatio,
            s3KeyPrefix: s3Prefix,
          });
          updates.lastFrameUrl = lastFrameUrl;
        }

        await db!.update(scriptShots).set(updates as any).where(eq(scriptShots.id, input.shotId));

        return {
          shotId: input.shotId,
          firstFrameUrl,
          lastFrameUrl: updates.lastFrameUrl,
        };
      } catch (err: any) {
        await db!
          .update(scriptShots)
          .set({ status: "failed", errorMessage: err?.message ?? "生成失败" })
          .where(eq(scriptShots.id, input.shotId));
        throw err;
      }
    }),
});

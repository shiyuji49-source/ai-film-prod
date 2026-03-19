import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getUserAssets,
  getAssetById,
  createAsset,
  updateAsset,
  softDeleteAsset,
  addAssetHistory,
  getAssetHistory,
} from "../db";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

// 积分消耗配置
const CREDITS = {
  generateMain: 10,           // 生成主视图
  generateMulti: 8,           // 生成三视图/多视角（每张）
  generateCharDesign: 15,     // 生成人物16:9设计主图
  splitCharDesign: 2,         // 切分设计图（每张）
};

// 通用扣积分函数
async function deductCredits(userId: number, currentCredits: number, amount: number, note: string) {
  const { getDb } = await import("../db");
  const { users, creditLogs } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return currentCredits;
  const newCredits = currentCredits - amount;
  await db.update(users).set({ credits: newCredits }).where(eq(users.id, userId));
  await db.insert(creditLogs).values({
    userId,
    delta: -amount,
    balance: newCredits,
    action: "generate_prompt",
    note,
  });
  return newCredits;
}

export const assetsRouter = router({
  // 获取资产列表
  list: protectedProcedure
    .input(z.object({ type: z.enum(["character", "scene", "prop"]).optional() }))
    .query(async ({ ctx, input }) => {
      return getUserAssets(ctx.user.id, input.type as "character" | "scene" | undefined);
    }),

  // 获取单个资产
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      return asset;
    }),

  // 创建资产（草稿）
  create: protectedProcedure
    .input(z.object({
      type: z.enum(["character", "scene", "prop"]),
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      mjPrompt: z.string().optional(),
      mainPrompt: z.string().optional(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createAsset({
        userId: ctx.user.id,
        type: input.type as "character" | "scene",
        name: input.name,
        description: input.description,
        mjPrompt: input.mjPrompt,
        mainPrompt: input.mainPrompt,
        projectId: input.projectId,
      });
    }),

  // 更新资产基本信息（包含提示词）
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      description: z.string().optional(),
      mjPrompt: z.string().optional(),
      mainPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      await updateAsset(input.id, ctx.user.id, {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.mjPrompt !== undefined && { mjPrompt: input.mjPrompt }),
        ...(input.mainPrompt !== undefined && { mainPrompt: input.mainPrompt }),
      });
      return { success: true };
    }),

  // 删除资产
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      await softDeleteAsset(input.id, ctx.user.id);
      return { success: true };
    }),

  // 上传 MJ 原图到 S3（前端 base64 → 后端上传）
  uploadImage: protectedProcedure
    .input(z.object({
      id: z.number(),
      imageBase64: z.string().min(1),
      mimeType: z.string().default("image/png"),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });

      try {
        const imgBuffer = Buffer.from(input.imageBase64, "base64");
        if (imgBuffer.length > 16 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "图片大小不能超过 16MB" });
        }
        const ext = input.mimeType.split("/")[1] ?? "png";
        const fileKey = `assets/${ctx.user.id}/${input.id}-upload-${nanoid(8)}.${ext}`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, input.mimeType);
        await updateAsset(input.id, ctx.user.id, { uploadedImageUrl: s3Url });
        return { success: true, uploadedImageUrl: s3Url };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片上传失败，请重试" });
      }
    }),

  // ── 人物资产专用：生成单张视角图（9:16）──
  // viewType: closeup=近景肖像 | front=正视全身 | side=侧视全身 | back=背视全身
  generateCharacterView: protectedProcedure
    .input(z.object({
      id: z.number(),
      viewType: z.enum(["closeup", "front", "side", "back"]),
      nanoPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      if (!asset.uploadedImageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先上传 MJ 参考图" });
      }
      if (ctx.user.credits < CREDITS.generateMulti) {
        throw new TRPCError({ code: "FORBIDDEN", message: `积分不足，生成视角图需要 ${CREDITS.generateMulti} 积分` });
      }

      const VIEW_PROMPTS: Record<string, string> = {
        closeup: "close-up portrait, face and upper chest only, looking forward, highly detailed facial features, dramatic lighting, 9:16 vertical format, pure white or neutral background",
        front:   "full body FRONT VIEW, character standing straight facing camera, A-pose or neutral stance, full height from head to toe visible, pure white background, character design sheet style, 9:16 vertical format",
        side:    "full body SIDE VIEW (90 degree profile), character standing straight facing left, full height from head to toe visible, pure white background, character design sheet style, 9:16 vertical format",
        back:    "full body BACK VIEW, character standing straight facing away from camera, full height from head to toe visible, pure white background, character design sheet style, 9:16 vertical format",
      };
      const VIEW_LABELS: Record<string, string> = {
        closeup: "近景肖像", front: "正视全身", side: "侧视全身", back: "背视全身",
      };

      const baseViewPrompt = VIEW_PROMPTS[input.viewType];
      const designPrompt = input.nanoPrompt?.trim()
        ? `${baseViewPrompt}, ${input.nanoPrompt.trim()}, maintain exact same art style and character appearance as the reference image, high quality`
        : `${baseViewPrompt}, maintain exact same art style and character appearance as the reference image, high quality`;

      try {
        const genResult = await generateImage({
          prompt: designPrompt,
          originalImages: [{ url: asset.uploadedImageUrl, mimeType: "image/jpeg" }],
        });
        if (!genResult.url) throw new Error("图片生成返回空URL");

        const imgResp = await fetch(genResult.url);
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const fileKey = `assets/${ctx.user.id}/${input.id}-${input.viewType}-${nanoid(8)}.png`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, "image/png");

        await deductCredits(ctx.user.id, ctx.user.credits, CREDITS.generateMulti, `生成角色${VIEW_LABELS[input.viewType]}: ${asset.name}`);

        await addAssetHistory({
          assetId: input.id,
          userId: ctx.user.id,
          imageType: input.viewType,
          imageUrl: s3Url,
          prompt: designPrompt,
        });

        // 保存到 multiViewUrls
        const existing = asset.multiViewUrls ? JSON.parse(asset.multiViewUrls) : {};
        existing[input.viewType] = s3Url;
        await updateAsset(input.id, ctx.user.id, {
          multiViewUrls: JSON.stringify(existing),
          status: "done",
        });

        return { success: true, imageUrl: s3Url, viewType: input.viewType };
      } catch (err) {
        await updateAsset(input.id, ctx.user.id, { status: "failed" });
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "视角图生成失败，请重试" });
      }
    }),

  // ── 人物资产专用：将4张视角图拼合成 16:9 横版设计主图 ──
  mergeCharacterDesign: protectedProcedure
    .input(z.object({
      id: z.number(),
      // 前端直接传入已生成的视角图 URL，避免数据库竞态导致的数据丢失
      closeupUrl: z.string().url(),
      frontUrl: z.string().url(),
      sideUrl: z.string().url(),
      backUrl: z.string().url(),
      charName: z.string().optional(), // 角色名，用于底部水印标注
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });

      // 使用前端传入的 URL，同时更新数据库中的 multiViewUrls
      const views = {
        closeup: input.closeupUrl,
        front: input.frontUrl,
        side: input.sideUrl,
        back: input.backUrl,
      };
      // 同步更新数据库中的 multiViewUrls
      await updateAsset(input.id, ctx.user.id, { multiViewUrls: JSON.stringify(views) });

      try {
        const sharp = (await import("sharp")).default;

        // 下载4张视角图
        const viewOrder = ["closeup", "front", "side", "back"] as const;
        const buffers: Buffer[] = [];
        for (const v of viewOrder) {
          const resp = await fetch(views[v]);
          buffers.push(Buffer.from(await resp.arrayBuffer()));
        }

        // 获取各图尺寸，统一高度为最大高度
        const metas = await Promise.all(buffers.map(b => sharp(b).metadata()));
        const targetH = Math.max(...metas.map(m => m.height ?? 900));

        // 将每张图缩放到统一高度，保持宽高比
        const resized: { buf: Buffer; w: number }[] = [];
        for (let i = 0; i < 4; i++) {
          const origW = metas[i].width ?? 600;
          const origH = metas[i].height ?? 900;
          const newW = Math.round(origW * targetH / origH);
          const buf = await sharp(buffers[i]).resize(newW, targetH).png().toBuffer();
          resized.push({ buf, w: newW });
        }

        // 计算总宽度，拼合
        const totalW = resized.reduce((s, r) => s + r.w, 0);
        let offsetX = 0;
        const composites: { input: Buffer; left: number; top: number }[] = [];
        for (const r of resized) {
          composites.push({ input: r.buf, left: offsetX, top: 0 });
          offsetX += r.w;
        }

        const stitched = await sharp({
          create: { width: totalW, height: targetH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
        })
          .composite(composites)
          .png()
          .toBuffer();

        // 强制输出真正16:9比例：以实际宽度计算目标高度，不足则上下填白边
        const targetW16x9 = totalW;
        // 底部水印条高度（约4%的高度，最小40px）
        const watermarkBarH = Math.max(40, Math.round(totalW * 9 / 16 * 0.045));
        // 16:9 总高度 = 图片区域高度 + 水印条高度
        const imgAreaH = Math.round(totalW * 9 / 16) - watermarkBarH;
        const targetH16x9 = Math.round(totalW * 9 / 16);
        let imgArea: Buffer;
        if (imgAreaH === targetH) {
          imgArea = stitched;
        } else if (imgAreaH > targetH) {
          // 高度不够，上下填白边
          const topPad = Math.floor((imgAreaH - targetH) / 2);
          imgArea = await sharp({
            create: { width: targetW16x9, height: imgAreaH, channels: 4, background: { r: 20, g: 20, b: 30, alpha: 1 } },
          })
            .composite([{ input: stitched, left: 0, top: topPad }])
            .png()
            .toBuffer();
        } else {
          // 高度过够，中心裁剪
          const cropTop = Math.floor((targetH - imgAreaH) / 2);
          imgArea = await sharp(stitched)
            .extract({ left: 0, top: cropTop, width: targetW16x9, height: imgAreaH })
            .png()
            .toBuffer();
        }

        // 生成底部水印条：深色背景 + 角色名 + 4个视角标签
        const charNameText = input.charName || asset.name || "角色";
        const viewLabels = ["近景肖像", "正视全身", "侧视全身", "背视全身"];
        const fontSize = Math.max(16, Math.round(watermarkBarH * 0.45));
        const labelFontSize = Math.max(12, Math.round(watermarkBarH * 0.32));
        const singleW = Math.round(totalW / 4);

        // 构建 SVG 水印条
        const svgLabels = viewLabels.map((label, i) => {
          const cx = Math.round(singleW * i + singleW / 2);
          return `<text x="${cx}" y="${Math.round(watermarkBarH * 0.72)}" font-family="Arial, sans-serif" font-size="${labelFontSize}" fill="rgba(180,180,200,0.85)" text-anchor="middle">${label}</text>`;
        }).join("");

        const watermarkSvg = Buffer.from(`<svg width="${targetW16x9}" height="${watermarkBarH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${targetW16x9}" height="${watermarkBarH}" fill="rgba(12,12,20,0.95)"/>
  <line x1="0" y1="0" x2="${targetW16x9}" y2="0" stroke="rgba(100,100,160,0.4)" stroke-width="1"/>
  <text x="${Math.round(targetW16x9 / 2)}" y="${Math.round(watermarkBarH * 0.55)}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(220,220,255,0.95)" text-anchor="middle">${charNameText} — 角色全视角设计图</text>
  ${svgLabels}
  ${viewLabels.map((_, i) => i > 0 ? `<line x1="${singleW * i}" y1="4" x2="${singleW * i}" y2="${watermarkBarH - 4}" stroke="rgba(80,80,120,0.4)" stroke-width="1"/>` : "").join("")}
</svg>`);

        // 合并图片区域 + 水印条
        const merged = await sharp({
          create: { width: targetW16x9, height: targetH16x9, channels: 4, background: { r: 12, g: 12, b: 20, alpha: 1 } },
        })
          .composite([
            { input: imgArea, left: 0, top: 0 },
            { input: watermarkSvg, left: 0, top: imgAreaH },
          ])
          .png()
          .toBuffer();

        const fileKey = `assets/${ctx.user.id}/${input.id}-chardesign-merged-${nanoid(8)}.png`;
        const { url: s3Url } = await storagePut(fileKey, merged, "image/png");

        await addAssetHistory({
          assetId: input.id,
          userId: ctx.user.id,
          imageType: "chardesign",
          imageUrl: s3Url,
          prompt: "merged from 4 view images: closeup + front + side + back",
        });

        await updateAsset(input.id, ctx.user.id, {
          mainImageUrl: s3Url,
          generationModel: "nano-banana-pro",
          status: "done",
        });

        return { success: true, imageUrl: s3Url };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片拼合失败，请重试" });
      }
    }),

  // ── 人物资产专用：从合图中切分出4张视角图（兼容旧版合图）──
  splitCharacterDesign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      if (!asset.mainImageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先生成角色设计主图" });
      }

      try {
        const sharp = (await import("sharp")).default;
        const imgResp = await fetch(asset.mainImageUrl);
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const metadata = await sharp(imgBuffer).metadata();
        const W = metadata.width ?? 1600;
        const H = metadata.height ?? 900;
        const colW = Math.floor(W / 4);

        const crops = [
          { key: "closeup", label: "近景",   left: 0,         top: 0, width: colW,         height: H },
          { key: "front",   label: "正视图", left: colW,      top: 0, width: colW,         height: H },
          { key: "side",    label: "侧视图", left: colW * 2,  top: 0, width: colW,         height: H },
          { key: "back",    label: "后视图", left: colW * 3,  top: 0, width: W - colW * 3, height: H },
        ];

        const results: Record<string, string> = {};
        const existing = asset.multiViewUrls ? JSON.parse(asset.multiViewUrls) : {};

        for (const crop of crops) {
          const cropped = await sharp(imgBuffer)
            .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
            .png().toBuffer();
          const fileKey = `assets/${ctx.user.id}/${input.id}-${crop.key}-${nanoid(8)}.png`;
          const { url: s3Url } = await storagePut(fileKey, cropped, "image/png");
          results[crop.key] = s3Url;
          existing[crop.key] = s3Url;
          await addAssetHistory({ assetId: input.id, userId: ctx.user.id, imageType: crop.key, imageUrl: s3Url, prompt: `split: ${crop.label}` });
        }

        await updateAsset(input.id, ctx.user.id, { multiViewUrls: JSON.stringify(existing), status: "done" });
        await deductCredits(ctx.user.id, ctx.user.credits, CREDITS.splitCharDesign * 4, `切分角色设计图: ${asset.name}`);

        return { success: true, splitUrls: results };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片切分失败，请重试" });
      }
    }),

  // 基于上传图生成主视图（Gemini 3 Pro Image 图生图）
  generateMain: protectedProcedure
    .input(z.object({
      id: z.number(),
      prompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      if (!asset.uploadedImageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先上传 MJ 参考图" });
      }
      if (ctx.user.credits < CREDITS.generateMain) {
        throw new TRPCError({ code: "FORBIDDEN", message: `积分不足，生成主视图需要 ${CREDITS.generateMain} 积分` });
      }

      await updateAsset(input.id, ctx.user.id, { status: "generating" });

      try {
        const typeLabel = asset.type === "scene"
          ? "scene concept art, establishing shot, wide angle"
          : asset.type === "prop"
          ? "prop concept art, product view, clean background"
          : "character, front view, full body";
        const promptText = input.prompt
          ? `${typeLabel}, ${input.prompt}, maintain exact same style and appearance as reference, high quality, 4K`
          : `${typeLabel}, maintain exact same style and appearance as reference, high quality, 4K`;

        const genResult = await generateImage({
          prompt: promptText,
          originalImages: [{ url: asset.uploadedImageUrl, mimeType: "image/jpeg" }],
        });
        if (!genResult.url) throw new Error("图片生成返回空URL");

        const imgResp = await fetch(genResult.url);
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const fileKey = `assets/${ctx.user.id}/${input.id}-main-${nanoid(8)}.png`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, "image/png");

        await deductCredits(ctx.user.id, ctx.user.credits, CREDITS.generateMain, `生成资产主视图: ${asset.name}`);

        await addAssetHistory({
          assetId: input.id,
          userId: ctx.user.id,
          imageType: "main",
          imageUrl: s3Url,
          prompt: promptText,
        });

        await updateAsset(input.id, ctx.user.id, {
          mainImageUrl: s3Url,
          generationModel: "nano-banana-pro",
          status: "done",
          ...(input.prompt && { mainPrompt: input.prompt }),
        });

        return { success: true, imageUrl: s3Url };
      } catch (err) {
        await updateAsset(input.id, ctx.user.id, { status: "failed" });
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片生成失败，请重试" });
      }
    }),

  // 基于上传图生成三视图/多视角图
  generateMultiView: protectedProcedure
    .input(z.object({
      id: z.number(),
      viewType: z.enum(["front", "side", "back", "angle1", "angle2", "angle3", "quad"]),
      prompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      if (!asset.uploadedImageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "请先上传 MJ 参考图" });
      }
      if (ctx.user.credits < CREDITS.generateMulti) {
        throw new TRPCError({ code: "FORBIDDEN", message: `积分不足，生成多视角图需要 ${CREDITS.generateMulti} 积分` });
      }

      const viewLabels: Record<string, string> = {
        front: "front view, facing camera directly",
        side: "side profile view, 90 degrees",
        back: "back view, rear facing",
        angle1: "three-quarter view, 45 degrees",
        angle2: "bird eye view, top-down angle",
        angle3: "worm eye view, low angle looking up",
        quad: "", // quad 直接使用传入的完整提示词
      };

      const typeLabel = asset.type === "character" ? "character concept art, full body" : "scene concept art";
      const basePrompt = input.prompt ?? asset.mainPrompt ?? "";
      // quad 类型直接使用传入的完整四宫格提示词，不拼接 viewLabel
      const fullPrompt = input.viewType === "quad"
        ? basePrompt
        : `${typeLabel}, ${viewLabels[input.viewType]}, ${basePrompt ? basePrompt + ", " : ""}maintain exact same style and appearance as reference, consistent design, high quality, 4K`;

      try {
        const genResult = await generateImage({
          prompt: fullPrompt,
          originalImages: [{ url: asset.uploadedImageUrl, mimeType: "image/jpeg" }],
        });
        if (!genResult.url) throw new Error("图片生成返回空URL");

        const imgResp = await fetch(genResult.url);
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const fileKey = `assets/${ctx.user.id}/${input.id}-${input.viewType}-${nanoid(8)}.png`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, "image/png");

        await addAssetHistory({
          assetId: input.id,
          userId: ctx.user.id,
          imageType: input.viewType,
          imageUrl: s3Url,
          prompt: fullPrompt,
        });

        const existing = asset.multiViewUrls ? JSON.parse(asset.multiViewUrls) : {};
        existing[input.viewType] = s3Url;
        await updateAsset(input.id, ctx.user.id, {
          multiViewUrls: JSON.stringify(existing),
          status: "done",
        });

        await deductCredits(ctx.user.id, ctx.user.credits, CREDITS.generateMulti, `生成资产多视角图(${input.viewType}): ${asset.name}`);

        return { success: true, imageUrl: s3Url, viewType: input.viewType };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "图片生成失败，请重试" });
      }
    }),

  // 获取资产历史记录
  getHistory: protectedProcedure
    .input(z.object({ id: z.number(), imageType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const asset = await getAssetById(input.id, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
      return getAssetHistory(input.id, input.imageType);
    }),

  // 从历史记录中选择一张作为当前版本
  selectHistoryVersion: protectedProcedure
    .input(z.object({
      assetId: z.number(),
      historyId: z.number(),
      imageType: z.string(),
      imageUrl: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await getAssetById(input.assetId, ctx.user.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });

      if (input.imageType === "main") {
        await updateAsset(input.assetId, ctx.user.id, { mainImageUrl: input.imageUrl });
      } else {
        const existing = asset.multiViewUrls ? JSON.parse(asset.multiViewUrls) : {};
        existing[input.imageType] = input.imageUrl;
        await updateAsset(input.assetId, ctx.user.id, { multiViewUrls: JSON.stringify(existing) });
      }
      return { success: true };
    }),
});

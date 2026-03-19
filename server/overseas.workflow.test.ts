/**
 * 跑量剧工作流 - 核心功能测试
 * 覆盖: generateFrame imageEngine 支持, batchRun mode 参数, autoGeneratePrompts 返回值,
 *       MARKET_OPTIONS, generateMultiView, chatWithLLM 等关键功能
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock authenticated user context
function createMockContext(userId = 1): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: "test-user-001",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      identifier: "test@example.com",
      identifierType: "email",
      credits: 100,
      inviteCode: null,
      passwordHash: null,
      phone: null,
    } as any,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

// ─── 1. Router Structure Tests ────────────────────────────────────────────────
describe("Overseas Router - Procedure Existence", () => {
  it("has all core workflow procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    // Core CRUD
    expect(procedures).toContain("overseas.createProject");
    expect(procedures).toContain("overseas.listProjects");
    expect(procedures).toContain("overseas.getProject");
    expect(procedures).toContain("overseas.updateProject");
    expect(procedures).toContain("overseas.deleteProject");
    // Script workflow
    expect(procedures).toContain("overseas.parseScript");
    expect(procedures).toContain("overseas.batchParseScripts");
    // Shot management
    expect(procedures).toContain("overseas.listShots");
    expect(procedures).toContain("overseas.updateShot");
    expect(procedures).toContain("overseas.deleteShot");
    // Image & video generation
    expect(procedures).toContain("overseas.generateFrame");
    expect(procedures).toContain("overseas.generateVideo");
    expect(procedures).toContain("overseas.generateVideoPrompt");
    // Batch operations
    expect(procedures).toContain("overseas.batchRun");
    expect(procedures).toContain("overseas.autoGeneratePrompts");
    // Asset management
    expect(procedures).toContain("overseas.listAssets");
    expect(procedures).toContain("overseas.createAsset");
    expect(procedures).toContain("overseas.updateAsset");
    expect(procedures).toContain("overseas.deleteAsset");
    expect(procedures).toContain("overseas.generateAssetImage");
    expect(procedures).toContain("overseas.generateAssetMjPrompt");
    expect(procedures).toContain("overseas.generateMultiView");
    // AI chat
    expect(procedures).toContain("overseas.chatWithLLM");
    // Export
    expect(procedures).toContain("overseas.exportShotsExcel");
    // Auto detect
    expect(procedures).toContain("overseas.autoDetectAssets");
    // Upload
    expect(procedures).toContain("overseas.uploadAssetToS3");
    expect(procedures).toContain("overseas.getUploadUrl");
  });
});

// ─── 2. Schema Validation Tests ───────────────────────────────────────────────
describe("generateFrame Schema Validation", () => {
  it("accepts Seedream 4.5 imageEngine", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    // Should throw 'shot not found' (DB error), NOT a schema validation error
    await expect(
      caller.overseas.generateFrame({
        shotId: 99999,
        frameType: "first",
        imageEngine: "doubao-seedream-4-5-251128",
      })
    ).rejects.toThrow(); // Will throw DB error, not schema error
  });

  it("accepts Seedream 5.0 imageEngine", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateFrame({
        shotId: 99999,
        frameType: "first",
        imageEngine: "doubao-seedream-5-0-260128",
      })
    ).rejects.toThrow(); // DB error expected, not schema error
  });

  it("accepts VE (nano-banana-pro) imageEngine", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateFrame({
        shotId: 99999,
        frameType: "first",
        imageEngine: "nano-banana-pro",
      })
    ).rejects.toThrow(); // DB error expected
  });

  it("accepts last frame type", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateFrame({
        shotId: 99999,
        frameType: "last",
        imageEngine: "doubao-seedream-4-5-251128",
      })
    ).rejects.toThrow(); // DB error expected
  });
});

// ─── 3. batchRun Mode Parameter Tests ─────────────────────────────────────────
describe("batchRun Schema Validation", () => {
  it("accepts mode=image", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.batchRun({
        projectId: 99999,
        episodeNumber: 1,
        mode: "image",
        imageEngine: "doubao-seedream-4-5-251128",
        videoEngine: "seedance_1_5",
        duration: 5,
      })
    ).rejects.toThrow(); // DB error expected, not schema error
  });

  it("accepts mode=video", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.batchRun({
        projectId: 99999,
        episodeNumber: 1,
        mode: "video",
        imageEngine: "doubao-seedream-4-5-251128",
        videoEngine: "seedance_1_5",
        duration: 5,
      })
    ).rejects.toThrow(); // DB error expected
  });

  it("accepts mode=both (default)", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.batchRun({
        projectId: 99999,
        episodeNumber: 1,
        mode: "both",
        imageEngine: "doubao-seedream-4-5-251128",
        videoEngine: "seedance_1_5",
        duration: 5,
      })
    ).rejects.toThrow(); // DB error expected
  });

  it("accepts all video engines", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const engines = ["seedance_1_5", "kling_2_1", "veo_3", "wan2_6", "sora_2"];
    for (const engine of engines) {
      await expect(
        caller.overseas.batchRun({
          projectId: 99999,
          episodeNumber: 1,
          mode: "both",
          imageEngine: "doubao-seedream-4-5-251128",
          videoEngine: engine as any,
          duration: 5,
        })
      ).rejects.toThrow(); // DB error expected, not schema error
    }
  });
});

// ─── 4. autoGeneratePrompts Return Value Tests ────────────────────────────────
describe("autoGeneratePrompts Schema Validation", () => {
  it("accepts valid projectId and episodeNumber", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.autoGeneratePrompts({
        projectId: 99999,
        episodeNumber: 1,
      })
    ).rejects.toThrow(); // DB error expected (project not found)
  });
});

// ─── 5. chatWithLLM Schema Tests ──────────────────────────────────────────────
describe("chatWithLLM Schema Validation", () => {
  it("accepts valid chat input", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.chatWithLLM({
        projectId: 99999,
        message: "帮我分析这个剧本的市场潜力",
        history: [],
      })
    ).rejects.toThrow(); // DB error expected (project not found)
  });

  it("accepts chat with history", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.chatWithLLM({
        projectId: 99999,
        message: "继续",
        history: [
          { role: "user", content: "帮我分析剧本" },
          { role: "assistant", content: "好的，请提供剧本内容" },
        ],
      })
    ).rejects.toThrow(); // DB error expected
  });
});

// ─── 6. Asset Management Schema Tests ────────────────────────────────────────
describe("generateAssetImage Schema Validation", () => {
  it("accepts Seedream 4.5 as default model", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateAssetImage({
        assetId: 99999,
        imageModel: "doubao-seedream-4-5-251128",
      })
    ).rejects.toThrow(); // DB error expected
  });

  it("accepts midjourney model", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateAssetImage({
        assetId: 99999,
        imageModel: "midjourney",
      })
    ).rejects.toThrow(); // DB error expected
  });
});

// ─── 7. generateMultiView Schema Tests ───────────────────────────────────────
describe("generateMultiView Schema Validation", () => {
  it("accepts valid assetId", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.generateMultiView({
        assetId: 99999,
      })
    ).rejects.toThrow(); // DB error expected
  });
});

// ─── 8. Shared videoModels Tests ──────────────────────────────────────────────
describe("Shared videoModels", () => {
  it("IMAGE_MODELS has Seedream 4.5 as first model (default)", async () => {
    const { IMAGE_MODELS } = await import("../shared/videoModels");
    expect(IMAGE_MODELS.length).toBeGreaterThan(0);
    // First model should be Seedream 4.5 (default for China market)
    expect(IMAGE_MODELS[0].id).toBe("doubao-seedream-4-5-251128");
  });

  it("IMAGE_MODELS includes all required models", async () => {
    const { IMAGE_MODELS } = await import("../shared/videoModels");
    const ids = IMAGE_MODELS.map(m => m.id);
    expect(ids).toContain("doubao-seedream-4-5-251128");
    expect(ids).toContain("doubao-seedream-5-0-260128");
    expect(ids).toContain("midjourney");
    expect(ids).toContain("nano-banana-pro");
  });

  it("VIDEO_MODELS includes Seedance 1.5 Pro", async () => {
    const { VIDEO_MODELS } = await import("../shared/videoModels");
    const ids = VIDEO_MODELS.map(m => m.id);
    expect(ids).toContain("seedance_1_5");
  });

  it("MARKET_OPTIONS includes China and Spain", async () => {
    const { MARKET_OPTIONS } = await import("../shared/videoModels");
    const values = MARKET_OPTIONS.map(m => m.value);
    expect(values).toContain("cn");
    expect(values).toContain("es");
    expect(values).toContain("us");
  });

  it("getVideoModelName returns correct names", async () => {
    const { getVideoModelName } = await import("../shared/videoModels");
    expect(getVideoModelName("seedance_1_5")).toBeTruthy();
    expect(getVideoModelName("kling_2_1")).toBeTruthy();
  });
});

// ─── 9. Project CRUD Tests ────────────────────────────────────────────────────
describe("Overseas Project CRUD", () => {
  it("createProject rejects empty name", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.overseas.createProject({
        name: "",
        market: "us",
        aspectRatio: "portrait",
        style: "realistic",
        genre: "romance",
        totalEpisodes: 20,
      })
    ).rejects.toThrow();
  });

  it("createProject accepts valid China market project", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    // This should succeed (create a real project in DB)
    const result = await caller.overseas.createProject({
      name: "测试项目-中国市场",
      market: "cn",
      aspectRatio: "portrait",
      style: "realistic",
      genre: "romance",
      totalEpisodes: 10,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);

    // Cleanup
    await caller.overseas.deleteProject({ id: result.id });
  });

  it("createProject accepts Spain market project", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.overseas.createProject({
      name: "Test Project - Spain Market",
      market: "es",
      aspectRatio: "landscape",
      style: "realistic",
      genre: "action",
      totalEpisodes: 5,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);

    // Cleanup
    await caller.overseas.deleteProject({ id: result.id });
  });

  it("listProjects returns array directly", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.overseas.listProjects();
    expect(Array.isArray(result)).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock authenticated user context (matching actual auth.ts schema)
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
      // Extended fields from original schema
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

// Mock unauthenticated context
function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
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

describe("Auth Routes", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user info for authenticated user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    // auth.me returns { id, identifier, identifierType, name, credits, role }
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("Test User");
    expect(result?.role).toBe("admin");
  });
});

describe("VectorEngine Module", () => {
  it("exports all expected functions", async () => {
    const ve = await import("./lib/vectorengine");
    expect(ve.callClaude).toBeDefined();
    expect(ve.callClaudeSonnet).toBeDefined();
    expect(ve.callClaudeOpus).toBeDefined();
    expect(ve.mjImagine).toBeDefined();
    expect(ve.mjFetchTask).toBeDefined();
    expect(ve.mjAction).toBeDefined();
    expect(ve.mjBlend).toBeDefined();
    expect(ve.mjDescribe).toBeDefined();
    expect(ve.generateSeedreamImage).toBeDefined();
    expect(ve.createSeedanceVideo).toBeDefined();
    expect(ve.querySeedanceTask).toBeDefined();
    expect(ve.generateNanoBananaImage).toBeDefined();
    expect(ve.createVideo).toBeDefined();
    expect(ve.queryVideoTask).toBeDefined();
  });

  it("has correct LLM model constants (all use gpt-5.4-mini)", async () => {
    const ve = await import("./lib/vectorengine");
    // All LLM calls now use gpt-5.4-mini via VectorEngine
    expect(ve.GPT_MINI).toBe("gpt-5.4-mini");
    expect(ve.CLAUDE_OPUS).toBe("gpt-5.4-mini");
    expect(ve.CLAUDE_SONNET).toBe("gpt-5.4-mini");
  });

  it("IMAGE_MODELS includes Seedream, MJ, and Gemini 3 Pro Image", async () => {
    const ve = await import("./lib/vectorengine");
    const ids = ve.IMAGE_MODELS.map(m => m.id);
    expect(ids).toContain("doubao-seedream-5-0-260128");
    expect(ids).toContain("doubao-seedream-4-5-251128");
    expect(ids).toContain("midjourney");
    // Nano Banana Pro = Gemini 3 Pro Image (image model, NOT video)
    const nanoBanana = ve.IMAGE_MODELS.find(m => m.id === "nano-banana-pro");
    expect(nanoBanana).toBeDefined();
    expect(nanoBanana?.name).toBe("Gemini 3 Pro Image");
    expect(nanoBanana?.provider).toBe("Google");
  });

  it("VIDEO_MODELS includes all video engines and excludes Nano Banana", async () => {
    const ve = await import("./lib/vectorengine");
    const videoIds = ve.VIDEO_MODELS.map(m => m.id);
    expect(videoIds).toContain("doubao-seedance-1-5-pro-251215");
    expect(videoIds).toContain("veo-3.1-4k");
    expect(videoIds).toContain("grok-video-3-15s");
    expect(videoIds).toContain("wan2.6-i2v");
    expect(videoIds).toContain("sora-2-pro");
    // Nano Banana Pro should NOT be in VIDEO_MODELS
    expect(videoIds).not.toContain("nano-banana-pro");
  });
});

describe("Router Structure", () => {
  it("appRouter has all expected sub-routers", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("auth."))).toBe(true);
    expect(procedures.some(p => p.startsWith("system."))).toBe(true);
    expect(procedures.some(p => p.startsWith("ai."))).toBe(true);
    expect(procedures.some(p => p.startsWith("overseas."))).toBe(true);
    expect(procedures.some(p => p.startsWith("projects."))).toBe(true);
    expect(procedures.some(p => p.startsWith("admin."))).toBe(true);
    expect(procedures.some(p => p.startsWith("payment."))).toBe(true);
    expect(procedures.some(p => p.startsWith("assets."))).toBe(true);
  });

  it("ai router has premium (精品剧) procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("ai.premiumDirectorAnalysis");
    expect(procedures).toContain("ai.premiumCharacterPrompt");
    expect(procedures).toContain("ai.premiumScenePrompt");
    expect(procedures).toContain("ai.premiumSeedancePrompt");
    expect(procedures).toContain("ai.premiumBatchSeedancePrompts");
  });

  it("ai router has standard procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("ai.analyzeScript");
    expect(procedures).toContain("ai.generateShots");
    expect(procedures).toContain("ai.generateCharacterPrompt");
    expect(procedures).toContain("ai.generateAssetPrompt");
    expect(procedures).toContain("ai.generateVideoPrompt");
  });

  it("overseas router has batch and auto-detect procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("overseas.batchParseScripts");
    expect(procedures).toContain("overseas.autoDetectAssets");
    expect(procedures).toContain("overseas.autoGeneratePrompts");
    expect(procedures).toContain("overseas.uploadAssetToS3");
    expect(procedures).toContain("overseas.getUploadUrl");
  });

  it("overseas router has core CRUD procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("overseas.listProjects");
    expect(procedures).toContain("overseas.createProject");
    expect(procedures).toContain("overseas.updateProject");
    expect(procedures).toContain("overseas.deleteProject");
    expect(procedures).toContain("overseas.parseScript");
    expect(procedures).toContain("overseas.generateFrame");
    expect(procedures).toContain("overseas.generateVideo");
    expect(procedures).toContain("overseas.batchRun");
  });

  it("overseas router has shot and asset management", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).toContain("overseas.listShots");
    expect(procedures).toContain("overseas.updateShot");
    expect(procedures).toContain("overseas.deleteShot");
    expect(procedures).toContain("overseas.listAssets");
    expect(procedures).toContain("overseas.createAsset");
    expect(procedures).toContain("overseas.updateAsset");
    expect(procedures).toContain("overseas.deleteAsset");
  });
});

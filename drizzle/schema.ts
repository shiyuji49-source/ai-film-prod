import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean } from "drizzle-orm/mysql-core";

// ─── 用户表 ──────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) */
  openId: varchar("openId", { length: 64 }).unique(),  // nullable for custom auth users
  /** 登录标识：邮箱或手机号 */
  identifier: varchar("identifier", { length: 320 }).unique(),
  /** 标识类型 */
  identifierType: mysqlEnum("identifierType", ["email", "phone"]),
  /** bcrypt 哈希后的密码 */
  passwordHash: varchar("passwordHash", { length: 256 }),
  /** 显示名称 */
  name: varchar("name", { length: 64 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** 角色：user / admin */
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** 积分余额 */
  credits: int("credits").default(10000).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── 项目表 ──────────────────────────────────────────────────────────────────
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** 项目唯一标识（前端使用的 nanoid） */
  clientId: varchar("clientId", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull().default("未命名项目"),
  /** 完整项目 JSON 数据 */
  data: text("data").notNull().default("{}"),
  /** 最后活跃时间 */
  lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── 积分流水表 ──────────────────────────────────────────────────────────────
export const creditLogs = mysqlTable("creditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** 变动量（正数=充值，负数=消耗） */
  delta: int("delta").notNull(),
  /** 变动后余额 */
  balance: int("balance").notNull(),
  /** 操作类型 */
  action: mysqlEnum("action", [
    "register_bonus",
    "admin_grant",
    "stripe_purchase",
    "analyze_script",
    "generate_shot",
    "generate_prompt",
  ]).notNull(),
  /** 关联项目 ID */
  projectId: int("projectId"),
  /** 备注 */
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditLog = typeof creditLogs.$inferSelect;
export type InsertCreditLog = typeof creditLogs.$inferInsert;

// ─── 邀请码表 ──────────────────────────────────────────────────────────────────
export const inviteCodes = mysqlTable("invite_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdBy: int("created_by").notNull().default(0),
  usedBy: int("used_by"),
  usedAt: bigint("used_at", { mode: "number" }),
  expiresAt: bigint("expires_at", { mode: "number" }),
  maxUses: int("max_uses").notNull().default(1),
  useCount: int("use_count").notNull().default(0),
  note: varchar("note", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;

// ─── 订单表（Stripe 支付记录）────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 256 }).unique(),
  credits: int("credits").notNull(),
  amountFen: int("amountFen").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── 团队表 ────────────────────────────────────────────────────────────────
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  ownerId: int("ownerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── 资产库表 ─────────────────────────────────────────────────────────────────
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),
  type: mysqlEnum("type", ["character", "scene", "prop"]).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  mjPrompt: text("mjPrompt"),
  mainPrompt: text("mainPrompt"),
  uploadedImageUrl: text("uploadedImageUrl"),
  mainImageUrl: text("mainImageUrl"),
  multiViewUrls: text("multiViewUrls"),
  generationModel: varchar("generationModel", { length: 64 }),
  status: mysqlEnum("status", ["draft", "generating", "done", "failed"]).default("draft").notNull(),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// ─── 资产生成历史表 ─────────────────────────────────────────────────────────
export const assetHistory = mysqlTable("asset_history", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("asset_id").notNull(),
  userId: int("user_id").notNull(),
  imageType: varchar("image_type", { length: 50 }).notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type AssetHistory = typeof assetHistory.$inferSelect;
export type InsertAssetHistory = typeof assetHistory.$inferInsert;

// ─── API 设置表 ──────────────────────────────────────────────────────────────
export const apiSettings = mysqlTable("api_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  provider: varchar("provider", { length: 32 }).notNull().default("gemini"),
  model: varchar("model", { length: 128 }).notNull().default("gemini-3-flash-preview"),
  apiKey: text("apiKey"),
  apiBaseUrl: text("apiBaseUrl"),
  falApiKey: text("falApiKey"),
  lastTestStatus: varchar("lastTestStatus", { length: 16 }).default("untested"),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiSetting = typeof apiSettings.$inferSelect;
export type InsertApiSetting = typeof apiSettings.$inferInsert;

// ─── 团队成员表 ────────────────────────────────────────────────────────────
export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "editor", "viewer"]).default("viewer").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

// ─── 出海短剧项目表 ────────────────────────────────────────────────────────────
export const overseasProjects = mysqlTable("overseas_projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull().default("未命名剧集"),
  market: varchar("market", { length: 32 }).notNull().default("us"),
  aspectRatio: mysqlEnum("aspectRatio", ["landscape", "portrait"]).notNull().default("portrait"),
  style: mysqlEnum("style", ["realistic", "animation", "cg"]).notNull().default("realistic"),
  genre: varchar("genre", { length: 64 }).notNull().default("romance"),
  totalEpisodes: int("totalEpisodes").default(20),
  status: mysqlEnum("status", ["draft", "in_progress", "completed"]).default("draft").notNull(),
  characters: text("characters").default("[]"),
  scenes: text("scenes").default("[]"),
  /** 项目级图片引擎 */
  imageEngine: varchar("imageEngine", { length: 64 }).default("gemini_3_pro_image"),
  videoEngine: mysqlEnum("videoEngine_proj", ["seedance_1_5", "seedance_2_0", "veo_3_1", "kling_3_0", "kling_3_0_omni", "runway_gen4", "hailuo_2_3", "grok_video_3", "sora_2_pro", "wan2_6"]).default("seedance_1_5"),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OverseasProject = typeof overseasProjects.$inferSelect;
export type InsertOverseasProject = typeof overseasProjects.$inferInsert;

// ─── 分镜表 ────────────────────────────────────────────────────────────────
export const scriptShots = mysqlTable("script_shots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  episodeNumber: int("episodeNumber").notNull(),
  shotNumber: int("shotNumber").notNull(),
  sceneName: varchar("sceneName", { length: 128 }),
  shotType: varchar("shotType", { length: 64 }),
  visualDescription: text("visualDescription"),
  dialogue: text("dialogue"),
  characters: varchar("characters", { length: 256 }),
  emotion: varchar("emotion", { length: 64 }),
  firstFrameUrl: text("firstFrameUrl"),
  lastFrameUrl: text("lastFrameUrl"),
  firstFramePrompt: text("firstFramePrompt"),
  lastFramePrompt: text("lastFramePrompt"),
  videoUrl: text("videoUrl"),
  videoPrompt: text("videoPrompt"),
  /** 首帧图片引擎 */
  imageEngine: varchar("imageEngine_shot", { length: 64 }),
  /** 主体参考图 URLs (JSON array) */
  subjectRefUrls: text("subjectRefUrls"),
  videoEngine: mysqlEnum("videoEngine", ["seedance_1_5", "seedance_2_0", "veo_3_1", "kling_3_0", "kling_3_0_omni", "runway_gen4", "hailuo_2_3", "grok_video_3", "sora_2_pro", "wan2_6"]),
  videoDuration: int("videoDuration"),
  status: mysqlEnum("status", ["draft", "generating_frame", "frame_done", "generating_video", "done", "failed"]).default("draft").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScriptShot = typeof scriptShots.$inferSelect;
export type InsertScriptShot = typeof scriptShots.$inferInsert;

// ─── 视频生成任务表 ────────────────────────────────────────────────────────────
export const videoJobs = mysqlTable("video_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  shotId: int("shotId").notNull(),
  engine: mysqlEnum("engine", ["seedance_1_5", "seedance_2_0", "veo_3_1", "kling_3_0", "kling_3_0_omni", "runway_gen4", "hailuo_2_3", "grok_video_3", "sora_2_pro", "wan2_6"]).notNull(),
  externalJobId: varchar("externalJobId", { length: 512 }),
  status: mysqlEnum("status", ["pending", "processing", "done", "failed"]).default("pending").notNull(),
  videoUrl: text("videoUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoJob = typeof videoJobs.$inferInsert;

// ─── 出海短剧资产表 ────────────────────────────────────────────────────────────
export const overseasAssets = mysqlTable("overseas_assets", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["character", "scene", "prop", "costume"]).default("character").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  /** 风格定调阶段 */
  stylePrompt: text("stylePrompt"),
  styleImageUrl: text("styleImageUrl"),
  styleModel: varchar("styleModel", { length: 64 }),
  /** 主体定稿阶段 */
  mjPrompt: text("mjPrompt"),
  nbpPrompt: text("nbpPrompt"),
  mjImageUrl: text("mjImageUrl"),
  mainImageUrl: text("mainImageUrl"),
  mainModel: varchar("mainModel", { length: 64 }),
  /** 多视角图 */
  viewFrontUrl: text("viewFrontUrl"),
  viewSideUrl: text("viewSideUrl"),
  viewBackUrl: text("viewBackUrl"),
  /** 近景主视图（人物） */
  viewCloseUpUrl: text("viewCloseUpUrl"),
  /** 多角度九宫格（场景） */
  multiAngleGridUrl: text("multiAngleGridUrl"),
  /** 上传的参考图 URL */
  referenceImageUrl: text("referenceImageUrl"),
  /** 分辨率设置 */
  resolution: varchar("resolution", { length: 32 }),
  /** 画幅比例 */
  aspectRatio: varchar("aspectRatio_asset", { length: 16 }),
  tags: varchar("tags", { length: 500 }),
  isGlobalRef: boolean("isGlobalRef").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OverseasAsset = typeof overseasAssets.$inferSelect;
export type InsertOverseasAsset = typeof overseasAssets.$inferInsert;

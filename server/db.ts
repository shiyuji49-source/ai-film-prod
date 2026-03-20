import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, projects, creditLogs, inviteCodes, assets, type User, type InsertUser, type Project, type InsertProject, type InsertCreditLog, type Asset } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── 用户 ────────────────────────────────────────────────────────────────────

export async function createUser(data: {
  identifier: string;
  identifierType: "email" | "phone";
  passwordHash: string;
  name?: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  await db.insert(users).values({
    identifier: data.identifier,
    identifierType: data.identifierType,
    passwordHash: data.passwordHash,
    name: data.name ?? null,
    lastSignedIn: new Date(),
  });

  const result = await db.select().from(users).where(eq(users.identifier, data.identifier)).limit(1);
  if (!result[0]) throw new Error("创建用户失败");

  // 普通注册不赠送积分，使用邀请码注册时在 auth.ts 中另行赠送

  return result[0];
}

export async function getUserByIdentifier(identifier: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.identifier, identifier)).limit(1);
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertUser(user: Partial<InsertUser> & { openId: string }): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserByOpenId(user.openId);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    if (user.name !== undefined) updateSet.name = user.name;
    if (user.email !== undefined) updateSet.email = user.email;
    if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
    if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
    if (user.role !== undefined) updateSet.role = user.role;
    if (Object.keys(updateSet).length > 0) {
      await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
    }
  } else {
    await db.insert(users).values({
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: user.lastSignedIn ?? new Date(),
    });
  }
}

export async function updateUserLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// ─── 积分 ────────────────────────────────────────────────────────────────────

/**
 * 扣除积分，返回扣除后余额。若积分不足则抛出错误。
 */
export async function deductCredits(
  userId: number,
  amount: number,
  action: InsertCreditLog["action"],
  projectId?: number,
  note?: string,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];
  if (!user) throw new Error("用户不存在");

  if (user.credits < amount) {
    throw new Error(`积分不足（当前 ${user.credits}，需要 ${amount}）`);
  }

  const newBalance = user.credits - amount;
  await db.update(users).set({ credits: newBalance }).where(eq(users.id, userId));
  await db.insert(creditLogs).values({
    userId,
    delta: -amount,
    balance: newBalance,
    action,
    projectId: projectId ?? null,
    note: note ?? null,
  });

  return newBalance;
}

/**
 * 管理员充值积分
 */
export async function grantCredits(
  userId: number,
  amount: number,
  note?: string,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];
  if (!user) throw new Error("用户不存在");

  const newBalance = user.credits + amount;
  await db.update(users).set({ credits: newBalance }).where(eq(users.id, userId));
  await db.insert(creditLogs).values({
    userId,
    delta: amount,
    balance: newBalance,
    action: "admin_grant",
    note: note ?? `管理员充值 ${amount} 积分`,
  });

  return newBalance;
}

export async function getCreditLogs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditLogs)
    .where(eq(creditLogs.userId, userId))
    .orderBy(desc(creditLogs.createdAt))
    .limit(limit);
}

// ─── 项目 ────────────────────────────────────────────────────────────────────

export async function getUserProjects(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.isDeleted, false)))
    .orderBy(desc(projects.lastActiveAt));
}

export async function getProjectByClientId(userId: number, clientId: string): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.clientId, clientId), eq(projects.isDeleted, false)))
    .limit(1);
  return result[0];
}

export async function upsertProject(data: {
  userId: number;
  clientId: string;
  name: string;
  projectData: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  const existing = await getProjectByClientId(data.userId, data.clientId);
  if (existing) {
    await db.update(projects)
      .set({ name: data.name, data: data.projectData, lastActiveAt: new Date() })
      .where(eq(projects.id, existing.id));
  } else {
    await db.insert(projects).values({
      userId: data.userId,
      clientId: data.clientId,
      name: data.name,
      data: data.projectData,
      lastActiveAt: new Date(),
    });
  }
}

export async function deleteProject(userId: number, clientId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.update(projects)
    .set({ isDeleted: true })
    .where(and(eq(projects.userId, userId), eq(projects.clientId, clientId)));
}

// ─── 管理员：用户列表 ────────────────────────────────────────────────────────

export async function getAllUsers(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    identifier: users.identifier,
    identifierType: users.identifierType,
    name: users.name,
    role: users.role,
    credits: users.credits,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt)).limit(limit);
}

// ─── 管理员：统计数据 ────────────────────────────────────────────────────────

/** 获取所有用户（带积分余额），支持分页 */
export async function adminGetUsers(page = 1, pageSize = 50) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const list = await db.select({
    id: users.id,
    identifier: users.identifier,
    identifierType: users.identifierType,
    name: users.name,
    role: users.role,
    credits: users.credits,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt)).limit(pageSize).offset(offset);
  // 总数
  const countResult = await db.select({ count: users.id }).from(users);
  return { users: list, total: countResult.length };
}

/** AI 使用统计：按操作类型汇总消耗积分数和次数（最近 30 天） */
export async function adminGetAiStats() {
  const db = await getDb();
  if (!db) return [];
  const logs = await db.select({
    action: creditLogs.action,
    delta: creditLogs.delta,
    createdAt: creditLogs.createdAt,
  }).from(creditLogs)
    .orderBy(desc(creditLogs.createdAt))
    .limit(10000);

  // 按操作类型聚合
  const stats: Record<string, { count: number; totalCredits: number }> = {};
  for (const log of logs) {
    if (log.delta >= 0) continue; // 跳过充值记录
    const key = log.action;
    if (!stats[key]) stats[key] = { count: 0, totalCredits: 0 };
    stats[key].count += 1;
    stats[key].totalCredits += Math.abs(log.delta);
  }
  return Object.entries(stats).map(([action, data]) => ({ action, ...data }));
}

/** 获取最近 30 天每日 AI 调用次数（折线图数据） */
export async function adminGetDailyStats() {
  const db = await getDb();
  if (!db) return [];
  const logs = await db.select({
    action: creditLogs.action,
    delta: creditLogs.delta,
    createdAt: creditLogs.createdAt,
  }).from(creditLogs)
    .orderBy(desc(creditLogs.createdAt))
    .limit(10000);

  // 按日期聚合（最近 30 天）
  const dailyMap: Record<string, { date: string; calls: number; credits: number }> = {};
  const now = Date.now();
  for (const log of logs) {
    if (log.delta >= 0) continue;
    const ts = log.createdAt.getTime();
    if (now - ts > 30 * 24 * 60 * 60 * 1000) continue;
    const date = log.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[date]) dailyMap[date] = { date, calls: 0, credits: 0 };
    dailyMap[date].calls += 1;
    dailyMap[date].credits += Math.abs(log.delta);
  }
  return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
}

/** 获取全局概览数据 */
export async function adminGetOverview() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalCreditsGranted: 0, totalCreditsConsumed: 0, totalAiCalls: 0 };

  const allUsers = await db.select({ id: users.id, credits: users.credits }).from(users);
  const allLogs = await db.select({ delta: creditLogs.delta, action: creditLogs.action }).from(creditLogs);

  const totalUsers = allUsers.length;
  let totalCreditsGranted = 0;
  let totalCreditsConsumed = 0;
  let totalAiCalls = 0;

  for (const log of allLogs) {
    if (log.delta > 0) totalCreditsGranted += log.delta;
    else {
      totalCreditsConsumed += Math.abs(log.delta);
      if (['analyze_script', 'generate_shot', 'generate_prompt'].includes(log.action)) {
        totalAiCalls += 1;
      }
    }
  }

  return { totalUsers, totalCreditsGranted, totalCreditsConsumed, totalAiCalls };
}

// ─── 邀请码 ──────────────────────────────────────────────────────────────────

export async function createInviteCode(data: {
  code: string;
  createdBy: number;
  maxUses?: number;
  expiresAt?: number;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.insert(inviteCodes).values({
    code: data.code,
    createdBy: data.createdBy,
    maxUses: data.maxUses ?? 1,
    expiresAt: data.expiresAt ?? null,
    note: data.note ?? null,
    createdAt: Date.now(),
  });
}

export async function getInviteCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);
  return result[0];
}

export async function useInviteCode(code: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const inv = await getInviteCodeByCode(code);
  if (!inv) return false;
  if (inv.useCount >= inv.maxUses) return false;
  if (inv.expiresAt && Date.now() > inv.expiresAt) return false;

  await db.update(inviteCodes)
    .set({
      useCount: inv.useCount + 1,
      usedBy: userId,
      usedAt: Date.now(),
    })
    .where(eq(inviteCodes.code, code));
  return true;
}

export async function getAllInviteCodes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
}

export async function deleteInviteCode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
}

/** 邀请码注册赠送积分（记录 register_bonus 流水） */
export async function grantInviteBonus(userId: number, amount: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");

  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];
  if (!user) throw new Error("用户不存在");

  const newBalance = user.credits + amount;
  await db.update(users).set({ credits: newBalance }).where(eq(users.id, userId));
  await db.insert(creditLogs).values({
    userId,
    delta: amount,
    balance: newBalance,
    action: "register_bonus",
    note: `邀请码注册赠送 ${amount} 积分`,
  });

  return newBalance;
}

// ─── 资产库 ───────────────────────────────────────────────────────────────────

export async function getUserAssets(userId: number, type?: "character" | "scene"): Promise<Asset[]> {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(assets).where(
    type
      ? and(eq(assets.userId, userId), eq(assets.isDeleted, false), eq(assets.type, type))
      : and(eq(assets.userId, userId), eq(assets.isDeleted, false))
  );
  return query.orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: number, userId: number): Promise<Asset | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(assets)
    .where(and(eq(assets.id, id), eq(assets.userId, userId), eq(assets.isDeleted, false)))
    .limit(1);
  return result[0] ?? null;
}

export async function createAsset(data: {
  userId: number;
  projectId?: number;
  type: "character" | "scene";
  name: string;
  description?: string;
  mjPrompt?: string;
  mainPrompt?: string;
}): Promise<Asset> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.insert(assets).values({
    userId: data.userId,
    projectId: data.projectId ?? null,
    type: data.type,
    name: data.name,
    description: data.description ?? null,
    mjPrompt: data.mjPrompt ?? null,
    mainPrompt: data.mainPrompt ?? null,
    status: "draft",
    isDeleted: false,
  });
  const result = await db.select().from(assets)
    .where(and(eq(assets.userId, data.userId), eq(assets.isDeleted, false)))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!result[0]) throw new Error("创建资产失败");
  return result[0];
}

export async function updateAsset(id: number, userId: number, data: Partial<{
  name: string;
  description: string;
  mjPrompt: string;
  mainPrompt: string;
  uploadedImageUrl: string;
  mainImageUrl: string;
  multiViewUrls: string;
  generationModel: string;
  status: "draft" | "generating" | "done" | "failed";
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.update(assets).set(data).where(and(eq(assets.id, id), eq(assets.userId, userId)));
}

export async function softDeleteAsset(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用");
  await db.update(assets).set({ isDeleted: true }).where(and(eq(assets.id, id), eq(assets.userId, userId)));
}

// ─── 资产历史记录 ──────────────────────────────────────────────────────────────

export async function addAssetHistory(data: {
  assetId: number;
  userId: number;
  imageType: string;
  imageUrl: string;
  prompt?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { assetHistory } = await import("../drizzle/schema");
  // 保持每个资产每种视角最多 5 条历史
  const existing = await db
    .select({ id: assetHistory.id })
    .from(assetHistory)
    .where(and(eq(assetHistory.assetId, data.assetId), eq(assetHistory.imageType, data.imageType)))
    .orderBy(assetHistory.createdAt)
    .limit(10);
  if (existing.length >= 5) {
    // 删除最旧的记录
    const toDelete = existing.slice(0, existing.length - 4);
    for (const row of toDelete) {
      await db.delete(assetHistory).where(eq(assetHistory.id, row.id));
    }
  }
  await db.insert(assetHistory).values({
    assetId: data.assetId,
    userId: data.userId,
    imageType: data.imageType,
    imageUrl: data.imageUrl,
    prompt: data.prompt,
    createdAt: Date.now(),
  });
}

export async function getAssetHistory(assetId: number, imageType?: string) {
  const db = await getDb();
  if (!db) return [];
  const { assetHistory } = await import("../drizzle/schema");
  const conditions = imageType
    ? and(eq(assetHistory.assetId, assetId), eq(assetHistory.imageType, imageType))
    : eq(assetHistory.assetId, assetId);
  return db
    .select()
    .from(assetHistory)
    .where(conditions)
    .orderBy(assetHistory.createdAt);
}


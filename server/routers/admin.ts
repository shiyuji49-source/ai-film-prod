import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const adminRouter = router({
  /** 获取全局概览统计 */
  getOverview: adminProcedure
    .query(async () => {
      return db.adminGetOverview();
    }),

  /** 获取用户列表（分页） */
  getUsers: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      return db.adminGetUsers(input.page, input.pageSize);
    }),

  /** 给用户充值积分 */
  grantCredits: adminProcedure
    .input(z.object({
      userId: z.number().int(),
      amount: z.number().int().min(1).max(1000000),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ input }) => {
      const newBalance = await db.grantCredits(input.userId, input.amount, input.note);
      return { success: true, newBalance };
    }),

  /** 修改用户角色 */
  setUserRole: adminProcedure
    .input(z.object({
      userId: z.number().int(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input }) => {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("数据库不可用");
      const { users } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await dbConn.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  /** 获取 AI 使用统计（按操作类型） */
  getAiStats: adminProcedure
    .query(async () => {
      return db.adminGetAiStats();
    }),

  /** 获取每日调用趋势（最近 30 天） */
  getDailyStats: adminProcedure
    .query(async () => {
      return db.adminGetDailyStats();
    }),

  /** 批量充值积分 */
  batchGrantCredits: adminProcedure
    .input(z.object({
      userIds: z.array(z.number().int()).min(1).max(200),
      amount: z.number().int().min(1).max(1000000),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.userIds.map(uid => db.grantCredits(uid, input.amount, input.note))
      );
      return { success: true, count: results.length };
    }),

  /** 批量修改角色 */
  batchSetRole: adminProcedure
    .input(z.object({
      userIds: z.array(z.number().int()).min(1).max(200),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input }) => {
      const dbConn = await db.getDb();
      if (!dbConn) throw new Error("数据库不可用");
      const { users } = await import("../../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      await dbConn.update(users).set({ role: input.role }).where(inArray(users.id, input.userIds));
      return { success: true, count: input.userIds.length };
    }),

  /** 获取用户积分流水 */
  getUserCreditLogs: adminProcedure
    .input(z.object({
      userId: z.number().int(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      return db.getCreditLogs(input.userId, input.limit);
    }),

  // ─── 邀请码管理 ────────────────────────────────────────────────────────

  /** 获取所有邀请码 */
  getInviteCodes: adminProcedure
    .query(async () => {
      return db.getAllInviteCodes();
    }),

  /** 生成邀请码 */
  createInviteCode: adminProcedure
    .input(z.object({
      count: z.number().int().min(1).max(100).default(1),
      maxUses: z.number().int().min(1).max(1000).default(1),
      expiresInDays: z.number().int().min(0).max(3650).optional(),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { nanoid } = await import("nanoid");
      const codes: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const code = nanoid(8).toUpperCase();
        const expiresAt = input.expiresInDays
          ? Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
          : undefined;
        await db.createInviteCode({
          code,
          createdBy: ctx.user.id,
          maxUses: input.maxUses,
          expiresAt,
          note: input.note,
        });
        codes.push(code);
      }
      return { success: true, codes };
    }),

  /** 删除邀请码 */
  deleteInviteCode: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await db.deleteInviteCode(input.id);
      return { success: true };
    }),

  /** 切换邀请码开关（返回当前状态） */
  getInviteRequired: adminProcedure
    .query(async () => {
      return { required: process.env.REQUIRE_INVITE_CODE === "true" };
    }),
});

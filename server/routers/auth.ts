import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// 手机号正则（中国大陆）
const PHONE_RE = /^1[3-9]\d{9}$/;
// 邮箱正则
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function detectIdentifierType(identifier: string): "email" | "phone" {
  if (PHONE_RE.test(identifier)) return "phone";
  if (EMAIL_RE.test(identifier)) return "email";
  throw new TRPCError({ code: "BAD_REQUEST", message: "请输入有效的手机号或邮箱" });
}

export const authRouter = router({
  /** 注册 */
  register: publicProcedure
    .input(z.object({
      identifier: z.string().min(1, "请输入手机号或邮箱"),
      password: z.string().min(6, "密码至少6位"),
      name: z.string().optional(),
      inviteCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const identifierType = detectIdentifierType(input.identifier);

      // 验证邀请码（如果系统开启了邀请码限制）
      const REQUIRE_INVITE = process.env.REQUIRE_INVITE_CODE === "true";
      if (REQUIRE_INVITE) {
        if (!input.inviteCode) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "注册需要邀请码" });
        }
        const inv = await db.getInviteCodeByCode(input.inviteCode.trim().toUpperCase());
        if (!inv) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "邀请码无效" });
        }
        if (inv.useCount >= inv.maxUses) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该邀请码已被使用" });
        }
        if (inv.expiresAt && Date.now() > inv.expiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "邀请码已过期" });
        }
      }

      // 检查是否已注册
      const existing = await db.getUserByIdentifier(input.identifier);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "该账号已注册，请直接登录" });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await db.createUser({
        identifier: input.identifier,
        identifierType,
        passwordHash,
        name: input.name,
      });

      // 如果提供了邀请码，标记已使用并赠送 3000 积分
      if (input.inviteCode) {
        const invCode = input.inviteCode.trim().toUpperCase();
        // 非强制模式下也需验证邀请码有效性
        if (!REQUIRE_INVITE) {
          const inv = await db.getInviteCodeByCode(invCode);
          if (inv && inv.useCount < inv.maxUses && !(inv.expiresAt && Date.now() > inv.expiresAt)) {
            await db.useInviteCode(invCode, user.id);
            await db.grantInviteBonus(user.id, 3000);
          }
        } else {
          await db.useInviteCode(invCode, user.id);
          await db.grantInviteBonus(user.id, 3000);
        }
      }

      // 自动登录：创建 session
      const sessionToken = await sdk.createSessionToken(String(user.id), {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        id: user.id,
        identifier: user.identifier,
        identifierType: user.identifierType,
        name: user.name,
        credits: user.credits,
        role: user.role,
      };
    }),

  /** 登录 */
  login: publicProcedure
    .input(z.object({
      identifier: z.string().min(1, "请输入手机号或邮箱"),
      password: z.string().min(1, "请输入密码"),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByIdentifier(input.identifier);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "账号不存在或密码错误" });
      }

      if (!user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "该账号未设置密码，请使用其他方式登录" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "账号不存在或密码错误" });
      }

      await db.updateUserLastSignedIn(user.id);

      const sessionToken = await sdk.createSessionToken(String(user.id), {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        id: user.id,
        identifier: user.identifier,
        identifierType: user.identifierType,
        name: user.name,
        credits: user.credits,
        role: user.role,
      };
    }),

  /** 登出 */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /** 获取当前登录用户信息 */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      identifier: ctx.user.identifier,
      identifierType: ctx.user.identifierType,
      name: ctx.user.name,
      credits: ctx.user.credits,
      role: ctx.user.role,
    };
  }),

  /** 获取积分流水 */
  creditLogs: protectedProcedure.query(async ({ ctx }) => {
    return db.getCreditLogs(ctx.user.id, 30);
  }),

  /** 管理员：充值积分 */
  adminGrantCredits: protectedProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().min(1).max(1000000),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
      }
      const newBalance = await db.grantCredits(input.userId, input.amount, input.note);
      return { newBalance };
    }),

  /** 管理员：用户列表 */
  adminUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权限" });
    }
    return db.getAllUsers(200);
  }),
});

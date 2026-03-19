import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const projectsRouter = router({
  /** 获取当前用户的所有项目列表 */
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await db.getUserProjects(ctx.user.id);
    return projects.map(p => ({
      id: p.id,
      clientId: p.clientId,
      name: p.name,
      lastActiveAt: p.lastActiveAt,
      createdAt: p.createdAt,
    }));
  }),

  /** 获取单个项目完整数据 */
  get: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectByClientId(ctx.user.id, input.clientId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
      }
      return {
        clientId: project.clientId,
        name: project.name,
        data: project.data,
        lastActiveAt: project.lastActiveAt,
      };
    }),

  /** 保存/创建项目（upsert） */
  save: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      name: z.string(),
      data: z.string(), // JSON 序列化的项目数据
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertProject({
        userId: ctx.user.id,
        clientId: input.clientId,
        name: input.name,
        projectData: input.data,
      });
      return { success: true };
    }),

  /** 删除项目（软删除） */
  delete: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteProject(ctx.user.id, input.clientId);
      return { success: true };
    }),
});

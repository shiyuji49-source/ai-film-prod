import { z } from "zod";
import Stripe from "stripe";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
import { CREDIT_PACKAGES } from "../products";
import { getDb } from "../db";
import { orders, creditLogs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const stripe = ENV.stripeSecretKey ? new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-01-27.acacia" as any }) : (null as any);

export const paymentRouter = router({
  /** 获取积分包列表 */
  getPackages: publicProcedure.query(() => {
    return CREDIT_PACKAGES;
  }),

  /** 创建 Stripe Checkout Session */
  createCheckout: protectedProcedure
    .input(z.object({
      packageId: z.string(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pkg = CREDIT_PACKAGES.find(p => p.id === input.packageId);
      if (!pkg) throw new Error("无效的积分包");

      const db = await getDb();
      if (!db) throw new Error("数据库连接失败");

      // 创建待支付订单
      const [inserted] = await db.insert(orders).values({
        userId: ctx.user.id,
        credits: pkg.credits,
        amountFen: pkg.amountFen,
        status: "pending",
      });

      const orderId = (inserted as any).insertId ?? 0;

      // 创建 Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "cny",
              product_data: {
                name: `鎏光机积分 - ${pkg.name}`,
                description: `${pkg.credits} 积分 · ${pkg.description}`,
              },
              unit_amount: pkg.amountFen,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        allow_promotion_codes: true,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          order_id: orderId.toString(),
          package_id: pkg.id,
          credits: pkg.credits.toString(),
          customer_email: ctx.user.identifier ?? "",
          customer_name: ctx.user.name ?? "",
        },
        success_url: `${input.origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/?payment=cancelled`,
      });

      // 更新订单的 stripeSessionId
      await db.update(orders)
        .set({ stripeSessionId: session.id })
        .where(eq(orders.id, orderId));

      return { checkoutUrl: session.url! };
    }),

  /** 查询用户订单历史 */
  getOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(orders)
      .where(and(eq(orders.userId, ctx.user.id), eq(orders.status, "paid")))
      .orderBy(orders.createdAt)
      .limit(50);
  }),
});

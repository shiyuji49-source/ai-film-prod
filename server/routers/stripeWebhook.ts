import express, { type Express } from "express";
import Stripe from "stripe";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { orders, users, creditLogs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = ENV.stripeSecretKey ? new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-01-27.acacia" as any }) : (null as any);

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          ENV.stripeWebhookSecret
        );
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Test events: return verification response
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Event: ${event.type} (${event.id})`);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
      }

      res.json({ received: true });
    }
  );
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) return;

  const userId = parseInt(session.metadata?.user_id ?? "0");
  const credits = parseInt(session.metadata?.credits ?? "0");
  const orderId = parseInt(session.metadata?.order_id ?? "0");

  if (!userId || !credits) {
    console.error("[Stripe Webhook] Missing metadata:", session.metadata);
    return;
  }

  try {
    // 更新订单状态
    if (orderId) {
      await db.update(orders)
        .set({ status: "paid", paidAt: new Date(), stripeSessionId: session.id })
        .where(eq(orders.id, orderId));
    }

    // 查询用户当前积分
    const [user] = await db.select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      console.error("[Stripe Webhook] User not found:", userId);
      return;
    }

    const newBalance = user.credits + credits;

    // 更新用户积分
    await db.update(users)
      .set({ credits: newBalance })
      .where(eq(users.id, userId));

    // 记录积分流水
    await db.insert(creditLogs).values({
      userId,
      delta: credits,
      balance: newBalance,
      action: "stripe_purchase",
      note: `Stripe 购买 ${credits} 积分 (session: ${session.id})`,
    });

    console.log(`[Stripe Webhook] User ${userId} credited ${credits} points. New balance: ${newBalance}`);
  } catch (err) {
    console.error("[Stripe Webhook] Error processing payment:", err);
  }
}

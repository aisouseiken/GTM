import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, WEBHOOK_SECRET } from "@/lib/stripe/client";
import { applyPlanChange, upsertSubscription } from "@/lib/data/store";
import type { Plan } from "@/lib/domain/types";

// Stripe Webhook 受信口。署名検証のため生のボディを使う。
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET 設定後に本番稼働。
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = WEBHOOK_SECRET();
  if (!stripe || !secret) {
    // 鍵未設定：Webhookは未接続（モック運用中）
    return NextResponse.json({ received: true, mock: true });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `signature verification failed: ${(e as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const workspaceId = s.metadata?.workspaceId || s.client_reference_id || undefined;
      const plan = s.metadata?.plan as Plan | undefined;
      if (workspaceId && plan) {
        applyPlanChange(workspaceId, plan);
        upsertSubscription(workspaceId, {
          plan,
          status: "active",
          stripeCustomerId: (s.customer as string) ?? undefined,
          stripeSubscriptionId: (s.subscription as string) ?? undefined,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      const plan = sub.metadata?.plan as Plan | undefined;
      if (workspaceId) {
        const canceled = event.type === "customer.subscription.deleted" || sub.status === "canceled";
        upsertSubscription(workspaceId, {
          status: canceled ? "canceled" : "active",
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: (sub as unknown as { current_period_end?: number }).current_period_end
            ? (sub as unknown as { current_period_end: number }).current_period_end * 1000
            : undefined,
        });
        if (canceled) applyPlanChange(workspaceId, "free");
        else if (plan) applyPlanChange(workspaceId, plan);
      }
      break;
    }
    case "invoice.paid": {
      // 月次の支払い成功 → 当月クレジットを付与（metadata から plan を参照）
      const inv = event.data.object as Stripe.Invoice;
      const workspaceId = inv.metadata?.workspaceId;
      const plan = inv.metadata?.plan as Plan | undefined;
      if (workspaceId && plan) applyPlanChange(workspaceId, plan);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

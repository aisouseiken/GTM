import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, applyPlanChange, upsertSubscription, getSubscription } from "@/lib/data/store";
import { getStripe, priceIdForPlan } from "@/lib/stripe/client";
import type { Plan } from "@/lib/domain/types";

// POST { workspaceId, plan } → Stripe Checkout セッションURL、または（鍵未設定時）モックでプラン適用
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId, plan } = (await req.json()) as { workspaceId: string; plan: Plan };
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (plan === "free" || plan === "enterprise")
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const billingUrl = `${origin}/app/w/${workspaceId}/billing`;
  const stripe = getStripe();
  const priceId = priceIdForPlan(plan);

  // 鍵・価格が揃っていれば本番の Checkout セッションを作成
  if (stripe && priceId) {
    const sub = getSubscription(workspaceId);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: sub?.stripeCustomerId,
      client_reference_id: workspaceId,
      metadata: { workspaceId, plan },
      subscription_data: { metadata: { workspaceId, plan } },
      success_url: `${billingUrl}?checkout=success`,
      cancel_url: `${billingUrl}?checkout=cancel`,
    });
    return NextResponse.json({ url: session.url, mode: "stripe" });
  }

  // 鍵未設定＝モック：プランを即時適用（デモ用。Webhook相当の処理をここで実行）
  applyPlanChange(workspaceId, plan);
  upsertSubscription(workspaceId, { plan, status: "active" });
  return NextResponse.json({ url: `${billingUrl}?checkout=mock`, mode: "mock" });
}

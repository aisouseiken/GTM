import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getSubscription } from "@/lib/data/store";
import { getStripe } from "@/lib/stripe/client";

// POST { workspaceId } → Stripe Billing Portal のURL（未設定時はモック）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = (await req.json()) as { workspaceId: string };
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const origin = new URL(req.url).origin;
  const billingUrl = `${origin}/app/w/${workspaceId}/billing`;
  const stripe = getStripe();
  const sub = getSubscription(workspaceId);

  if (stripe && sub?.stripeCustomerId) {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: billingUrl,
    });
    return NextResponse.json({ url: session.url, mode: "stripe" });
  }

  // 鍵未設定＝モック
  return NextResponse.json({ url: `${billingUrl}?portal=mock`, mode: "mock" });
}

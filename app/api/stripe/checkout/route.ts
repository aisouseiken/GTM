import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, setWorkspacePlan, grantMonthlyCredits, upsertSubscription, getSubscription } from "@/lib/data/store";
import { getStripe, priceIdForPlan } from "@/lib/stripe/client";
import type { Plan } from "@/lib/domain/types";

/*
 * このAPI（POST /api/stripe/checkout）は、有料プランへの申し込み手続きを始める窓口です。
 * 受け取るもの: ワークスペースID・希望プラン。
 * 返すもの: 決済ページ(Stripe Checkout)のURL。
 * ※Stripeの鍵が未設定の環境では、実際の決済をせずにプランを即時適用する「モック（お試し）」動作になります。
 */
// POST { workspaceId, plan } → Stripe Checkout セッションURL、または（鍵未設定時）モックでプラン適用
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 本文から対象ワークスペースと希望プランを読み取る
  const { workspaceId, plan } = (await req.json()) as { workspaceId: string; plan: Plan };
  // 所有者確認：そのワークスペースが本人のものかを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // 無料プランや法人プランは、この決済フローの対象外なので弾く
  if (plan === "free" || plan === "enterprise")
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  // 決済後に戻ってくる請求ページのURLを組み立てる
  const origin = new URL(req.url).origin;
  const billingUrl = `${origin}/app/w/${workspaceId}/billing`;
  const stripe = getStripe();
  const priceId = priceIdForPlan(plan);

  // 鍵・価格が揃っていれば本番の Checkout セッションを作成
  if (stripe && priceId) {
    // 既存の契約情報があれば、その顧客IDを引き継いで決済セッションを作る
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
    // 決済ページのURLを返し、画面側でそこへ移動させる
    return NextResponse.json({ url: session.url, mode: "stripe" });
  }

  // 鍵未設定のとき：
  // ★本番(production)では、鍵未設定でモック付与を許すと「決済なしで有料化＋クレジット増殖」の穴になる。
  //   そのため本番では実行せず 503（準備中）を返す。モックは開発環境だけに限定する。
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  // 開発環境のモック：プランを即時適用（Webビュー相当の処理をここで代替実行）。
  // ★冪等化：同じワークスペース×プラン×同じ月では二度と付与しない（連打による無限増殖を防止）。
  const ym = new Date().toISOString().slice(0, 7); // 例: "2026-07"
  setWorkspacePlan(workspaceId, plan);
  grantMonthlyCredits(workspaceId, plan, `mock:${workspaceId}:${plan}:${ym}`);
  upsertSubscription(workspaceId, { plan, status: "active" });
  return NextResponse.json({ url: `${billingUrl}?checkout=mock`, mode: "mock" });
}

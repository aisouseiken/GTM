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

  // 本文から対象ワークスペースと希望プランを読み取る（壊れたbodyは400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { workspaceId, plan } = body as { workspaceId: string; plan: Plan };
  // ★プランはホワイトリスト検証（free＋有料3種のみ許可。未知値でクラッシュさせない）
  if (!["free", "starter", "pro", "scale"].includes(plan))
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  // 所有者確認：そのワークスペースが本人のものかを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // ★Freeへのダウングレードは決済不要。即時に契約を解約扱いにしてプランをFreeへ（クレジットは付与しない）。
  //   以前はFreeを弾いて400を返し、画面は無言でリロードするだけ＝「押しても何も起きない」不具合だった。
  if (plan === "free") {
    setWorkspacePlan(workspaceId, "free");
    upsertSubscription(workspaceId, { plan: "free", status: "canceled" });
    return NextResponse.json({ url: `${new URL(req.url).origin}/app/w/${workspaceId}/billing?downgraded=1`, mode: "mock" });
  }

  // 決済後に戻ってくる請求ページのURLを組み立てる
  // 今アクセスされているサイトの土台部分のURL（例: https://example.com）を取り出す
  const origin = new URL(req.url).origin;
  // 決済が終わったあとに戻ってくる「請求ページ」のURLを組み立てる
  const billingUrl = `${origin}/app/w/${workspaceId}/billing`;
  // Stripe（決済サービス）に接続する窓口を用意する（鍵が無ければ null＝モック動作）
  const stripe = getStripe();
  // 選ばれたプランに対応する「価格ID」（Stripe側で決めた料金の識別番号）を取り出す
  const priceId = priceIdForPlan(plan);

  // 鍵・価格が揃っていれば本番の Checkout セッションを作成
  if (stripe && priceId) {
    // 既存の契約情報があれば、その顧客IDを引き継いで決済セッションを作る
    // このワークスペースの過去の契約情報を取り出す（顧客IDを引き継ぐため）
    const sub = getSubscription(workspaceId);
    // 決済ページ（Checkout）を1回分作成する。以下はその設定内容
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", // 継続課金（毎月の定期支払い）として契約する
      line_items: [{ price: priceId, quantity: 1 }], // 買う対象：この価格IDを1つ
      customer: sub?.stripeCustomerId, // 既存の顧客ならその顧客IDを引き継ぐ（無ければ新規）
      client_reference_id: workspaceId, // どのワークスペースの決済かを紐づける参照ID
      metadata: { workspaceId, plan }, // 付帯情報（あとで通知処理で参照するため）
      subscription_data: { metadata: { workspaceId, plan } }, // 契約自体にも同じ付帯情報を付ける
      success_url: `${billingUrl}?checkout=success`, // 支払い成功時に戻る先のURL
      cancel_url: `${billingUrl}?checkout=cancel`, // 支払いをやめたときに戻る先のURL
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
  // ★冪等化：同じワークスペース×プラン×同じ月では二度と付与しない。
  //   キーにプランを含めることで、アップグレード時（例 starter→pro）は別キー＝正しく付与され、
  //   同じプランの連打・往復は同キー＝再付与されない（＝増殖はプラン種類数ぶんに限定＝安全）。
  const ym = new Date().toISOString().slice(0, 7); // 例: "2026-07"（今の年と月を取り出す）
  setWorkspacePlan(workspaceId, plan); // 契約プランを選ばれたプランに設定する
  grantMonthlyCredits(workspaceId, plan, `mock:${workspaceId}:${plan}:${ym}`); // 当月分のクレジットを付与（プラン込みキーで二重付与防止）
  upsertSubscription(workspaceId, { plan, status: "active" }); // 契約情報を「有効」で保存・更新する
  // モックのURLを返す（画面側は決済ページに飛ばず、その場でプラン切替済みとして扱う）
  return NextResponse.json({ url: `${billingUrl}?checkout=mock`, mode: "mock" });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getSubscription } from "@/lib/data/store";
import { getStripe } from "@/lib/stripe/client";

/*
 * このAPI（POST /api/stripe/portal）は、支払い方法の変更や解約などを行う
 * Stripeの「顧客ポータル」ページへの入口URLを返す窓口です。
 * 受け取るもの: ワークスペースID。返すもの: 顧客ポータルのURL。
 * ※Stripeの鍵や顧客情報が無い環境では、モック（お試し）URLを返します。
 */
// POST { workspaceId } → Stripe Billing Portal のURL（未設定時はモック）
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 本文から対象ワークスペースを読み取る（壊れたbodyは400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { workspaceId } = body as { workspaceId: string };
  // 所有者確認：そのワークスペースが本人のものかを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // ポータルから戻ってくる先の請求ページURLを組み立てる
  // 今アクセスされているサイトの土台部分のURL（例: https://example.com）を取り出す
  const origin = new URL(req.url).origin;
  // 顧客ポータルを閉じたあとに戻ってくる「請求ページ」のURLを組み立てる
  const billingUrl = `${origin}/app/w/${workspaceId}/billing`;
  // Stripe（決済サービス）に接続する窓口を用意する（鍵が無ければ null＝モック動作）
  const stripe = getStripe();
  // このワークスペースの契約情報を取り出す（顧客IDを確認するため）
  const sub = getSubscription(workspaceId);

  // Stripeが使えて、かつ顧客IDがあれば、本物の顧客ポータルセッションを作る
  if (stripe && sub?.stripeCustomerId) {
    // 顧客ポータル（契約管理画面）を1回分作成する
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId, // どの顧客の管理画面を開くか
      return_url: billingUrl, // 管理画面を閉じたときに戻る先のURL
    });
    // 作った管理画面のURLを返し、画面側でそこへ移動させる
    return NextResponse.json({ url: session.url, mode: "stripe" });
  }

  // 鍵未設定＝モック
  // 決済が未設定のとき：本物の管理画面は作れないので、モック（お試し）のURLを返す
  return NextResponse.json({ url: `${billingUrl}?portal=mock`, mode: "mock" });
}

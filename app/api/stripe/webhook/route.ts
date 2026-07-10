import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, WEBHOOK_SECRET } from "@/lib/stripe/client";
import { setWorkspacePlan, grantMonthlyCredits, upsertSubscription, findWorkspaceByStripe } from "@/lib/data/store";
import type { Plan } from "@/lib/domain/types";

/*
 * このAPI（POST /api/stripe/webhook）は、決済サービス Stripe（クレジットカード決済などの外部サービス）から
 * 送られてくる「お知らせ」（Webhook＝外部サービスからの自動通知）を受け取る窓口です。
 * 例：「契約が成立した」「支払いが成功した」「支払いに失敗した」「返金した」など。
 * これらの通知を受けて、当サービス側の「プラン」や「クレジット残高」を自動で書き換えます。
 * ※通知が本物かどうかは「署名」（本物であることを示す暗号の印）で必ず確認します。
 */
// Stripe Webhook 受信口。署名検証のため生のボディを使う。
// STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET 設定後に本番稼働。
export async function POST(req: Request) {
  // Stripe に接続する窓口を用意する（鍵が無ければ null＝モック動作）
  const stripe = getStripe();
  // 通知が本物か検証するための秘密の合言葉（署名検証用の鍵）を取得
  const secret = WEBHOOK_SECRET();
  // 接続窓口か合言葉のどちらかが無い＝まだ決済の準備ができていない状態
  if (!stripe || !secret) {
    // ★本番で鍵未設定なら 500 で失敗させる（フェイルクローズ）。
    //   200を返す（フェイルオープン）と、実決済が起きているのに全イベントを素通りさせてしまう。
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
    }
    // 開発環境：Webhookは未接続（モック運用中）
    return NextResponse.json({ received: true, mock: true });
  }

  // 通知に付いている「署名」（本物であることを示す印）を取り出す
  const sig = req.headers.get("stripe-signature");
  // 署名が無い通知は本物か確認できないので拒否する（400＝不正なリクエスト）
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  // 通知の中身を「加工せずそのままの文字列」で受け取る（署名の照合には元のままの文が必要）
  const body = await req.text();
  // 検証済みの通知イベント（出来事の情報）を入れる箱を用意
  let event: Stripe.Event;
  try {
    // 中身・署名・合言葉を突き合わせて、本物の通知か検証する（本物ならeventに中身が入る）
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    // 署名検証失敗。詳細はレスポンスに出さず、汎用文言のみ返す（内部情報を漏らさない）
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 通知の種類（event.type）によって、やるべき処理を振り分ける
  switch (event.type) {
    // ▼「決済ページでの手続きが完了した」＝契約が成立したときの通知
    case "checkout.session.completed": {
      // 契約成立：プランを設定するだけ（クレジット付与はしない）。
      // 付与は下の invoice.paid で1回だけ行う → 二重計上を防ぐ。
      // 通知に含まれる決済手続き（Checkout）の詳細情報を取り出す
      const s = event.data.object as Stripe.Checkout.Session;
      // どのワークスペースの契約かを特定する（付帯情報→参照ID の順で探す）
      const workspaceId = s.metadata?.workspaceId || s.client_reference_id || undefined;
      // どのプランを契約したかを取り出す
      const plan = s.metadata?.plan as Plan | undefined;
      // ワークスペースとプランが両方わかったときだけ反映する
      if (workspaceId && plan) {
        // そのワークスペースの契約プランを、選ばれたプランに設定する
        setWorkspacePlan(workspaceId, plan);
        // 契約情報を保存・更新する（Stripe側の顧客ID・契約IDも一緒に記録）
        upsertSubscription(workspaceId, {
          plan,
          status: "active",
          stripeCustomerId: (s.customer as string) ?? undefined,
          stripeSubscriptionId: (s.subscription as string) ?? undefined,
        });
      }
      break;
    }
    // ▼「契約内容が変わった」／「契約が解約された」ときの通知（2種類をまとめて処理）
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // プラン変更・解約：プランを切り替えるだけ（クレジットは足さない）
      // 通知に含まれる契約（サブスク＝月額などの継続課金）の詳細情報を取り出す
      const sub = event.data.object as Stripe.Subscription;
      // ★metadataが欠けても、サブスクID/顧客IDから逆引きして必ず反映する（解約漏れ防止）
      // どのワークスペースの契約かを特定する（付帯情報→ID逆引き の順で探す）
      const workspaceId =
        sub.metadata?.workspaceId ||
        findWorkspaceByStripe(sub.id, sub.customer as string);
      // 変更後のプランを取り出す（解約時は使わない）
      const plan = sub.metadata?.plan as Plan | undefined;
      // ワークスペースが特定できたときだけ反映する
      if (workspaceId) {
        // 「解約されたかどうか」を判定（削除通知、または状態がcanceled＝解約済み）
        const canceled = event.type === "customer.subscription.deleted" || sub.status === "canceled";
        // 契約情報を更新（状態・契約ID・今の課金期間の終了日時を記録）
        upsertSubscription(workspaceId, {
          // 解約なら「canceled（解約済み）」、そうでなければ「active（有効）」
          status: canceled ? "canceled" : "active",
          stripeSubscriptionId: sub.id,
          // 今の請求期間の終了日時（秒→ミリ秒に変換して記録。無ければ未設定）
          currentPeriodEnd: (sub as unknown as { current_period_end?: number }).current_period_end
            ? (sub as unknown as { current_period_end: number }).current_period_end * 1000
            : undefined,
        });
        // 解約なら無料プランに戻す。プラン変更なら新しいプランに切り替える
        if (canceled) setWorkspacePlan(workspaceId, "free");
        else if (plan) setWorkspacePlan(workspaceId, plan);
      }
      break;
    }
    // ▼「請求の支払いが成功した」ときの通知（＝実際にお金が支払われた）
    case "invoice.paid": {
      // 支払い成功 → ここでだけ当月クレジットを付与。
      // ★workspaceId/plan は invoice.metadata に自動では乗らないため、サブスク側から逆引きする。
      //   dedupeKey は invoice.id（無ければ event.id）で冪等化＝二重計上防止。
      // 通知に含まれる請求書（invoice＝支払いの明細）の詳細情報を取り出す
      const inv = event.data.object as Stripe.Invoice;
      // この請求がひもづく契約（サブスク）のIDを取り出す
      const subId = (inv as unknown as { subscription?: string }).subscription;
      // この請求がひもづく顧客のIDを取り出す
      const custId = inv.customer as string | undefined;
      // どのワークスペースの支払いかを特定する（付帯情報→ID逆引き の順で探す）
      const workspaceId = inv.metadata?.workspaceId || findWorkspaceByStripe(subId, custId);
      // planは、逆引きした購読情報から取得（保存済みの契約プラン）
      // どのプランのクレジットを付与するか決める（付帯情報→保存済み契約から取得）
      const plan = (inv.metadata?.plan as Plan | undefined) ??
        (workspaceId ? (await import("@/lib/data/store")).getSubscription(workspaceId)?.plan : undefined);
      // ワークスペースとプランが両方わかったときだけクレジットを付与
      if (workspaceId && plan) {
        // 当月分のクレジットを付与する（第3引数は「同じ請求で二重付与しない」ための合言葉）
        grantMonthlyCredits(workspaceId, plan, `invoice:${inv.id ?? event.id}`);
      }
      break;
    }
    // ▼「請求の支払いに失敗した」ときの通知（＝カード決済などが通らなかった）
    case "invoice.payment_failed": {
      // 支払い失敗 → 契約を past_due（支払遅延）にする（機能制限の判断材料）
      // 通知に含まれる請求書（支払いの明細）の詳細情報を取り出す
      const inv = event.data.object as Stripe.Invoice;
      // この請求がひもづく契約（サブスク）のIDを取り出す
      const subId = (inv as unknown as { subscription?: string }).subscription;
      // どのワークスペースの支払いかを特定する（付帯情報→ID逆引き の順で探す）
      const workspaceId = inv.metadata?.workspaceId || findWorkspaceByStripe(subId, inv.customer as string);
      // 特定できたら契約状態を「past_due（支払遅延）」に変更する
      if (workspaceId) upsertSubscription(workspaceId, { status: "past_due" });
      break;
    }
    // ▼「返金した」ときの通知（＝支払ったお金を客に戻した）
    case "charge.refunded": {
      // 返金 → 契約を解約扱いにし、プランを free に戻す（付与済みクレジットの扱いは事業方針で別途）
      // 通知に含まれる支払い（charge＝1回の課金）の詳細情報を取り出す
      const ch = event.data.object as Stripe.Charge;
      // 顧客IDから、どのワークスペースかを逆引きして特定する
      const workspaceId = findWorkspaceByStripe(undefined, ch.customer as string);
      // 特定できたら、契約を解約扱いにして無料プランへ戻す
      if (workspaceId) {
        upsertSubscription(workspaceId, { status: "canceled" });
        setWorkspacePlan(workspaceId, "free");
      }
      break;
    }
    // ▼上記以外の通知は、特に何もしない（当サービスに関係のない種類）
    default:
      break;
  }

  // Stripeに「通知を正しく受け取りました」と返事する（これがないと再送され続ける）
  return NextResponse.json({ received: true });
}

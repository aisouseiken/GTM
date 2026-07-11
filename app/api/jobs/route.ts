// ============================================================================
// このAPI（POST /api/jobs）は、あらかじめ作っておいた「検索プラン」をもとに、
// 実際の「ジョブ（実行タスク＝これから動かす作業の単位）」を1つ作る窓口です。
// 受け取るもの: プランID(planId)。
// 返すもの: 作成したジョブのID(jobId)。
// ※この窓口はジョブを“作る”だけです。実際に動かして進捗を見るのは別の窓口
//   /api/jobs/[id]/stream が担当します。
// ============================================================================

// NextResponse = サーバーからの応答を作る道具
import { NextResponse } from "next/server";
// getCurrentUser = 今アクセスしている人が誰か（ログイン済みの本人）を取得する
import { getCurrentUser } from "@/lib/auth/session";
// 検索プラン取得・ワークスペース取得・ウォレット(残高財布)取得・実行中ジョブ数の集計・監査ログ記録
import { getSearchPlan, getWorkspace, getWallet, countActiveJobs, addAudit } from "@/lib/data/store";
// createJob = プランからジョブ（実行タスク）を作る部品
import { createJob } from "@/lib/agent/runner";
// PLAN_INFO = 料金プランごとの上限などの設定情報（例：同時に動かせる本数）
import { PLAN_INFO } from "@/lib/domain/types";
// rateLimit = 短時間の呼び出し回数を制限する仕組み（乱発防止）
import { rateLimit } from "@/lib/ratelimit";

// 【ジョブ作成】POST /api/jobs
export async function POST(req: Request) {
  // ログイン確認：ログインしていなければ 401（＝認証（本人確認）が必要）を返して中止
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // リクエスト本文をJSON（データのやり取り用の書式）として読み取る
  const body = await req.json().catch(() => null); // 壊れた本文なら null にして、この後 400 にする
  // 本文が読めなければ 400（＝リクエストが不正）を返す
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 本文からプランID(planId)を取り出す
  const { planId } = body as { planId: string };
  // そのIDの検索プランを探す
  const plan = getSearchPlan(planId);
  // 見つからなければ 404（＝対象が存在しない）を返す
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
  // 所有者確認：プランが属するワークスペースの持ち主がログイン中の本人かを確認する
  const ws = getWorkspace(plan.workspaceId);
  // 存在しない、または本人のものでなければ 403（＝権限が無く禁止）を返す
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // レート制限：同じワークスペースで1分（60_000ミリ秒）あたり30回まで。
  // 超えたら 429（＝回数が多すぎる）を返す。ジョブの乱発で費用が膨らむのを防ぐため。
  if (!rateLimit(`jobs:${plan.workspaceId}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 同時実行の上限チェック：今このワークスペースで動いているジョブ数が、
  // 料金プランで決められた同時実行本数(concurrency)以上なら 429 を返す。
  // 一度にたくさん動かして残高がマイナスになったり費用が暴走するのを防ぐため。
  if (countActiveJobs(plan.workspaceId) >= PLAN_INFO[ws.plan].concurrency) {
    return NextResponse.json({ error: "too_many_running_jobs" }, { status: 429 });
  }

  // クレジット（利用のためのポイント残高）チェック：
  // ウォレット（残高を入れる財布）が無い、または残高が0以下なら 402（＝支払いが必要）を返す。
  // ★以前は「wallet && …」と書いていたため、財布が未作成のときにチェックをすり抜けていた不具合があった。
  //   「!wallet ||」に修正し、財布が無い場合もきちんと止まるようにしている。
  // ★最低でも1リード分（発見1＋検証2＝最大3クレジット）の残高が無ければ 402。
  //   残高が1〜2だと「実行はされるが1件も取れない空ジョブ」が無限に作られてしまうのを防ぐ。
  const wallet = getWallet(plan.workspaceId);
  if (!wallet || wallet.balance < 3)
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

  // ここまで全チェックを通過。ジョブを作成する。
  const job = createJob(plan);
  // 監査ログに「誰が・どのワークスペースで検索を開始したか」を記録する
  addAudit({ actor: `user:${user.id}`, action: "search", target: plan.workspaceId, meta: { jobId: job.id } });
  // 作成したジョブのIDを返す（画面側はこのIDを使って進捗の窓口に接続する）
  return NextResponse.json({ jobId: job.id });
}

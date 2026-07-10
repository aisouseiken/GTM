import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSearchPlan, getWorkspace, getWallet, countActiveJobs, addAudit } from "@/lib/data/store";
import { createJob } from "@/lib/agent/runner";
import { PLAN_INFO } from "@/lib/domain/types";
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（POST /api/jobs）は、作成済みの「検索プラン」から実際の「ジョブ（実行タスク）」を作る窓口です。
 * 受け取るもの: プランID(planId)。
 * 返すもの: 作成したジョブのID(jobId)。
 * ※ここではジョブを作るだけで、実行そのものは /api/jobs/[id]/stream で行います。
 */
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // リクエスト本文からプランIDを読み取り、対応するプランを取り出す
  const body = await req.json().catch(() => null); // 壊れたbodyは400にする
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { planId } = body as { planId: string };
  const plan = getSearchPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
  // 所有者確認：プランが属するワークスペースがログイン中の本人のものかを確認する
  const ws = getWorkspace(plan.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // レート制限：ワークスペース単位で1分あたり30回まで（ジョブ乱発によるコスト暴走を防ぐ）
  if (!rateLimit(`jobs:${plan.workspaceId}`, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 同時実行の上限：プランごとの concurrency を超えていたら 429（並列での残高マイナス/原価暴走を防ぐ）
  if (countActiveJobs(plan.workspaceId) >= PLAN_INFO[ws.plan].concurrency) {
    return NextResponse.json({ error: "too_many_running_jobs" }, { status: 429 });
  }

  // クレジット残高チェック：ウォレットが無い or 残高0以下なら 402（支払いが必要）
  // ★以前は「wallet && …」でウォレット未存在時にチェックをすり抜けていた。「!wallet ||」に修正。
  const wallet = getWallet(plan.workspaceId);
  if (!wallet || wallet.balance <= 0)
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

  // ジョブを作成し、そのIDを返す
  const job = createJob(plan);
  // 監査ログ：誰が・どのワークスペースで検索を開始したかを記録
  addAudit({ actor: `user:${user.id}`, action: "search", target: plan.workspaceId, meta: { jobId: job.id } });
  return NextResponse.json({ jobId: job.id });
}

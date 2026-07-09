import { NextResponse } from "next/server";
import { bearerFrom, resolveApiKey } from "@/lib/auth/apikey";
import { getWorkspace, getWallet, saveApiKey } from "@/lib/data/store";
import { createPlan } from "@/lib/agent/planner";
import { createJob, runSearchJob } from "@/lib/agent/runner";

// 公開REST API：検索ジョブを作成して実行（差別化ポイント：origamiには公開APIが無い）
// POST /v1/search  { prompt, market?, max_results? }
export async function POST(req: Request) {
  const key = resolveApiKey(bearerFrom(req));
  if (!key) return NextResponse.json({ error: "invalid api key" }, { status: 401 });

  const ws = getWorkspace(key.workspaceId);
  if (!ws) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  key.lastUsedAt = Date.now();
  saveApiKey(key);

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    market?: "JP" | "GLOBAL";
    max_results?: number;
  };
  if (!body.prompt?.trim())
    return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const wallet = getWallet(ws.id);
  if (wallet && wallet.balance <= 0)
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

  const plan = createPlan(
    ws.id,
    "api",
    body.prompt,
    body.market ?? ws.market,
    Math.min(body.max_results ?? 24, 40)
  );
  const job = createJob(plan);
  // API 経由は同期実行（完了まで待つ）
  await runSearchJob(job.id, () => {});

  return NextResponse.json({ job_id: job.id, status: "created" });
}

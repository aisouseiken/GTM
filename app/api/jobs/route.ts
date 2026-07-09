import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSearchPlan, getWorkspace, getWallet } from "@/lib/data/store";
import { createJob } from "@/lib/agent/runner";

// 検索プランからジョブを作成（実行は /api/jobs/[id]/stream で）
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { planId } = (await req.json()) as { planId: string };
  const plan = getSearchPlan(planId);
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
  const ws = getWorkspace(plan.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const wallet = getWallet(plan.workspaceId);
  if (wallet && wallet.balance <= 0)
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

  const job = createJob(plan);
  return NextResponse.json({ jobId: job.id });
}

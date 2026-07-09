import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getJob, getLead, listLeadsByJob, saveLead, getWorkspace } from "@/lib/data/store";

// ジョブのリード一覧
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ leads: [] });
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ leads: listLeadsByJob(jobId), job });
}

// リードのステータス更新（favorite / excluded / new）
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { leadId, status } = (await req.json()) as {
    leadId: string;
    status: "new" | "favorite" | "excluded";
  };
  const lead = getLead(leadId);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ws = getWorkspace(lead.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  saveLead({ ...lead, status });
  return NextResponse.json({ ok: true });
}

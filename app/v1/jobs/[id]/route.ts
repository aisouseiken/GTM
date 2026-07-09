import { NextResponse } from "next/server";
import { bearerFrom, resolveApiKey } from "@/lib/auth/apikey";
import { getJob, listLeadsByJob } from "@/lib/data/store";

// 公開REST API：ジョブ結果取得
// GET /v1/jobs/{id}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = resolveApiKey(bearerFrom(req));
  if (!key) return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  const { id } = await params;
  const job = getJob(id);
  if (!job || job.workspaceId !== key.workspaceId)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const leads = listLeadsByJob(id).map((l) => ({
    company: l.companyName,
    domain: l.domain,
    email: l.email,
    phone: l.phone,
    location: l.location,
    industry: l.category,
    headcount: l.headcount,
    funding: l.funding,
    buying_signal: l.buyingSignal,
    fit_score: l.fitScore,
    confidence: l.confidence,
    sources: l.sources.map((s) => ({ label: s.label, url: s.url })),
  }));

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    result_count: job.resultCount,
    credits_spent: job.creditsSpent,
    leads,
  });
}

import { getCurrentUser } from "@/lib/auth/session";
import { getJob, listLeadsByJob, getWorkspace } from "@/lib/data/store";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ジョブのリードを CSV でエクスポート（無料）
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return new Response("jobId required", { status: 400 });
  const job = getJob(jobId);
  if (!job) return new Response("not found", { status: 404 });
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  const leads = listLeadsByJob(jobId).filter((l) => l.status !== "excluded");
  const headers = [
    "会社名", "ドメイン", "メール", "電話", "所在地", "業種",
    "従業員", "資金", "シグナル", "FitScore", "信頼度", "出典",
  ];
  const rows = leads.map((l) =>
    [
      l.companyName, l.domain, l.email ?? "", l.phone ?? "", l.location,
      l.category, l.headcount ?? "", l.funding ?? "", l.buyingSignal ?? "",
      l.fitScore, l.confidence, l.sources.map((s) => s.label).join(" / "),
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = "﻿" + [headers.join(","), ...rows].join("\n"); // BOM 付きで Excel 対応

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gtm-leads-${jobId}.csv"`,
    },
  });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getJob, getLead, listLeadsByJob, saveLead, getWorkspace } from "@/lib/data/store";

/*
 * このファイルはリード（見込み客）を扱う窓口で、2つの入口があります。
 *  - GET  /api/leads?jobId=... : 指定ジョブで見つかったリードの一覧を返す
 *  - PATCH /api/leads          : 特定リードの状態（お気に入り／除外／未対応）を更新する
 */

// ジョブのリード一覧
export async function GET(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // URLの ?jobId=... から、どのジョブのリードが欲しいかを読み取る
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  // ジョブが無ければ空の一覧を返す
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ leads: [] });
  // 所有者確認：そのジョブが本人のワークスペースのものかを確認する
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // リード一覧とジョブ情報を返す
  return NextResponse.json({ leads: listLeadsByJob(jobId), job });
}

// リードのステータス更新（favorite / excluded / new）
export async function PATCH(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 更新したいリードIDと、新しい状態を本文から読み取る（壊れたbodyは400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { leadId, status } = body as {
    leadId: string;
    status: "new" | "favorite" | "excluded";
  };
  // ★状態はホワイトリスト検証（未知の値を保存させない）
  if (!["new", "favorite", "excluded"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  // 対象のリードを取得。無ければ 404（見つからない）
  const lead = getLead(leadId);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 所有者確認：そのリードが本人のワークスペースのものかを確認する
  const ws = getWorkspace(lead.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // 状態だけを差し替えて保存し、成功を返す
  saveLead({ ...lead, status });
  return NextResponse.json({ ok: true });
}

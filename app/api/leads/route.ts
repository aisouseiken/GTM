// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// 「今ログインしているのは誰か（本人確認）」を調べる道具を読み込む
import { getCurrentUser } from "@/lib/auth/session";
// データ保管庫（データベース）を読み書きする道具を読み込む（ジョブ・リード・一覧取得・保存・ワークスペース取得）
import { getJob, getLead, listLeadsByJob, saveLead, getWorkspace } from "@/lib/data/store";

/*
 * このファイルはリード（見込み客）を扱う窓口で、2つの入口があります。
 *  - GET  /api/leads?jobId=... : 指定ジョブで見つかったリードの一覧を返す（読み取り）
 *  - PATCH /api/leads          : 特定リードの状態（お気に入り／除外／未対応）を更新する（書き換え）
 *
 * ※「ジョブ」＝1回分の検索作業のこと。「リード」＝その検索で見つかった見込み客のこと。
 * ※「ワークスペース」＝会社・チームごとの作業場所。ここでは「そのデータが自分のものか」の判定に使う。
 */

// ─────────────────────────────────────────────
// GET：指定したジョブで見つかったリードの一覧を返す処理
// ─────────────────────────────────────────────
export async function GET(req: Request) {
  // まずログインしている本人を取得する（あとで結果が返るので await で待つ）
  const user = await getCurrentUser();
  // ログインしていない場合は、ここで中断して「401（ログインが必要）」を返す
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // アクセスされたURLの「?jobId=◯◯」部分から、どのジョブを見たいかのIDを取り出す
  const jobId = new URL(req.url).searchParams.get("jobId");
  // ジョブIDが付いていなければ「400（リクエストが不正）」を返して中断する
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  // そのIDのジョブを保管庫から取り出す
  const job = getJob(jobId);
  // ジョブが存在しなければ、エラーにせず「リードは空っぽ」として返す
  if (!job) return NextResponse.json({ leads: [] });
  // そのジョブが属するワークスペース（作業場所）を取り出す
  const ws = getWorkspace(job.workspaceId);
  // ワークスペースが無い、または持ち主がログイン本人でないなら「403（権限なし）」を返す（他人のデータを覗かせない）
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // ここまで来たら本人確認OK。リード一覧とジョブの概要をまとめて返す
  // ★原価 costInternal は社内だけの機微情報なので、あえて画面用のデータには含めない
  return NextResponse.json({
    // このジョブに紐づくリード（見込み客）の一覧
    leads: listLeadsByJob(jobId),
    // 画面で表示するジョブの概要情報だけを選んで返す
    job: {
      id: job.id, // ジョブの識別番号
      status: job.status, // ジョブの状態（実行中・完了 など）
      resultCount: job.resultCount, // 見つかった件数
      creditsSpent: job.creditsSpent, // このジョブで使ったクレジット（利用ポイント）数
    },
  });
}

// ─────────────────────────────────────────────
// PATCH：特定リードの状態を更新する処理
//   favorite（お気に入り）／ excluded（除外）／ new（未対応）に切り替える
// ─────────────────────────────────────────────
export async function PATCH(req: Request) {
  // まずログインしている本人を取得する（あとで結果が返るので await で待つ）
  const user = await getCurrentUser();
  // ログインしていなければ「401（ログインが必要）」を返して中断する
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // リクエストの本文（送られてきたデータ）をJSONとして読み取る
  // ★もし中身が壊れていて読み取れなくても、エラーで落ちないよう null 扱いにする
  const body = await req.json().catch(() => null);
  // 読み取れなかった（null）場合は「400（リクエストが不正）」を返して中断する
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 本文から「どのリードを」「どの状態に」変えるかを取り出す
  const { leadId, status } = body as {
    leadId: string;
    status: "new" | "favorite" | "excluded";
  };
  // ★状態は決められた3種類（new / favorite / excluded）のいずれかだけを許可する
  //   それ以外の見慣れない値は保存させず、「400（不正）」で弾く（安全対策）
  if (!["new", "favorite", "excluded"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  // 指定されたIDのリードを保管庫から取り出す
  const lead = getLead(leadId);
  // 見つからなければ「404（対象が存在しない）」を返して中断する
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  // そのリードが属するワークスペース（作業場所）を取り出す
  const ws = getWorkspace(lead.workspaceId);
  // ワークスペースが無い、または持ち主がログイン本人でないなら「403（権限なし）」を返す（他人のデータを触らせない）
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // 元のリードの内容はそのままに、状態(status)だけを新しい値に差し替えて保存する
  saveLead({ ...lead, status });
  // 正常に更新できたことを伝える（ok: true）
  return NextResponse.json({ ok: true });
}

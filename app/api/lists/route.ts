// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// 「今ログインしているのは誰か（本人確認）」を調べる道具を読み込む
import { getCurrentUser } from "@/lib/auth/session";
// データ保管庫を読み書きする道具を読み込む（リスト作成・ワークスペース取得・リード取得）
import { createList, getWorkspace, getLead } from "@/lib/data/store";

/*
 * このAPI（POST /api/lists）は、選んだリード（見込み客）をまとめた「リスト」を保存する窓口です。
 * 受け取るもの: ワークスペースID・リスト名・含めるリードIDの配列。
 * 返すもの: 作成したリスト。
 * ※たとえば「今週アプローチする見込み客20社」をひとまとめにして名前を付けて保存するイメージ。
 */
// ─────────────────────────────────────────────
// POST：選んだリードをまとめてリストとして保存する処理
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  // まずログインしている本人を取得する（あとで結果が返るので await で待つ）
  const user = await getCurrentUser();
  // ログインしていなければ「401（ログインが必要）」を返して中断する
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // リクエストの本文（送られてきたデータ）をJSONとして読み取る
  // ★中身が壊れていて読み取れなくても落ちないよう、失敗時は null 扱いにする
  const body = await req.json().catch(() => null);
  // 読み取れなかった場合は「400（リクエストが不正）」を返して中断する
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 本文から「どのワークスペースに」「何という名前で」「どのリードを」保存するかを取り出す
  const { workspaceId, name, leadIds } = body as {
    workspaceId: string;
    name: string;
    leadIds: string[];
  };
  // 指定されたワークスペース（作業場所）を保管庫から取り出す
  const ws = getWorkspace(workspaceId);
  // ワークスペースが無い、または持ち主がログイン本人でないなら「403（権限なし）」を返す
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // ★リードIDの一覧が「本当に配列（複数の並び）か」「1000件以内か」をチェックする
  //   巨大なデータを送りつけてサーバーを重くする攻撃（DoS）を防ぐための上限
  if (!Array.isArray(leadIds) || leadIds.length > 1000)
    return NextResponse.json({ error: "invalid leadIds" }, { status: 400 });
  // ★送られてきたリードIDのうち、このワークスペースに本当に属するものだけを選び出す
  //   他人のリードIDをこっそり混ぜて中身を覗く不正（IDOR）を防ぐための絞り込み
  const ownIds = leadIds.filter((lid) => {
    const lead = getLead(lid); // そのIDのリードを取り出し
    return lead && lead.workspaceId === workspaceId; // 存在し、かつ同じワークスペースのものだけ残す
  });
  // リストを新規作成する。名前が空なら「無題のリスト」を使い、長すぎる名前は120文字までに切り詰める
  const list = createList(workspaceId, (name || "無題のリスト").slice(0, 120), ownIds);
  // 作成したリストを返す
  return NextResponse.json({ list });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createList, getWorkspace } from "@/lib/data/store";

/*
 * このAPI（POST /api/lists）は、選んだリード（見込み客）をまとめた「リスト」を保存する窓口です。
 * 受け取るもの: ワークスペースID・リスト名・含めるリードIDの配列。
 * 返すもの: 作成したリスト。
 */
// リードリストを保存
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 本文から、どのワークスペースに・何という名前で・どのリードを保存するかを読み取る（壊れたbodyは400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { workspaceId, name, leadIds } = body as {
    workspaceId: string;
    name: string;
    leadIds: string[];
  };
  // 所有者確認：指定ワークスペースが本人のものかを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // リストを作成（名前が空なら「無題のリスト」、リードが無ければ空配列）して返す
  const list = createList(workspaceId, name || "無題のリスト", leadIds || []);
  return NextResponse.json({ list });
}

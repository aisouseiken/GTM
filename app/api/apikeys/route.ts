import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, listApiKeys } from "@/lib/data/store";
import { issueApiKey } from "@/lib/auth/apikey";

/*
 * このファイルは公開APIを使うための「APIキー（合言葉のような認証用の鍵）」を扱う窓口で、2つの入口があります。
 *  - GET  /api/apikeys?workspaceId=... : そのワークスペースのAPIキー一覧を返す
 *  - POST /api/apikeys                 : 新しいAPIキーを発行する
 */

// APIキーの一覧を取得
export async function GET(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // URLの ?workspaceId=... で、どのワークスペースの鍵一覧かを指定する
  const wid = new URL(req.url).searchParams.get("workspaceId");
  if (!wid) return NextResponse.json({ keys: [] });
  // 所有者確認：そのワークスペースが本人のものかを確認する
  const ws = getWorkspace(wid);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // APIキーの一覧を返す
  return NextResponse.json({ keys: listApiKeys(wid) });
}

// 新しいAPIキーを発行
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 本文から、どのワークスペース用に・どんな名前で発行するかを読み取る（壊れたbodyは400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { workspaceId, name } = body as { workspaceId: string; name: string };
  // 所有者確認：そのワークスペースが本人のものかを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // 新しいAPIキーを発行して返す。
  // raw は「発行直後だけ表示できる元の鍵文字列」で、この後は再表示できない点に注意
  const { apiKey, raw } = issueApiKey(workspaceId, name);
  return NextResponse.json({ apiKey, raw });
}

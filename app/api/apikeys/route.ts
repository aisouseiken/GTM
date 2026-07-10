import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, listApiKeys, getApiKey, revokeApiKey, addAudit } from "@/lib/data/store";
import { issueApiKey } from "@/lib/auth/apikey";
import type { ApiKey } from "@/lib/domain/types";

// 画面へ返してよい公開用の項目だけに絞る（keyHash=鍵のハッシュは絶対にクライアントへ出さない）
function toPublic(k: ApiKey) {
  return {
    id: k.id,
    name: k.name,
    keyPreview: k.keyPreview,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  };
}

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
  // APIキーの一覧を返す（keyHashを除いた公開用の項目のみ）
  return NextResponse.json({ keys: listApiKeys(wid).map(toPublic) });
}

// APIキーを失効させる（漏えい時に無効化できるように）
// DELETE /api/apikeys { keyId }
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { keyId } = body as { keyId: string };
  const key = getApiKey(keyId);
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 所有者確認：そのキーのワークスペースが本人のものかを確認する
  const ws = getWorkspace(key.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  revokeApiKey(keyId);
  addAudit({ actor: `user:${user.id}`, action: "apikey.revoke", target: key.workspaceId, meta: { keyId } });
  return NextResponse.json({ ok: true });
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
  addAudit({ actor: `user:${user.id}`, action: "apikey.issue", target: workspaceId, meta: { keyId: apiKey.id } });
  // apiKey は公開用に絞って返す（keyHashは出さない）。raw は発行直後のみ表示する生の鍵。
  return NextResponse.json({ apiKey: toPublic(apiKey), raw });
}

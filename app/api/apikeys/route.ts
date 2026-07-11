// ============================================================================
// このファイルは、外部サービス連携などで使う「APIキー」を扱う窓口です。
// APIキー = 合言葉のような認証用の鍵。プログラム同士が「私はこのユーザーです」と
//          名乗るための、長いパスワードのような文字列だと考えてください。
//
// 用意されている入口（HTTPメソッドごとに関数が分かれています）：
//  - GET    /api/apikeys?workspaceId=... : そのワークスペース（作業場）のAPIキー一覧を返す
//  - POST   /api/apikeys                 : 新しいAPIキーを発行する
//  - DELETE /api/apikeys                 : 既存のAPIキーを失効（無効化）する
// ============================================================================

// NextResponse = サーバーからの応答（レスポンス＝応答）を作る道具
import { NextResponse } from "next/server";
// getCurrentUser = 今アクセスしている人が誰か（ログイン済みの本人）を取得する
import { getCurrentUser } from "@/lib/auth/session";
// ワークスペース取得・キー一覧・キー1件取得・キー失効・監査ログ記録などの部品
import { getWorkspace, listApiKeys, getApiKey, revokeApiKey, addAudit } from "@/lib/data/store";
// issueApiKey = 新しいAPIキーを発行する部品
import { issueApiKey } from "@/lib/auth/apikey";
// ApiKey = APIキー1件のデータの形（型）
import type { ApiKey } from "@/lib/domain/types";

// APIキーの情報のうち、画面へ返してよい「公開用の項目」だけに絞る関数。
// ★keyHash（鍵を元に戻せない形に変換した値）は、盗まれると危ないので絶対にクライアント（利用者の画面）へ出さない。
function toPublic(k: ApiKey) {
  return {
    id: k.id,                 // キーを区別するためのID
    name: k.name,             // 利用者が付けた分かりやすい名前
    keyPreview: k.keyPreview, // 鍵の一部だけを見せた表示用（例：末尾4文字だけ など）
    createdAt: k.createdAt,   // 発行した日時
    lastUsedAt: k.lastUsedAt, // 最後に使われた日時
  };
}

// 【一覧取得】APIキーの一覧を返す。GET /api/apikeys?workspaceId=...
export async function GET(req: Request) {
  // ログイン確認：ログインしていなければ 401（＝認証（本人確認）が必要）を返して中止
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // URLの ?workspaceId=... の部分を読み取り、どのワークスペースの鍵一覧かを決める
  const wid = new URL(req.url).searchParams.get("workspaceId");
  // ワークスペースの指定が無ければ、空の一覧を返す
  if (!wid) return NextResponse.json({ keys: [] });
  // 所有者確認：そのワークスペースを取り出し、持ち主がログイン中の本人かを確認する
  const ws = getWorkspace(wid);
  // 存在しない、または本人のものでなければ 403（＝権限が無く禁止）を返す
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // APIキーの一覧を、公開用の項目だけに絞って（toPublicを通して）返す
  return NextResponse.json({ keys: listApiKeys(wid).map(toPublic) });
}

// 【失効】APIキーを無効にする。漏えい（外部に漏れる）した時などに使い、そのキーを使えなくする。
// DELETE /api/apikeys { keyId }  ※本文で「どのキーを消すか(keyId)」を渡す
export async function DELETE(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // リクエスト本文をJSON（データのやり取り用の書式）として読み取る。壊れていれば null にする
  const body = await req.json().catch(() => null);
  // 本文が読めなければ 400（＝リクエストが不正）を返す
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 本文から、失効させたいキーのID(keyId)を取り出す
  const { keyId } = body as { keyId: string };
  // そのIDのキーを探す
  const key = getApiKey(keyId);
  // 見つからなければ 404（＝対象が存在しない）を返す
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 所有者確認：そのキーが属するワークスペースの持ち主が本人かを確認する
  const ws = getWorkspace(key.workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // キーを失効させる（以後このキーは使えなくなる）
  revokeApiKey(keyId);
  // 監査ログに「キーを失効させた」ことを記録する
  addAudit({ actor: `user:${user.id}`, action: "apikey.revoke", target: key.workspaceId, meta: { keyId } });
  // 成功したことを ok:true で返す
  return NextResponse.json({ ok: true });
}

// 【発行】新しいAPIキーを作る。POST /api/apikeys
export async function POST(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 本文から「どのワークスペース用に・どんな名前で発行するか」を読み取る（壊れた本文は 400）
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // ワークスペースID(workspaceId)と、利用者が付ける名前(name)を取り出す
  const { workspaceId, name } = body as { workspaceId: string; name: string };
  // 所有者確認：そのワークスペースの持ち主が本人かを確認する
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // ★発行数の上限：有効なキーが20本以上あれば新規発行を断る（キー量産によるレート制限回避・肥大化を防ぐ）
  if (listApiKeys(workspaceId).length >= 20)
    return NextResponse.json({ error: "too_many_keys" }, { status: 400 });
  // 新しいAPIキーを発行する。戻り値は2つ：
  //  - apiKey : 保存・表示用のキー情報（IDや名前など）
  //  - raw    : 発行直後だけ見られる「生の鍵文字列」。★この画面を離れると二度と再表示できないので要注意
  const { apiKey, raw } = issueApiKey(workspaceId, name);
  // 監査ログに「キーを発行した」ことを記録する
  addAudit({ actor: `user:${user.id}`, action: "apikey.issue", target: workspaceId, meta: { keyId: apiKey.id } });
  // apiKey は公開用に絞って（keyHashは出さずに）返す。raw は発行直後のみ表示する生の鍵として一緒に返す。
  return NextResponse.json({ apiKey: toPublic(apiKey), raw });
}

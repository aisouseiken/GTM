// モック認証：cookie にユーザーIDを保持するだけの簡易セッション。
// 外部キー不要で動く。最終フェーズで Supabase Auth に差し替え（設計書04）。
//
// このファイルの役割：ログイン状態の管理（ログイン・ログアウト・今のログインユーザーの取得）です。
// cookie（クッキー）＝ブラウザに保存される小さなデータ。ここではユーザーIDを覚えさせておき、
// 次のアクセス時に「誰がログイン中か」を思い出すために使います。
// モック認証＝本格的な認証の代わりに使う簡易版。将来 Supabase Auth（認証サービス）に置き換え予定。

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getUser, listWorkspaces, createWorkspace } from "@/lib/data/store";
import type { User } from "@/lib/domain/types";

// cookie に保存するときの名前（キー）。この名前で保存・取得する。
const COOKIE = "gtm_session";

// 署名に使う秘密鍵。改ざん防止の要。
// ★本番(production)で AUTH_SECRET 未設定なら「起動を止める(throw)」。
//   以前は公開済みの固定値へフォールバックしていたため、その鍵で誰でも署名を偽造できた（監査で致命指摘）。
function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }
  return "gtm-dev-only-secret"; // 開発専用のフォールバック（本番では上で弾かれる）
}

// トークンの有効期限（30日）
const TOKEN_TTL_MS = 60 * 60 * 24 * 30 * 1000;

// ---- 署名付きトークンの仕組み（cookie の偽装を防ぐ）----
// 形式: "userId.発行時刻.署名"。署名は SECRET を知らないと作れないので偽装不可。
// 発行時刻を含めて署名し、検証時に期限切れを弾く（盗まれても永久には使えない）。

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

// userId から「userId.発行時刻.署名」というトークンを作る
function createToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

// トークンを検証し、正しく期限内なら userId を、無効/改ざん/期限切れなら null を返す
function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtStr, provided] = parts;
  const payload = `${userId}.${issuedAtStr}`;
  const expected = sign(payload);
  // 署名の比較はタイミング攻撃を避けるため timingSafeEqual を使う
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  // 期限切れチェック
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return null;
  return userId;
}

// 今ログインしているユーザーを返す。ログインしていなければ null。
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies(); // cookie を扱う入れ物を取得
  const token = store.get(COOKIE)?.value; // 保存された署名付きトークンを読み出す
  const uid = verifyToken(token); // 署名を検証して userId を取り出す（改ざんなら null）
  if (!uid) return null; // トークンが無効なら未ログイン扱い
  return getUser(uid) ?? null; // IDからユーザー情報を探して返す
}

// セッション確立：既存ユーザーの userId を署名付き cookie に記録する（本人確認は呼び出し側で済ませる）。
// 初回はデフォルトワークスペースを用意する。
export async function establishSession(user: User): Promise<void> {
  if (listWorkspaces(user.id).length === 0) {
    createWorkspace(user.id, "マイワークスペース", "JP", "free");
  }
  const store = await cookies();
  store.set(COOKIE, createToken(user.id), { // 「userId.発行時刻.署名」を cookie に保存
    httpOnly: true, // JavaScriptから読めないようにする（盗み見・XSS対策）
    sameSite: "lax", // 別サイトからの不正な送信をある程度防ぐ設定
    secure: process.env.NODE_ENV === "production", // 本番はHTTPS通信のみ送信
    path: "/", // サイト全体で有効
    maxAge: 60 * 60 * 24 * 30, // 有効期限30日（秒数で指定）
  });
}

// ログアウト処理。保存していたセッション cookie を削除する。
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

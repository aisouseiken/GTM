// モック認証：cookie にユーザーIDを保持するだけの簡易セッション。
// 外部キー不要で動く。最終フェーズで Supabase Auth に差し替え（設計書04）。
//
// このファイルの役割：ログイン状態の管理（ログイン・ログアウト・今のログインユーザーの取得）です。
// cookie（クッキー）＝ブラウザに保存される小さなデータ。ここではユーザーIDを覚えさせておき、
// 次のアクセス時に「誰がログイン中か」を思い出すために使います。
// モック認証＝本格的な認証の代わりに使う簡易版。将来 Supabase Auth（認証サービス）に置き換え予定。

// Next.js（このアプリの土台フレームワーク）から、cookie（ブラウザ保存の小データ）を読み書きする道具を借りる。
import { cookies } from "next/headers";
// crypto（暗号の道具箱）から、署名を作る createHmac と、安全に値を比べる timingSafeEqual を借りる。
// HMAC＝秘密の鍵を使って作る「改ざん検知用の署名」。鍵を知らない人は同じ署名を作れない。
import { createHmac, timingSafeEqual } from "crypto";
// データ保管庫から、ユーザー取得・ワークスペース一覧取得・ワークスペース作成の機能を借りる。
import { getUser, listWorkspaces, createWorkspace } from "@/lib/data/store";
// ユーザーの「データの形（型）」の定義を借りる。
import type { User } from "@/lib/domain/types";

// cookie に保存するときの名前（キー）。この名前で保存・取得する。
const COOKIE = "gtm_session";

// 署名に使う秘密鍵。改ざん防止の要。
// ★本番(production)で AUTH_SECRET 未設定なら「起動を止める(throw)」。
//   以前は公開済みの固定値へフォールバックしていたため、その鍵で誰でも署名を偽造できた（監査で致命指摘）。
function getSecret(): string {
  const s = process.env.AUTH_SECRET; // 環境変数から秘密鍵を読む（外から与える設定値）
  if (s) return s; // 設定されていればそれを使う
  if (process.env.NODE_ENV === "production") {
    // 本番環境なのに秘密鍵が無い＝危険なので、エラーを投げて起動を止める（throw＝処理を中断する）
    throw new Error("AUTH_SECRET is required in production");
  }
  return "gtm-dev-only-secret"; // 開発専用のフォールバック（本番では上で弾かれる）
}

// トークンの有効期限（30日）。ミリ秒に直すため 秒×分×時×日×1000 を掛けている。
const TOKEN_TTL_MS = 60 * 60 * 24 * 30 * 1000;

// ---- 署名付きトークンの仕組み（cookie の偽装を防ぐ）----
// 形式: "userId.発行時刻.署名"。署名は SECRET を知らないと作れないので偽装不可。
// 発行時刻を含めて署名し、検証時に期限切れを弾く（盗まれても永久には使えない）。

// 渡された文字列に秘密鍵を使って署名（改ざん検知の印）を付け、URLで安全に使える形式で返す。
function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

// userId から「userId.発行時刻.署名」というトークンを作る
function createToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`; // 本体部分＝「ユーザーID.発行時刻(現在時刻)」
  return `${payload}.${sign(payload)}`; // 本体の後ろにその署名を付けて完成
}

// トークンを検証し、正しく期限内なら userId を、無効/改ざん/期限切れなら null を返す
function verifyToken(token: string | undefined): string | null {
  if (!token) return null; // そもそもトークンが無ければ未ログイン扱い
  const parts = token.split("."); // 「.」で3つの部品（ID・時刻・署名）に分ける
  if (parts.length !== 3) return null; // 3つに割れなければ壊れているので無効
  const [userId, issuedAtStr, provided] = parts; // それぞれを取り出す（provided=送られてきた署名）
  const payload = `${userId}.${issuedAtStr}`; // 署名し直すための本体部分を組み立てる
  const expected = sign(payload); // 秘密鍵で「本来あるべき正しい署名」を計算する
  // 署名の比較はタイミング攻撃を避けるため timingSafeEqual を使う
  const a = Buffer.from(provided); // 送られてきた署名をバイト列に
  const b = Buffer.from(expected); // 正しい署名をバイト列に
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null; // 一致しなければ改ざんとみなし無効
  // 期限切れチェック
  const issuedAt = Number(issuedAtStr); // 発行時刻の文字列を数値に変換
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > TOKEN_TTL_MS) return null; // 数値でない/30日超過なら無効
  return userId; // すべて通れば正当なユーザーIDを返す
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
    // このユーザーのワークスペースが1つも無ければ（＝初回ログイン）、既定の作業場を1つ作る。
    createWorkspace(user.id, "マイワークスペース", "JP", "free");
  }
  const store = await cookies(); // cookie を扱う入れ物を取得
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

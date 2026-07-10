// このファイルは「新規登録」「ログイン」「ログアウト」の処理をまとめたものです。
// ※「"use server"」= これらの関数はサーバー側で実行される（サーバーアクション）。
//   本物のパスワード認証：登録時にパスワードをハッシュ化して保存し、ログイン時に照合する。

"use server";

import { redirect } from "next/navigation";
import { establishSession, signOut } from "@/lib/auth/session";
import { createUser, getUserByEmail, listWorkspaces, addAudit } from "@/lib/data/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/ratelimit";

// フォームの結果（エラー文言を画面に返すための入れ物）
export interface AuthState {
  error?: string;
}

// メール形式のかんたんチェック
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 新規登録：メール・名前・パスワードを受け取り、パスワードをハッシュ化して保存する。
export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const agree = formData.get("agree"); // 規約同意チェック

  if (!isValidEmail(email)) return { error: "メールアドレスの形式が正しくありません。" };
  if (name.length < 1) return { error: "お名前を入力してください。" };
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" };
  if (!agree) return { error: "利用規約とプライバシーポリシーへの同意が必要です。" };
  if (!rateLimit(`signup:${email}`, 5, 60_000)) return { error: "しばらくしてからお試しください。" };

  // 既に登録済みのメールなら、登録ではなくログインへ誘導
  if (getUserByEmail(email)) return { error: "このメールアドレスは既に登録されています。ログインしてください。" };

  const user = createUser(email, name, hashPassword(password));
  await establishSession(user);
  addAudit({ actor: `user:${user.id}`, action: "signup", meta: { email } });
  const ws = listWorkspaces(user.id);
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// ログイン：メールとパスワードを照合し、正しければセッションを確立する。
export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };
  // レート制限：同じメールで1分に10回まで（総当たり抑止）
  if (!rateLimit(`login:${email}`, 10, 60_000)) return { error: "試行回数が多すぎます。しばらくしてからお試しください。" };

  const user = getUserByEmail(email);
  // ★「メールが存在するか」を推測されないよう、失敗時は常に同じ文言を返す
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  await establishSession(user);
  addAudit({ actor: `user:${user.id}`, action: "login", meta: { email } });
  const ws = listWorkspaces(user.id);
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// ログアウト：ログイン状態を消して、トップページへ戻す。
export async function logoutAction() {
  await signOut();
  redirect("/");
}

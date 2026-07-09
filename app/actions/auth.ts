// このファイルは「ログイン」と「ログアウト」の処理をまとめたものです。
// ※「"use server"」= これらの関数はサーバー側で実行される（サーバーアクション）。
//   フォーム送信を受け取り、ログイン状態を作ったり消したりしてから、適切なページへ移動させます。

"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/data/store";
import { rateLimit } from "@/lib/ratelimit";

// ログイン処理。フォームから送られたメールアドレスと名前を受け取る。
export async function loginAction(formData: FormData) {
  // 入力値を取り出し、前後の余分な空白を取り除く。
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!email) return; // メールが空なら何もしない。
  // レート制限：同じメールで1分に10回まで（総当たりログインを抑止）
  if (!rateLimit(`login:${email.toLowerCase()}`, 10, 60_000)) return;
  const user = await signIn(email, name); // ログイン状態を作る。
  const ws = listWorkspaces(user.id); // そのユーザーの作業スペース一覧を取得。
  // 作業スペースがあれば最初のものへ、無ければアプリ入口へ移動させる。
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// ログアウト処理。ログイン状態を消して、トップページへ戻す。
export async function logoutAction() {
  await signOut();
  redirect("/");
}

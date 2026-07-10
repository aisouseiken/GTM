// この画面はアプリの入口（/app）です。画面そのものは表示せず、行き先を振り分けるだけの「交通整理」役です。
// ログイン確認をして、作業スペース（ワークスペース）が無ければ1つ自動で作り、
// 最初の作業スペースの画面へ自動的に移動させます。
// ※このファイルはサーバー側で動く部品。

// redirect = 別のページへ強制的に移動させる道具（取り込み）。
import { redirect } from "next/navigation";
// getCurrentUser = 今ログインしている人を調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";
// listWorkspaces = 作業スペース一覧を取得、createWorkspace = 作業スペースを新規作成する道具（取り込み）。
import { listWorkspaces, createWorkspace } from "@/lib/data/store";

// async = 中でログイン確認など「あとで結果が返る処理」を待つため。
export default async function AppIndex() {
  const user = await getCurrentUser(); // 今ログインしている人を調べる（結果が返るまで待つ）。
  if (!user) redirect("/login"); // 未ログインならログイン画面へ。
  let ws = listWorkspaces(user.id); // このユーザーの作業スペース一覧を取得。
  // 1つも無ければ、初回用に作業スペースを自動作成する。
  if (ws.length === 0) {
    // 引数の意味：持ち主=user.id / 名前=「マイワークスペース」 / 対象市場=JP（日本） / 料金プラン=free（無料）。
    createWorkspace(user.id, "マイワークスペース", "JP", "free");
    ws = listWorkspaces(user.id); // 作った直後にもう一度一覧を取り直す（新しいものを含めるため）。
  }
  redirect(`/app/w/${ws[0].id}`); // 最初の作業スペースの画面へ移動（[0]＝一覧の1番目）。
}

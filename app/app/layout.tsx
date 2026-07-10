// このファイルはログイン後の「アプリ画面」全体の土台（レイアウト）です。
// アプリ内のどのページを開いても、まずここでログイン状態を確認します。
// ※このファイルはサーバー側で動く部品（表示前にログイン確認を行うため）。

// redirect = 別のページへ強制的に移動させる道具（取り込み）。
import { redirect } from "next/navigation";
// getCurrentUser = 今ログインしている人が誰かを調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";

// children = この土台の中に差し込まれる各アプリページの中身。
// async = 中で「あとで結果が返る処理（ログイン確認）」を待つため。
export default async function AppLayout({
  children, // ここに各アプリページの中身が入る。
}: {
  children: React.ReactNode; // 画面に表示できるもの全般の型。
}) {
  const user = await getCurrentUser(); // 今ログインしている人を調べる（await＝結果が返るのを待つ）。
  if (!user) redirect("/login"); // 未ログインならログイン画面へ追い返す（この先は表示しない）。
  // ログイン済みなら、画面いっぱいの背景クリームの枠の中に各ページ（children）を表示する。
  return <div className="min-h-screen bg-cream">{children}</div>;
}

// この画面は、1つの作業スペース（ワークスペース）のメイン画面です。
// URLの [id] 部分でどの作業スペースかを判別し、その中身（顧客検索の作業画面）を表示します。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

// notFound = 「見つかりませんページ」を表示する道具（取り込み）。
import { notFound } from "next/navigation";
// getCurrentUser = 今ログインしている人を調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";
// getWorkspace = 作業スペース情報、getWallet = クレジット残高（財布）情報を取り出す道具（取り込み）。
import { getWorkspace, getWallet } from "@/lib/data/store";
// AppShell = サイドバーやヘッダーなど共通の外枠の部品（取り込み）。
import { AppShell } from "@/components/AppShell";
// Workspace = 顧客検索を行うメイン作業画面の部品（取り込み）。
import { Workspace } from "@/components/Workspace";

// params には、URL の [id]（開こうとしている作業スペースのID）が入っている。
// Promise = 「あとで値が返ってくる」という意味（await で受け取る）。
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す（結果を待って受け取る）。
  const user = await getCurrentUser(); // ログイン中のユーザー。
  const ws = getWorkspace(id); // そのIDの作業スペース情報。
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示（他人の画面は見せない）。
  // ||＝どれか1つでも当てはまれば、!＝〜でない、!==＝等しくない、の意味。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高などの情報。

  // AppShell = サイドバーやヘッダーなど共通の外枠。その中に検索作業画面（Workspace）を差し込む。
  return (
    // workspace＝表示する作業スペース、balance＝残高（無ければ0）、active＝今開いている場所は「検索」だと伝える。
    // ?? 0 ＝ 残高が無い（空）のときは代わりに0を使う、という意味。
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="search">
      {/* 検索作業画面。どの作業スペースの検索かを workspaceId で伝える */}
      <Workspace workspaceId={ws.id} />
    </AppShell>
  );
}

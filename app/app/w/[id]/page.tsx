// この画面は、1つの作業スペース（ワークスペース）のメイン画面です。
// URLの [id] 部分でどの作業スペースかを判別し、その中身（顧客検索の作業画面）を表示します。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { Workspace } from "@/components/Workspace";

// params には、URL の [id]（開こうとしている作業スペースのID）が入っている。
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す。
  const user = await getCurrentUser(); // ログイン中のユーザー。
  const ws = getWorkspace(id); // そのIDの作業スペース情報。
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示（他人の画面は見せない）。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高などの情報。

  // AppShell = サイドバーやヘッダーなど共通の外枠。その中に検索作業画面（Workspace）を差し込む。
  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="search">
      <Workspace workspaceId={ws.id} />
    </AppShell>
  );
}

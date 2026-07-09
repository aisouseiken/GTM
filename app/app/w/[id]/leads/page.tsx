// この画面は「保存済みリスト」ページです。過去の検索で保存した営業リード（見込み客）のリストを一覧表示します。
// ※リード = 営業の見込み客のこと。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet, listLists, listLeadsByWorkspace } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す。
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高（画面上部の表示に使う）。
  const lists = listLists(ws.id); // 保存済みリストの一覧。
  const totalLeads = listLeadsByWorkspace(ws.id).length; // これまでに取得したリードの総数。

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/leads">
      <div className="scroll-thin h-full overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <h1 className="font-serif-display text-3xl text-ink">保存済みリスト</h1>
            <Link
              href={`/app/w/${ws.id}`}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
            >
              + 新しい検索
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted">
            これまでに取得したリード：{totalLeads.toLocaleString()} 件
          </p>

          {/* リストが1件も無いときは案内文を、あるときはカードで一覧表示する */}
          {lists.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-paper p-12 text-center">
              <div className="font-serif-display text-lg text-ink">まだリストがありません</div>
              <p className="mt-2 text-sm text-muted">
                検索結果を「リストに保存」すると、ここに表示されます。
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* 保存済みリストを1件ずつカードにして並べる（クリックで詳細ページへ） */}
              {lists.map((l) => (
                <Link
                  key={l.id}
                  href={`/app/w/${ws.id}/lists/${l.id}`}
                  className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-brand/50"
                >
                  <div className="font-medium text-ink">{l.name}</div>
                  <div className="mt-1 text-sm text-muted">{l.leadIds.length} 件のリード</div>
                  <div className="mt-3 text-xs text-muted">
                    {new Date(l.createdAt).toLocaleString("ja-JP")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

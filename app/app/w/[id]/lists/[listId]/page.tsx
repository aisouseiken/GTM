// この画面は「保存したリストの中身」を表示する詳細ページです。
// リストに入っているリード（見込み客）を1件ずつ表にして見られます。
// ※以前は保存リストのカードを押しても開けず行き止まりだったため、この詳細を追加しました。

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet, getList, getLead } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { FitBar, CompanyAvatar } from "@/components/FitBar";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string; listId: string }>;
}) {
  const { id, listId } = await params; // URLから作業スペースIDとリストIDを取り出す
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  // 未ログイン・別人・存在しないなら「見つかりません」
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id);
  const list = getList(listId);
  // リストが存在しない、または別のワークスペースのものなら弾く（他人のデータを見せない）
  if (!list || list.workspaceId !== ws.id) notFound();

  // リストに入っているリードIDから、実際のリード情報を取り出す（見つからないものは除く）
  const leads = list.leadIds.map((lid) => getLead(lid)).filter((l) => l != null);

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/leads">
      <div className="scroll-thin h-full overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          {/* 戻るリンク */}
          <Link href={`/app/w/${ws.id}/leads`} className="text-sm text-brand hover:underline">
            ← 保存リスト一覧へ戻る
          </Link>
          <h1 className="mt-2 font-serif-display text-3xl text-ink">{list.name}</h1>
          <p className="mt-1 text-sm text-muted">{leads.length} 件のリード</p>

          {/* リードの一覧表 */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-cream-100/60 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Fit</th>
                  <th className="px-4 py-2 font-medium">会社</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">メール</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">電話</th>
                  <th className="px-4 py-2 font-medium">シグナル</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l!.id} className="border-t border-line/70">
                    <td className="px-4 py-2">
                      <FitBar score={l!.fitScore} />
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <CompanyAvatar name={l!.companyName} />
                        <span className="text-ink">{l!.companyName}</span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-2 font-mono text-[12px] text-ink-soft sm:table-cell">
                      {l!.email ?? "—"}
                    </td>
                    <td className="hidden px-4 py-2 text-ink-soft md:table-cell">{l!.phone ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-soft">{l!.buyingSignal ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

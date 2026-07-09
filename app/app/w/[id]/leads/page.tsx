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
  const { id } = await params;
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id);
  const lists = listLists(ws.id);
  const totalLeads = listLeadsByWorkspace(ws.id).length;

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

          {lists.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-paper p-12 text-center">
              <div className="font-serif-display text-lg text-ink">まだリストがありません</div>
              <p className="mt-2 text-sm text-muted">
                検索結果を「リストに保存」すると、ここに表示されます。
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {lists.map((l) => (
                <div key={l.id} className="rounded-2xl border border-line bg-paper p-5">
                  <div className="font-medium text-ink">{l.name}</div>
                  <div className="mt-1 text-sm text-muted">{l.leadIds.length} 件のリード</div>
                  <div className="mt-3 text-xs text-muted">
                    {new Date(l.createdAt).toLocaleString("ja-JP")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

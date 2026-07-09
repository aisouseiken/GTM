import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet, listTransactions } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { PlanChangeButton, ManageBillingButton } from "@/components/BillingActions";
import { PLAN_INFO } from "@/lib/domain/types";
import { formatJpy } from "@/lib/config";

const PLAN_ORDER = ["free", "starter", "pro", "scale"] as const;

export default async function BillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id);
  const tx = listTransactions(ws.id).slice(0, 20);

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/billing">
      <div className="scroll-thin h-full overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-serif-display text-3xl text-ink">プランと課金</h1>

          {/* balance */}
          <div className="mt-6 flex items-center gap-6 rounded-2xl border border-line bg-paper p-6">
            <div>
              <div className="text-sm text-muted">現在のクレジット残高</div>
              <div className="mt-1 text-4xl font-semibold tabular-nums text-ink">
                {(wallet?.balance ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="h-12 w-px bg-line" />
            <div>
              <div className="text-sm text-muted">現在のプラン</div>
              <div className="mt-1 text-2xl font-medium text-ink">{PLAN_INFO[ws.plan].label}</div>
            </div>
            <div className="ml-auto">
              <ManageBillingButton workspaceId={ws.id} />
            </div>
          </div>

          {/* plans */}
          <h2 className="mt-10 font-serif-display text-xl text-ink">プランを選ぶ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {PLAN_ORDER.map((p) => {
              const info = PLAN_INFO[p];
              const current = ws.plan === p;
              return (
                <div
                  key={p}
                  className={`rounded-2xl border bg-paper p-5 ${
                    p === "pro" ? "border-brand" : "border-line"
                  }`}
                >
                  <div className="font-serif-display text-lg text-ink">{info.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-ink">
                    {info.priceJpy === 0 ? "¥0" : formatJpy(info.priceJpy)}
                    <span className="text-xs font-normal text-muted">/月</span>
                  </div>
                  <div className="mt-2 text-sm text-ink-soft">
                    {info.monthlyCredits.toLocaleString()} クレジット/月
                  </div>
                  <PlanChangeButton
                    workspaceId={ws.id}
                    plan={p}
                    current={current}
                    highlight={p === "pro"}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            ※ 決済（Stripe）は最終フェーズで有効化されます。現在はデモ用の残高で動作しています。
          </p>

          {/* history */}
          <h2 className="mt-10 font-serif-display text-xl text-ink">消費・付与履歴</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-100/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">日時</th>
                  <th className="px-4 py-2 font-medium">内容</th>
                  <th className="px-4 py-2 text-right font-medium">増減</th>
                </tr>
              </thead>
              <tbody>
                {tx.map((t) => (
                  <tr key={t.id} className="border-t border-line/70">
                    <td className="px-4 py-2 text-muted">
                      {new Date(t.createdAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-4 py-2 text-ink">{t.note}</td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${
                        t.delta >= 0 ? "text-[#3f7a43]" : "text-ink-soft"
                      }`}
                    >
                      {t.delta >= 0 ? "+" : ""}
                      {t.delta.toLocaleString()}
                    </td>
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

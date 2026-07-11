// この画面は「プランと課金」ページです。現在のクレジット残高と契約プラン、
// 選べるプラン一覧、そしてクレジットの消費・付与の履歴を表示します。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet, listTransactions } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { PlanChangeButton, ManageBillingButton } from "@/components/BillingActions";
import { PLAN_INFO } from "@/lib/domain/types";
import { formatJpy } from "@/lib/config";

// プランを表示する順番。
const PLAN_ORDER = ["free", "starter", "pro", "scale"] as const;

export default async function BillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す。
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高の情報。
  const tx = listTransactions(ws.id).slice(0, 20); // 直近20件の取引履歴。

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/billing">
      <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-serif-display text-3xl text-ink">プランと課金</h1>

          {/* balance：現在のクレジット残高・契約プランと、支払い方法の管理ボタン */}
          {/* スマホは縦積み(flex-col)、PC(sm以上)は横並び。区切りの縦線はスマホでは隠す */}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6 sm:flex-row sm:items-center sm:gap-6">
            <div>
              <div className="text-sm text-muted">現在のクレジット残高</div>
              <div className="mt-1 text-4xl font-semibold tabular-nums text-ink">
                {(wallet?.balance ?? 0).toLocaleString()}
              </div>
            </div>
            {/* 区切りの縦線（スマホでは非表示） */}
            <div className="hidden h-12 w-px bg-line sm:block" />
            <div>
              <div className="text-sm text-muted">現在のプラン</div>
              <div className="mt-1 text-2xl font-medium text-ink">{PLAN_INFO[ws.plan].label}</div>
            </div>
            {/* 管理ボタン（PCでは右端に寄せる。スマホでは下に回り込む） */}
            <div className="sm:ml-auto">
              <ManageBillingButton workspaceId={ws.id} />
            </div>
          </div>

          {/* plans：選べるプランの一覧。それぞれ料金と変更ボタンを表示 */}
          <h2 className="mt-10 font-serif-display text-xl text-ink">プランを選ぶ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {/* プランの一覧を1つずつ取り出して、それぞれをカード（枠）として並べて表示 */}
            {PLAN_ORDER.map((p) => {
              const info = PLAN_INFO[p]; // そのプランの情報（名前・料金・毎月のクレジット数）。
              const current = ws.plan === p; // 今契約中のプランかどうか。
              return (
                <div
                  key={p}
                  className={`rounded-2xl border bg-paper p-5 ${
                    p === "pro" ? "border-brand" : "border-line"
                  }`}
                >
                  {/* プラン名（例：Free / Starter / Pro / Scale）を表示 */}
                  <div className="font-serif-display text-lg text-ink">{info.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-ink">
                    {/* 料金が0円なら「¥0」、それ以外は円表示に整形して表示 */}
                    {info.priceJpy === 0 ? "¥0" : formatJpy(info.priceJpy)}
                    <span className="text-xs font-normal text-muted">/月</span>
                  </div>
                  <div className="mt-2 text-sm text-ink-soft">
                    {/* 毎月もらえるクレジット数を、3桁区切り（例：1,000）で表示 */}
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

          {/* history：クレジットの消費（マイナス）と付与（プラス）の履歴一覧 */}
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
                {/* 取引履歴を1件ずつ行にして表示（増えたときは緑＋、減ったときは通常色） */}
                {tx.map((t) => (
                  <tr key={t.id} className="border-t border-line/70">
                    <td className="px-4 py-2 text-muted">
                      {new Date(t.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
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

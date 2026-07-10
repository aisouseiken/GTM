// この画面は「保存したリストの中身」を表示する詳細ページです。
// リストに入っているリード（見込み客）を1件ずつ表にして見られます。
// ※以前は保存リストのカードを押しても開けず行き止まりだったため、この詳細を追加しました。

// Link = ページ間を移動するリンクを作る道具（取り込み）。
import Link from "next/link";
// notFound = 「見つかりませんページ」を表示する道具（取り込み）。
import { notFound } from "next/navigation";
// getCurrentUser = 今ログインしている人を調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";
// getWorkspace=作業スペース, getWallet=残高, getList=リスト1件, getLead=リード1件を取り出す道具（取り込み）。
import { getWorkspace, getWallet, getList, getLead } from "@/lib/data/store";
// AppShell = 共通の外枠の部品（取り込み）。
import { AppShell } from "@/components/AppShell";
// FitBar=相性度合いを棒グラフで見せる部品, CompanyAvatar=会社の頭文字アイコンを出す部品（取り込み）。
import { FitBar, CompanyAvatar } from "@/components/FitBar";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string; listId: string }>; // URLの[id]（作業スペース）と[listId]（リスト）があとで届く型。
}) {
  const { id, listId } = await params; // URLから作業スペースIDとリストIDを取り出す
  const user = await getCurrentUser(); // 今ログインしている人。
  const ws = getWorkspace(id); // そのIDの作業スペース情報。
  // 未ログイン・別人・存在しないなら「見つかりません」
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高（画面上部の表示に使う）。
  const list = getList(listId); // 開こうとしているリスト1件の情報。
  // リストが存在しない、または別のワークスペースのものなら弾く（他人のデータを見せない）
  if (!list || list.workspaceId !== ws.id) notFound();

  // リストに入っているリードIDから、実際のリード情報を取り出す（見つからないものは除く）
  // .map＝IDを1件ずつ実物のリード情報に置き換え、.filter(l != null)＝中身が空のものを取り除く。
  const leads = list.leadIds.map((lid) => getLead(lid)).filter((l) => l != null);

  return (
    // 共通の外枠。今開いているのは「リスト（leads）」画面だと伝える。
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/leads">
      {/* 縦にはみ出したらスクロールできる本文エリア（周囲に余白） */}
      <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-8">
        {/* 中身を中央寄せし、読みやすい横幅までに制限 */}
        <div className="mx-auto max-w-4xl">
          {/* 戻るリンク：押すと保存リストの一覧ページへ戻る */}
          <Link href={`/app/w/${ws.id}/leads`} className="text-sm text-brand hover:underline">
            ← 保存リスト一覧へ戻る
          </Link>
          {/* このリストの名前を大見出しで表示 */}
          <h1 className="mt-2 font-serif-display text-3xl text-ink">{list.name}</h1>
          {/* このリストに入っているリードの件数（leads.length＝件数） */}
          <p className="mt-1 text-sm text-muted">{leads.length} 件のリード</p>

          {/* リードの一覧表 */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-paper">
            {/* <table>＝表。w-full＝横幅いっぱい、text-left＝左そろえ */}
            <table className="w-full text-left text-[13px]">
              {/* <thead>＝表の見出し行（各列が何かを示す） */}
              <thead className="bg-cream-100/60 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {/* Fit＝この見込み客が理想像とどれだけ合うか（相性度） */}
                  <th className="px-4 py-2 font-medium">Fit</th>
                  {/* 会社名の列 */}
                  <th className="px-4 py-2 font-medium">会社</th>
                  {/* メール列。hidden … sm:table-cell＝スマホでは隠し、少し広い画面から表示 */}
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">メール</th>
                  {/* 電話列。md:table-cell＝さらに広い画面から表示 */}
                  <th className="hidden px-4 py-2 font-medium md:table-cell">電話</th>
                  {/* シグナル＝今買いそうな兆候（例：採用中・資金調達など） */}
                  <th className="px-4 py-2 font-medium">シグナル</th>
                </tr>
              </thead>
              {/* <tbody>＝表の中身（実際のデータが並ぶ部分） */}
              <tbody>
                {/* リードを1件ずつ表の行にして並べる（l! ＝ この値は空でないと明示する印） */}
                {leads.map((l) => (
                  <tr key={l!.id} className="border-t border-line/70">
                    {/* 1列目：相性度を棒グラフで表示 */}
                    <td className="px-4 py-2">
                      <FitBar score={l!.fitScore} />
                    </td>
                    {/* 2列目：会社の頭文字アイコンと会社名を横並びで表示 */}
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <CompanyAvatar name={l!.companyName} />
                        <span className="text-ink">{l!.companyName}</span>
                      </span>
                    </td>
                    {/* 3列目：メール。無ければ「—」を表示（?? "—" ＝ 空なら代わりに「—」） */}
                    <td className="hidden px-4 py-2 font-mono text-[12px] text-ink-soft sm:table-cell">
                      {l!.email ?? "—"}
                    </td>
                    {/* 4列目：電話。無ければ「—」 */}
                    <td className="hidden px-4 py-2 text-ink-soft md:table-cell">{l!.phone ?? "—"}</td>
                    {/* 5列目：買いそうな兆候（シグナル）。無ければ「—」 */}
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

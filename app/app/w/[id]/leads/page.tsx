// この画面は「保存済みリスト」ページです。過去の検索で保存した営業リード（見込み客）のリストを一覧表示します。
// ※リード = 営業の見込み客のこと。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

// Link = ページ間を移動するリンク（クリックできる文字）を作る道具（取り込み）。
import Link from "next/link";
// notFound = 「見つかりませんページ」を表示する道具（取り込み）。
import { notFound } from "next/navigation";
// getCurrentUser = 今ログインしている人を調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";
// getWorkspace=作業スペース, getWallet=残高, listLists=保存リスト一覧, listLeadsByWorkspace=このスペースの全リードを取り出す道具（取り込み）。
import { getWorkspace, getWallet, listLists, listLeadsByWorkspace } from "@/lib/data/store";
// AppShell = 共通の外枠の部品（取り込み）。
import { AppShell } from "@/components/AppShell";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ id: string }>; // URLの[id]（作業スペースID）があとで届く型。
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す。
  const user = await getCurrentUser(); // 今ログインしている人。
  const ws = getWorkspace(id); // そのIDの作業スペース情報。
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高（画面上部の表示に使う）。
  const lists = listLists(ws.id); // 保存済みリストの一覧。
  const totalLeads = listLeadsByWorkspace(ws.id).length; // これまでに取得したリードの総数（.length＝件数）。

  return (
    // 共通の外枠。今開いているのは「リスト（leads）」画面だと伝える。
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/leads">
      {/* 縦にはみ出したらスクロールできる本文エリア（周囲に余白） */}
      <div className="scroll-thin h-full overflow-y-auto p-8">
        {/* 中身を中央寄せし、読みやすい横幅までに制限 */}
        <div className="mx-auto max-w-4xl">
          {/* 見出しと「新しい検索」ボタンを、左右の端に振り分けて横並びにする */}
          <div className="flex items-center justify-between">
            {/* ページの大見出し */}
            <h1 className="font-serif-display text-3xl text-ink">保存済みリスト</h1>
            {/* 押すと検索画面（作業スペースのトップ）へ移動するボタン風リンク */}
            <Link
              href={`/app/w/${ws.id}`} // 移動先＝この作業スペースの検索画面。
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
            >
              + 新しい検索
            </Link>
          </div>
          {/* これまでの合計リード件数を表示。toLocaleString＝3桁ごとにカンマ区切り（例：1,234） */}
          <p className="mt-2 text-sm text-muted">
            これまでに取得したリード：{totalLeads.toLocaleString()} 件
          </p>

          {/* リストが1件も無いときは案内文を、あるときはカードで一覧表示する（? 〜 : 〜 ＝ もし〜なら前、そうでなければ後ろ） */}
          {lists.length === 0 ? (
            // 【リストが0件のとき】点線枠の中に空っぽの案内を表示する。
            <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-paper p-12 text-center">
              <div className="font-serif-display text-lg text-ink">まだリストがありません</div>
              {/* どうすればここに表示されるかの案内 */}
              <p className="mt-2 text-sm text-muted">
                検索結果を「リストに保存」すると、ここに表示されます。
              </p>
            </div>
          ) : (
            // 【リストが1件以上あるとき】カードを格子状（スマホは1列、広い画面は2列）に並べる。
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* 保存済みリストを1件ずつカードにして並べる（クリックで詳細ページへ）。.map＝1件ずつ処理して並べる */}
              {lists.map((l) => (
                // カード全体がクリック可能なリンク。押すとそのリストの詳細ページへ移動。
                <Link
                  key={l.id} // 各カードを見分けるための目印（Reactが並び替えを正しく扱うために必要）。
                  href={`/app/w/${ws.id}/lists/${l.id}`} // 移動先＝このリストの詳細ページ。
                  className="rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-brand/50"
                >
                  {/* リストの名前 */}
                  <div className="font-medium text-ink">{l.name}</div>
                  {/* このリストに入っているリードの件数（leadIds.length＝入っているIDの個数） */}
                  <div className="mt-1 text-sm text-muted">{l.leadIds.length} 件のリード</div>
                  {/* 作成日時を日本の表記（年月日・時刻）で表示 */}
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

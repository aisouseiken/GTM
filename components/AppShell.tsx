/**
 * AppShell（アプリ全体の共通の枠）
 * この部品は、ログイン後のアプリ画面の「外枠」を作ります。左端に画面切り替え用の縦メニュー、
 * 上部にワークスペース名やクレジット残高を表示するヘッダーを置き、
 * その中央（children）に各ページの中身をはめ込みます。すべての画面で共通のガワです。
 */

import Link from "next/link"; // ページ間を移動するためのリンク部品（Next.js）
import { Logo } from "./Logo"; // 自作のロゴ部品（左上や上部ヘッダーに表示）
import { logoutAction } from "@/app/actions/auth"; // ログアウト処理（サーバー側で実行される）
import type { Workspace } from "@/lib/domain/types"; // ワークスペース情報の「型（決まった形）」の定義

// 左端の縦メニュー（レール）の項目一覧。href=リンク先 / label=名前 / icon=アイコンの図形データ
const RAIL = [
  { href: "", label: "検索", icon: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" },
  { href: "/leads", label: "リスト", icon: "M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h10v2H4v-2Z" },
  { href: "/api-keys", label: "API", icon: "M7 14a5 5 0 1 1 4.9-6H21v4h-2v3h-3v-3h-1.1A5 5 0 0 1 7 14Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  { href: "/billing", label: "課金", icon: "M3 6h18v12H3V6Zm2 2v2h14V8H5Zm0 4v4h14v-4H5Z" },
];

// workspace=対象のワークスペース情報 / balance=クレジット残高 / active=今開いているメニュー / children=中央に表示する各ページの中身
export function AppShell({
  workspace,
  balance,
  active = "",
  children,
}: {
  workspace: Workspace;
  balance: number;
  active?: string;
  children: React.ReactNode;
}) {
  const base = `/app/w/${workspace.id}`; // 各リンクの共通の先頭部分（このワークスペース用のURL）
  return (
    // 画面全体を横並び（左メニュー＋右本体）にする一番外側の枠。高さは画面いっぱい。
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* left rail（左端の縦メニュー） */}
      <aside className="flex w-14 flex-col items-center gap-1 border-r border-line bg-cream-100/60 py-3">
        {/* 一番上のロゴマーク。クリックするとアプリのトップへ戻る */}
        <div className="mb-2">
          <Link href="/app" className="inline-flex h-8 w-8 items-center justify-center">
            {/* ロゴ図形（4枚の三角形を組み合わせた折り紙風マーク）をSVGで描く */}
            <svg viewBox="0 0 32 32" className="h-7 w-7">
              <path d="M16 3 L29 16 L16 12 Z" fill="#ff2e93" />
              <path d="M16 3 L3 16 L16 12 Z" fill="#ff77b8" />
              <path d="M16 12 L29 16 L16 29 Z" fill="#ff2e93" opacity="0.85" />
              <path d="M16 12 L3 16 L16 29 Z" fill="#ffa6cf" />
            </svg>
          </Link>
        </div>
        {/* メニュー項目の一覧を1つずつ取り出し、それぞれをボタンとして並べる */}
        {RAIL.map((r) => {
          // この項目が今開いている画面かどうか（href が空なら「検索」画面とみなす）
          const isActive = active === (r.href || "search");
          return (
            // メニュー1個ぶんのリンク。押すとその画面へ移動する。
            <Link
              key={r.label} // 各項目を見分けるための目印。
              href={base + r.href} // 飛び先URL（共通の先頭＋各項目のパス）。
              title={r.label} // マウスを乗せたときに出る説明文。
              // 今開いている画面なら白く目立たせ、そうでなければ控えめ色にする。
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive ? "bg-paper text-ink shadow-sm" : "text-muted hover:bg-paper/60 hover:text-ink"
              }`}
            >
              {/* この項目のアイコン図形を描く */}
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={r.icon} />
              </svg>
            </Link>
          );
        })}
        {/* 一番下に配置するログアウトボタン。押すと logoutAction が実行される */}
        <form action={logoutAction} className="mt-auto">
          <button
            title="ログアウト"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-paper/60 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7V3Zm-.6 5L6 11.4H14v1.2H6L9.4 16 8 17.4 2.6 12 8 6.6 9.4 8Z" />
            </svg>
          </button>
        </form>
      </aside>

      {/* main（メニューの右側。上部ヘッダーとページ本体） */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 上部ヘッダー: 左にロゴとワークスペース名、右にクレジット残高を表示 */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-cream/80 px-5 backdrop-blur">
          {/* ヘッダー左側：ロゴ → 区切りの「/」→ ワークスペース名 → 市場ラベル */}
          <div className="flex items-center gap-3">
            <Logo href="/app" />
            <span className="text-muted">/</span>
            <span className="text-sm text-ink">{workspace.name}</span>
            {/* この作業スペースの対象市場を示す小さな丸バッジ */}
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
              {workspace.market}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* クレジット残高の表示。クリックすると課金ページへ移動する。toLocaleString() で3桁ごとにカンマ区切り */}
            <Link
              href={base + "/billing"}
              className="flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 text-sm"
            >
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="tabular-nums font-medium text-ink">{balance.toLocaleString()}</span>
              <span className="text-muted">クレジット</span>
            </Link>
          </div>
        </header>
        {/* ページ本体。ここに各画面の中身（children）がはめ込まれて表示される */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

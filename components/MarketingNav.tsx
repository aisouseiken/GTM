// この部品は、マーケティング（宣伝用）ページの一番上に固定表示されるナビゲーションバーです。
// ロゴ、ページ内リンク（Product / Pricing など）、Sign In / Start Free ボタンを並べます。
// メニューをクリックすると、ページ内の該当セクションまで滑らかにスクロールして移動します。
// ※「"use client"」= このファイルはブラウザ側で動く部品（ユーザーの操作に反応するため）。
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

// 画面上部に並べるメニューの一覧。label は表示文字、href は飛び先（#付きはページ内リンク）。

// ラベルと飛び先のセクションが一致するように命名（Partners/Guide のズレを解消）
const NAV = [
  { label: "Product", href: "#product" }, // 動く商品デモ
  { label: "Verticals", href: "#verticals" }, // 対応業種
  { label: "特長", href: "#features" }, // 差別化ポイント
  { label: "データ検証", href: "#data" }, // 連絡先の多段検証
  { label: "Pricing", href: "#pricing" }, // 料金
];

export function MarketingNav() {
  // navRef = 実際のナビ要素を後から参照するための「目印」。
  const navRef = useRef<HTMLElement>(null);
  // menuOpen = スマホ用メニュー（ハンバーガー）が開いているかどうか。true=開いている。
  const [menuOpen, setMenuOpen] = useState(false);

  // ここが「メニューをクリックしたら該当セクションまで滑らかに移動する」処理。
  // ネイティブのクリック委譲でハッシュ先へスムーススクロール（実ブラウザで確実に動作）
  // ※「委譲」= 個々のリンクではなくナビ全体で1回だけクリックを受け取り、まとめて処理する方式。
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onClick = (e: MouseEvent) => {
      // クリックされた場所から、一番近い「#で始まるリンク」を探す。
      const target = e.target as HTMLElement;
      const a = target.closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return; // #リンク以外がクリックされたら何もしない。
      // href の先頭の「#」を取り除いて、飛び先セクションのIDを取り出す。
      const id = a.getAttribute("href")!.slice(1);
      const el = document.getElementById(id);
      if (!el) return; // その名前のセクションが無ければ何もしない。
      e.preventDefault(); // ブラウザ標準のジャンプを止めて、自前の滑らか移動を使う。
      setMenuOpen(false); // スマホメニューから押した場合は、移動と同時にメニューを閉じる。
      // URL のうしろに #id を付ける（ページは再読み込みしない）。
      history.replaceState(null, "", `#${id}`);
      // 利用者が「動きを減らす」設定にしていれば即時移動、そうでなければ滑らかに移動。
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // smooth が無効な環境（一部ブラウザ）では確実に即時移動させるフォールバック
      // ※フォールバック = うまくいかなかったときの代替手段。少し待ってもズレていたら即時移動で補正。
      window.setTimeout(() => {
        if (Math.abs(el.getBoundingClientRect().top - 80) > 12) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }, 450);
    };
    // 上で作ったクリック処理をナビに取り付ける。
    nav.addEventListener("click", onClick);
    // 部品が消えるときは取り付けたクリック処理を外す（後片付け）。
    return () => nav.removeEventListener("click", onClick);
  }, []);

  // ここから下が実際に画面に表示される見た目（HTML部分）。
  // sticky top-0 = スクロールしても上部に貼り付いたまま表示される。
  return (
    // ref をヘッダー全体に付け、内側のPC用メニューとスマホ用メニュー両方のリンクを
    // 1か所でまとめてスムーススクロール処理する（委譲）。
    <header ref={navRef} className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          {/* 左側：ロゴとページ内メニュー（メニューは画面が広いときだけ表示） */}
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="cursor-pointer text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        {/* 右側：ログインと新規登録のボタン（狭い画面ではハンバーガーボタンも表示） */}
        <div className="flex items-center gap-2">
          {/* Sign In は狭い画面では隠す（メニュー内に入れる）。Start Free は常に表示 */}
          <Link
            href="/login"
            className="hidden rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-100 sm:inline-block"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Start Free
          </Link>
          {/* ハンバーガーボタン：狭い画面(md未満)だけ表示。押すとスマホ用メニューを開閉する */}
          <button
            type="button"
            aria-label="メニュー"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-paper text-ink md:hidden"
          >
            {/* 開いているときは×、閉じているときは三本線のアイコンを描く */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              {menuOpen ? (
                <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z" />
              ) : (
                <path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* スマホ用のドロップダウンメニュー：md未満かつ menuOpen のときだけ表示する */}
      {/* スクロール処理はヘッダー全体(navRef)に付けた委譲がこの中のリンクも拾うので ref は不要 */}
      {menuOpen && (
        <nav className="border-t border-line/60 bg-cream/95 px-6 py-4 md:hidden">
          {/* 各セクションへのページ内リンクを縦に並べる */}
          <div className="flex flex-col gap-1">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="rounded-lg px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                {n.label}
              </a>
            ))}
            {/* メニュー内のログインリンク（狭い画面で上部から隠した分をここで補う） */}
            <Link
              href="/login"
              className="mt-1 rounded-lg border border-line-strong bg-paper px-2 py-2 text-center text-sm font-medium text-ink"
            >
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

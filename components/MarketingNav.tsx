// この部品は、マーケティング（宣伝用）ページの一番上に固定表示されるナビゲーションバーです。
// ロゴ、ページ内リンク（Product / Pricing など）、Sign In / Start Free ボタンを並べます。
// メニューをクリックすると、ページ内の該当セクションまで滑らかにスクロールして移動します。
// ※「"use client"」= このファイルはブラウザ側で動く部品（ユーザーの操作に反応するため）。
"use client";

import { useEffect, useRef } from "react";
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
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          {/* 左側：ロゴとページ内メニュー（メニューは画面が広いときだけ表示） */}
          <Logo />
          <nav ref={navRef} className="hidden items-center gap-7 md:flex">
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
        {/* 右側：ログインと新規登録のボタン */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}

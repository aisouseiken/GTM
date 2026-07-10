// 法務系ページ（利用規約・プライバシーポリシー・特商法表記）の共通の外枠。
// 上部にロゴ、中央に本文、下部に他の法務ページへのリンクを表示します。
// ※レイアウト＝複数ページで共通して使う「額縁」のようなもの。中身だけ差し替わります。
// Link＝別ページへ移動する入口（リンク）を作る部品。
import Link from "next/link";
// Logo＝サービスのロゴ（会社のマーク）を表示する部品。
import { Logo } from "@/components/Logo";

// この関数が法務ページ共通の額縁を作る。children＝各ページの本文（差し替わる中身）。
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  // return（返す）の中身が、実際に画面に表示される見た目です。
  return (
    // 画面全体を縦一列に並べる大きな入れ物（クリーム色の背景・最低でも画面の高さいっぱい）。
    <div className="flex min-h-screen flex-col bg-cream">
      {/* header＝ページ上部の帯。ここにロゴを置く */}
      <header className="border-b border-line/60">
        {/* ロゴを左寄せで置くための、中央寄せの枠 */}
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Logo />
        </div>
      </header>
      {/* main＝ページの中心。各ページの本文（children）がここに入る */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">{children}</main>
      {/* footer＝ページ下部の帯。他の法務ページへのリンクと著作権表示を置く */}
      <footer className="border-t border-line/60 py-8">
        {/* リンク群と著作権表示を中央寄せで横に並べる枠 */}
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-xs text-muted">
          {/* 利用規約ページへのリンク */}
          <Link href="/legal/terms" className="hover:text-ink">利用規約</Link>
          {/* プライバシーポリシーページへのリンク */}
          <Link href="/legal/privacy" className="hover:text-ink">プライバシーポリシー</Link>
          {/* 特定商取引法に基づく表記ページへのリンク */}
          <Link href="/legal/tokushoho" className="hover:text-ink">特定商取引法に基づく表記</Link>
          {/* オプトアウト（連絡先の除外・データ削除申請）ページへのリンク */}
          <Link href="/optout" className="hover:text-ink">オプトアウト・データ削除</Link>
          {/* 著作権表示（© 発行年 サービス名） */}
          <span>© 2026 GTM</span>
        </div>
      </footer>
    </div>
  );
}

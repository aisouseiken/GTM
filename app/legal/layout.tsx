// 法務系ページ（利用規約・プライバシーポリシー・特商法表記）の共通の外枠。
// 上部にロゴ、中央に本文、下部に他の法務ページへのリンクを表示します。
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">{children}</main>
      <footer className="border-t border-line/60 py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-xs text-muted">
          <Link href="/legal/terms" className="hover:text-ink">利用規約</Link>
          <Link href="/legal/privacy" className="hover:text-ink">プライバシーポリシー</Link>
          <Link href="/legal/tokushoho" className="hover:text-ink">特定商取引法に基づく表記</Link>
          <Link href="/optout" className="hover:text-ink">オプトアウト・データ削除</Link>
          <span>© 2026 GTM</span>
        </div>
      </footer>
    </div>
  );
}

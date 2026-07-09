import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { AnimatedLeadSearchDemo } from "@/components/AnimatedLeadSearchDemo";
import { AnimatedPromptSection } from "@/components/AnimatedPromptSection";
import { VerticalExamples } from "@/components/VerticalExamples";
import { TypingReveal } from "@/components/TypingReveal";
import { ContactWaterfall } from "@/components/ContactWaterfall";
import { PricingCards } from "@/components/PricingCards";
import { Logo } from "@/components/Logo";

const VERTICALS = [
  ["ヘルスケア", "41"], ["Fintech", "10"], ["Eコマース", "20"], ["バイオテク", "17"],
  ["不動産テック", "14"], ["飲食", "17"], ["物流", "18"], ["製造", "9"],
  ["建設", "12"],
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="mx-auto h-full max-w-6xl bg-[radial-gradient(circle_at_50%_120%,#1a1a1a_0.5px,transparent_1px)] [background-size:14px_14px]" />
        </div>
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-10 text-center">
          <h1 className="font-serif-display text-5xl leading-[1.05] text-ink sm:text-7xl">
            理想の顧客を、<br className="hidden sm:block" />ひと言で。
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
            Apollo・ZoomInfo・Clay では見つからないリードを。
            理想の顧客像を伝えれば、GTM の AI がリアルタイムでウェブを探索し、
            検証済みの連絡先を届けます。
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              無料ではじめる
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-line-strong bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* FV内：AIプロンプト入力欄（動くタイピングデモ） */}
        <div className="relative px-6 pb-24 pt-2">
          <AnimatedPromptSection compact />
        </div>
      </section>

      {/* App demo preview（動くライブデモ） */}
      <section id="product" className="relative overflow-hidden border-t border-line/60 bg-cream-100/30">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16">
          <AnimatedLeadSearchDemo />
        </div>
      </section>

      {/* Verticals */}
      <section id="verticals" className="mx-auto max-w-6xl px-6 py-20 border-t border-line/60">
        <h2 className="font-serif-display text-3xl text-ink sm:text-4xl">
          届きにくい買い手にこそ、届く。
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          顧客像を説明できるなら、私たちは見つけられます。あらゆる業界・ニッチ・
          バイヤープロファイルを、無限の深さで。日本国内・グローバル両対応。
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {VERTICALS.map(([name, n]) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm"
            >
              <span className="text-muted">対象</span>
              <span className="font-medium text-ink">{name}</span>
              <span className="text-muted">{n}</span>
            </span>
          ))}
          <span className="inline-flex items-center rounded-full px-3 py-2 text-sm text-muted">
            and more
          </span>
        </div>

        {/* origami 風のスケルトン例カード */}
        <VerticalExamples />
      </section>

      {/* Differentiators */}
      <section id="features" className="relative scroll-mt-20 overflow-hidden border-t border-line/60 bg-cream-100/40 py-20">
        {/* もやっとしたピンクの背景（やや濃いめ・それでも上品に） */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-[16%] top-1/2 h-80 w-[560px] -translate-y-1/2 rounded-full bg-brand-soft/80 blur-[120px]" />
          <div className="absolute right-[12%] top-1/3 h-72 w-[440px] rounded-full bg-brand/12 blur-[130px]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {[
            ["リアルタイム探索", "固定DBではなく“今”のウェブを検索。鮮度100%のリードを取得します。"],
            ["多段検証 × 信頼度スコア", "メール・電話をウォーターフォール検証し、0-100の信頼度を可視化。検証成功分だけ課金。"],
            ["再現できる検索", "検索プランをスナップショット保存。同条件で再実行しても結果が再現されます。"],
          ].map(([title, body], i) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-6">
              <h3 className="font-serif-display text-xl text-ink">{title}</h3>
              {/* PCで入力しているように本文をタイピング表示 */}
              <p className="mt-2 min-h-[3.5rem] text-sm leading-relaxed text-ink-soft">
                <TypingReveal text={body} startDelay={i * 350} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact data waterfall（連絡先の多段検証） */}
      <ContactWaterfall />

      {/* Pricing preview */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center font-serif-display text-3xl text-ink sm:text-4xl">
          シンプルな料金
        </h2>
        <p className="mt-3 text-center text-ink-soft">
          会話と推論は無料。クレジットはリード取得・検証・エンリッチにのみ消費。
        </p>
        <PricingCards />
        <p className="mt-6 text-center text-xs text-muted">
          有料プランはチームメンバー無制限・席課金なし。いつでも変更・解約できます。
        </p>
      </section>

      <footer className="border-t border-line/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <Logo />
          <p className="text-xs text-muted">© 2026 GTM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

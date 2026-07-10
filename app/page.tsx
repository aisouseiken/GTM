// この画面はサービスのトップページ（宣伝用のランディングページ）です。
// 上から順に、キャッチコピー（Hero）、動くデモ、対応業種、差別化ポイント、
// 連絡先データの検証、料金、フッターの各セクションを縦に並べています。
// ※このファイルはサーバー側で表示を作る部品。ページ内の一部の動きは別の部品が担当します。

// ↓ ここから「import（外部の部品や機能を持ち込む）」の一覧です。
// Link＝別ページへ移動するための入口（リンク）を作る部品。
import Link from "next/link";
// MarketingNav＝画面上部のメニューバー（ナビゲーション＝案内表示）の部品。
import { MarketingNav } from "@/components/MarketingNav";
// AnimatedLeadSearchDemo＝検索画面が自動で動いて見えるデモ（見本）の部品。
import { AnimatedLeadSearchDemo } from "@/components/AnimatedLeadSearchDemo";
// AnimatedPromptSection＝AIへの指示文が自動でタイピングされる入力欄の部品。
import { AnimatedPromptSection } from "@/components/AnimatedPromptSection";
// VerticalExamples＝対応業種の例を並べて見せるカードの部品。
import { VerticalExamples } from "@/components/VerticalExamples";
// TypingReveal＝文章を1文字ずつ打ち込むように表示する演出の部品。
import { TypingReveal } from "@/components/TypingReveal";
// ContactWaterfall＝連絡先を段階的に検証（正しいか確認）する仕組みを見せる部品。
import { ContactWaterfall } from "@/components/ContactWaterfall";
// PricingCards＝料金プランを並べて比較させるカードの部品。
import { PricingCards } from "@/components/PricingCards";
// Logo＝サービスのロゴ（会社のマーク）を表示する部品。
import { Logo } from "@/components/Logo";

// 「対応業種」セクションで並べるタグの一覧（業種名と件数）。
// ["業種名", "件数"] という組を並べた一覧表。あとでこの一覧を順番に取り出して画面に表示します。
const VERTICALS = [
  ["ヘルスケア", "41"], ["Fintech", "10"], ["Eコマース", "20"], ["バイオテク", "17"],
  ["不動産テック", "14"], ["飲食", "17"], ["物流", "18"], ["製造", "9"],
  ["建設", "12"],
];

// トップページ全体を組み立てる部品。
// この関数（ひとまとまりの処理）が呼ばれると、画面に表示する中身を丸ごと返します。
export default function Home() {
  // return（返す）の中身が、実際に画面に表示される見た目です。
  return (
    // 画面全体を縦一列に並べる大きな入れ物（最低でも画面の高さいっぱいに広げる）。
    <div className="flex min-h-screen flex-col">
      {/* 画面最上部の固定ナビゲーションバー（メニュー） */}
      <MarketingNav />

      {/* Hero：一番目立つ導入部。大きなキャッチコピーと、登録・ログインボタンを置く */}
      <section className="relative overflow-hidden">
        {/* 背景にうっすら敷く点々模様（飾り。クリックの邪魔はしない） */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="mx-auto h-full max-w-6xl bg-[radial-gradient(circle_at_50%_120%,#1a1a1a_0.5px,transparent_1px)] [background-size:14px_14px]" />
        </div>
        {/* 中央寄せの文章エリア（キャッチコピーと説明文とボタンをまとめる） */}
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-10 text-center">
          {/* 一番大きな見出し（キャッチコピー）。スマホでは改行を隠す */}
          <h1 className="font-serif-display text-5xl leading-[1.05] text-ink sm:text-7xl">
            理想の顧客を、<br className="hidden sm:block" />ひと言で。
          </h1>
          {/* キャッチコピーの下に置く、サービス内容の説明文 */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
            Apollo・ZoomInfo・Clay では見つからないリードを。
            理想の顧客像を伝えれば、GTM の AI がリアルタイムでウェブを探索し、
            検証済みの連絡先を届けます。
          </p>
          {/* 2つのボタン（申し込みボタンとログインボタン）を横並びにする枠 */}
          <div className="mt-8 flex items-center justify-center gap-3">
            {/* 新規登録ページ（/signup）へ進む、黒い目立つボタン */}
            <Link
              href="/signup"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              無料ではじめる
            </Link>
            {/* ログインページ（/login）へ進む、白い枠付きボタン */}
            <Link
              href="/login"
              className="rounded-full border border-line-strong bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* FV内：AIプロンプト入力欄（動くタイピングデモ） */}
        {/* ※FV = ファーストビュー（最初に目に入る画面上部）。ここに入力例が自動で打たれる演出を置く */}
        {/* compact＝コンパクト（小さめ）表示にする指定 */}
        <div className="relative px-6 pb-24 pt-2">
          <AnimatedPromptSection compact />
        </div>
      </section>

      {/* デモ：実際の検索画面が動いて見えるライブデモのセクション */}
      {/* App demo preview（動くライブデモ） */}
      <section id="product" className="relative overflow-hidden border-t border-line/60 bg-cream-100/30">
        {/* 中央寄せの枠の中に、動く検索デモを置く */}
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-16">
          <AnimatedLeadSearchDemo />
        </div>
      </section>

      {/* Verticals：対応できる業種（バーティカル）を紹介するセクション */}
      {/* ※バーティカル = 特定の業界・業種のこと */}
      <section id="verticals" className="mx-auto max-w-6xl px-6 py-20 border-t border-line/60">
        {/* このセクションの見出し */}
        <h2 className="font-serif-display text-3xl text-ink sm:text-4xl">
          届きにくい買い手にこそ、届く。
        </h2>
        {/* 見出しの補足説明文 */}
        <p className="mt-3 max-w-2xl text-ink-soft">
          顧客像を説明できるなら、私たちは見つけられます。あらゆる業界・ニッチ・
          バイヤープロファイルを、無限の深さで。日本国内・グローバル両対応。
        </p>
        {/* 上で用意した業種一覧を、丸いタグにして並べる */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          {/* VERTICALS一覧を1件ずつ取り出して（name＝業種名, n＝件数）、丸いタグを作る */}
          {VERTICALS.map(([name, n]) => (
            // 1つの業種を表す丸いタグ。keyは各タグを区別するための目印（画面には出ない）
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm"
            >
              {/* タグ内の「対象」という薄い文字 */}
              <span className="text-muted">対象</span>
              {/* 業種名（濃い文字で強調） */}
              <span className="font-medium text-ink">{name}</span>
              {/* 件数（薄い文字） */}
              <span className="text-muted">{n}</span>
            </span>
          ))}
          {/* 「他にもまだある」ことを示す締めのタグ */}
          <span className="inline-flex items-center rounded-full px-3 py-2 text-sm text-muted">
            and more
          </span>
        </div>

        {/* origami 風のスケルトン例カード（対応業種の見本カードを並べる） */}
        <VerticalExamples />
      </section>

      {/* 差別化：他サービスと比べた強み（3つのポイント）を並べるセクション */}
      {/* Differentiators */}
      <section id="features" className="relative scroll-mt-20 overflow-hidden border-t border-line/60 bg-cream-100/40 py-20">
        {/* もやっとしたピンクの背景（やや濃いめ・それでも上品に） */}
        {/* aria-hidden＝読み上げソフトには無視させる指定（見た目だけの飾りのため） */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* ぼかした光の玉（背景の飾り）その1 */}
          <div className="absolute left-[16%] top-1/2 h-80 w-[560px] -translate-y-1/2 rounded-full bg-brand-soft/80 blur-[120px]" />
          {/* ぼかした光の玉（背景の飾り）その2 */}
          <div className="absolute right-[12%] top-1/3 h-72 w-[440px] rounded-full bg-brand/12 blur-[130px]" />
        </div>
        {/* 3つの強みを、[見出し, 本文] の組で用意してカードにして並べる */}
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {/* ↓ 3つの強み（見出しと本文の組）をまとめて用意する一覧 */}
          {[
            ["リアルタイム探索", "固定DBではなく“今”のウェブを検索。鮮度100%のリードを取得します。"],
            ["多段検証 × 信頼度スコア", "メール・電話をウォーターフォール検証し、0-100の信頼度を可視化。検証成功分だけ課金。"],
            ["再現できる検索", "検索プランをスナップショット保存。同条件で再実行しても結果が再現されます。"],
            // 一覧を1件ずつ取り出して（title＝見出し, body＝本文, i＝何番目か）カードを作る
          ].map(([title, body], i) => (
            // 強み1つ分のカード（枠付きの箱）
            <div key={title} className="rounded-2xl border border-line bg-paper p-6">
              {/* カードの見出し（強みの名前） */}
              <h3 className="font-serif-display text-xl text-ink">{title}</h3>
              {/* PCで入力しているように本文をタイピング表示 */}
              {/* startDelay＝表示を始めるまでの待ち時間。i×350で、カードごとに少しずつ順番に始める */}
              <p className="mt-2 min-h-[3.5rem] text-sm leading-relaxed text-ink-soft">
                <TypingReveal text={body} startDelay={i * 350} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ウォーターフォール：連絡先データを多段階で検証する仕組みを紹介するセクション */}
      {/* Contact data waterfall（連絡先の多段検証） */}
      <ContactWaterfall />

      {/* 料金：プランごとの料金と機能を比較するセクション */}
      {/* Pricing preview */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        {/* 料金セクションの見出し（中央寄せ） */}
        <h2 className="text-center font-serif-display text-3xl text-ink sm:text-4xl">
          シンプルな料金
        </h2>
        {/* 料金の考え方の説明文 */}
        <p className="mt-3 text-center text-ink-soft">
          会話と推論は無料。クレジットはリード取得・検証・エンリッチにのみ消費。
        </p>
        {/* 各プランのカードを並べる部品 */}
        <PricingCards />
        {/* カードの下に置く補足の注意書き */}
        <p className="mt-6 text-center text-xs text-muted">
          有料プランはチームメンバー無制限・席課金なし。いつでも変更・解約できます。
        </p>
      </section>

      {/* footer：ページ最下部。ロゴ・法務リンク・著作権表示を置く */}
      <footer className="border-t border-line/60 py-10">
        {/* ロゴとリンク群を、左右（スマホでは上下）に振り分ける枠 */}
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          {/* サービスのロゴ */}
          <Logo />
          {/* 各種の法務ページなどへのリンクと著作権表示をまとめた枠 */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            {/* 利用規約ページへのリンク */}
            <Link href="/legal/terms" className="hover:text-ink">利用規約</Link>
            {/* プライバシーポリシーページへのリンク */}
            <Link href="/legal/privacy" className="hover:text-ink">プライバシーポリシー</Link>
            {/* 特定商取引法に基づく表記ページへのリンク */}
            <Link href="/legal/tokushoho" className="hover:text-ink">特定商取引法に基づく表記</Link>
            {/* オプトアウト（連絡先の除外申請）ページへのリンク */}
            <Link href="/optout" className="hover:text-ink">オプトアウト</Link>
            {/* 著作権表示（© 発行年 サービス名） */}
            <span>© 2026 GTM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

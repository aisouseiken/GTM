// この部品は、連絡先データ（メール・電話番号）を何段階もかけて検証する仕組みを紹介するセクションです。
// メール用と電話用の2枚のカードを並べ、検証に使う複数サービス（プロバイダ）を順番に見せます。
// ※ウォーターフォール = 上から順番に試し、最初にうまくいった結果を採用する多段方式のこと。

// 連絡先データの多段ウォーターフォール検証セクション。
// GTM 独自のプロバイダ表記で、メール／電話の検証プロバイダ列を見せる（設計書08）。

// 1枚のカードに表示する内容の「型（決まった形）」。kind=種類、title=見出し、total=総プロバイダ数、
// providers=表示するサービス名、note=補足文、tag=保証ラベル。
interface Waterfall {
  kind: "email" | "phone";
  title: string;
  total: number;
  providers: string[];
  note: string;
  tag: string;
}

// メール検証カードに表示する具体的な中身。
const EMAIL: Waterfall = {
  kind: "email",
  title: "メール検証ウォーターフォール",
  total: 5,
  providers: ["MailProbe", "Verifi", "InboxSignal", "ReachIndex"],
  note: "最初に検証を通った結果を採用。未検証のアドレスは配信しません。",
  tag: "バウンスゼロ検証済み",
};

// 電話番号検証カードに表示する具体的な中身。
const PHONE: Waterfall = {
  kind: "phone",
  title: "電話番号検証ウォーターフォール",
  total: 9,
  providers: ["LineSense", "NumIndex", "DialScope", "CarrierMap"],
  note: "携帯・固定番号をリアルタイムに検証してから納品します。",
  tag: "リアルタイム検証済み",
};

// プロバイダ用アイコンの背景に使う色の候補。
const SQUARE = ["#ff77b8", "#8b7bd8", "#5bbd8a", "#e0a24e", "#5aa9e6", "#c77dd8"];

// 各プロバイダの頭文字を色付き四角に入れた小さなアイコンを作る部品。
function ProviderIcon({ name, i }: { name: string; i: number }) {
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${SQUARE[i % SQUARE.length]}, ${SQUARE[(i + 2) % SQUARE.length]})` }}
    >
      {name[0]}
    </span>
  );
}

// カードの見出しに置くアイコン。種類がメールなら封筒、電話なら受話器の絵を描く。
function HeaderIcon({ kind }: { kind: "email" | "phone" }) {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        {kind === "email" ? (
          <path d="M3 5h18v14H3V5Zm2 2v.5l7 4.5 7-4.5V7H5Zm14 2.9-6.5 4.2a1 1 0 0 1-1 0L5 9.9V17h14V9.9Z" />
        ) : (
          <path d="M6.6 2.9 9 3.6a1.5 1.5 0 0 1 1 1.7l-.5 2.4a1.5 1.5 0 0 1-.9 1.1L7 9.6a11 11 0 0 0 5.3 5.3l.8-1.6a1.5 1.5 0 0 1 1.1-.9l2.4-.5a1.5 1.5 0 0 1 1.7 1l.7 2.4a1.5 1.5 0 0 1-1.1 1.9C11.7 20.8 3.2 12.3 4.7 4.1A1.5 1.5 0 0 1 6.6 2.9Z" />
        )}
      </svg>
    </span>
  );
}

// 渡された1件ぶんのデータ（w）を使って、検証カードを1枚組み立てる部品。
function WaterfallCard({ w }: { w: Waterfall }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      {/* ヘッダ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeaderIcon kind={w.kind} />
          <span className="font-semibold text-ink">{w.title}</span>
        </div>
        <span className="font-mono text-xs text-muted">{w.total} プロバイダ</span>
      </div>

      <div className="mt-4 border-t border-line/70" />

      {/* プロバイダ列（先頭4件を表示、総数はバッジで示す） */}
      <ol className="mt-2">
        {w.providers.map((p, i) => (
          <li
            key={p}
            className="flex items-center gap-3 border-b border-line/50 py-3 last:border-0"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs text-muted">
              {i + 1}
            </span>
            <ProviderIcon name={p} i={i} />
            <span className="text-ink">{p}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-3 text-sm text-muted">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line text-[11px]">
            +{w.total - w.providers.length}
          </span>
          他 {w.total - w.providers.length} プロバイダ
        </li>
      </ol>

      {/* フッタ */}
      <div className="mt-2 border-t border-line/70 pt-4">
        <p className="text-sm text-ink-soft">{w.note}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.5 7.6 19.1 6.2z" />
          </svg>
          {w.tag}
        </span>
      </div>
    </div>
  );
}

// セクション全体を組み立てる部品。見出しと説明文の下に、メール・電話の2枚のカードを並べる。
export function ContactWaterfall() {
  return (
    // id="data" はナビの「Partners」リンクからここへスクロールしてくるための目印。
    <section id="data" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-serif-display text-3xl text-ink sm:text-4xl">
          連絡先データは、さらに一歩先へ。
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          メールは最大5、電話は最大9のプロバイダを重ねたウォーターフォール検証を通過。
          テーブルに載る前に、すべての結果を検証します。
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <WaterfallCard w={EMAIL} />
          <WaterfallCard w={PHONE} />
        </div>
      </div>
    </section>
  );
}

// 連絡先データの多段ウォーターフォール検証セクション。
// GTM 独自のプロバイダ表記で、メール／電話の検証プロバイダ列を見せる（設計書08）。

interface Waterfall {
  kind: "email" | "phone";
  title: string;
  total: number;
  providers: string[];
  note: string;
  tag: string;
}

const EMAIL: Waterfall = {
  kind: "email",
  title: "メール検証ウォーターフォール",
  total: 5,
  providers: ["MailProbe", "Verifi", "InboxSignal", "ReachIndex"],
  note: "最初に検証を通った結果を採用。未検証のアドレスは配信しません。",
  tag: "バウンスゼロ検証済み",
};

const PHONE: Waterfall = {
  kind: "phone",
  title: "電話番号検証ウォーターフォール",
  total: 9,
  providers: ["LineSense", "NumIndex", "DialScope", "CarrierMap"],
  note: "携帯・固定番号をリアルタイムに検証してから納品します。",
  tag: "リアルタイム検証済み",
};

const SQUARE = ["#ff77b8", "#8b7bd8", "#5bbd8a", "#e0a24e", "#5aa9e6", "#c77dd8"];

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

export function ContactWaterfall() {
  return (
    <section id="data" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="font-serif-display text-3xl text-ink sm:text-4xl">
          連絡先データは、さらに一歩先へ。
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          メール・電話は10社以上のカスタム・ウォーターフォール検証を通過。
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

import { FitBar, CompanyAvatar } from "./FitBar";

const DEMO_ROWS = [
  ["株式会社あおば歯科", "歯科・デンタル", "12", "採用強化中（3名）", 97],
  ["みらいデンタルクリニック", "歯科・デンタル", "8", "新規開業（今月）", 95],
  ["さくら矯正歯科", "歯科・デンタル", "15", "広告出稿中", 93],
  ["ヒカリ歯科医院", "歯科・デンタル", "6", "採用強化中", 91],
  ["結デンタルオフィス", "歯科・デンタル", "20", "拠点拡大", 89],
  ["north woods dental", "歯科・デンタル", "10", "Hiring hygienists", 86],
  ["大和ファミリー歯科", "歯科・デンタル", "9", "新規開業", 84],
  ["翔デンタルケア", "歯科・デンタル", "5", "広告出稿中", 81],
];

export function LandingDemo() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)]">
      <div className="grid md:grid-cols-[320px_1fr]">
        {/* Chat pane */}
        <div className="border-b border-line bg-cream-100/40 p-4 md:border-b-0 md:border-r">
          <div className="mb-3 text-xs text-muted">歯科クリニック開拓 · JP</div>
          <div className="rounded-xl bg-paper p-3 text-sm text-ink shadow-sm">
            東京の歯科医院で、スタッフを採用中の医院を探して
          </div>
          <div className="mt-3 rounded-xl bg-brand-soft/60 p-3 text-sm text-ink-soft">
            1,240件の歯科医院を発見しました。採用シグナル・広告出稿で絞り込み済みです。
          </div>
          <div className="mt-4 rounded-xl border border-line bg-paper p-2.5">
            <div className="text-xs text-muted">フォローアップを入力…</div>
          </div>
        </div>

        {/* Table pane */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-serif-display text-base text-ink">東京 · 歯科 · 採用中</div>
              <div className="mt-1 flex gap-2 text-[11px]">
                <span className="rounded-full border border-line px-2 py-0.5 text-ink-soft">採用中</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-ink-soft">広告出稿</span>
              </div>
            </div>
            <button className="rounded-full border border-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink">
              + さらに取得
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-cream-100/60 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Fit</th>
                  <th className="px-3 py-2 font-medium">会社</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">業種</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">従業員</th>
                  <th className="px-3 py-2 font-medium">シグナル</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ROWS.map(([name, cat, hc, sig, score], i) => (
                  <tr key={i} className="border-t border-line/70">
                    <td className="px-3 py-2">
                      <FitBar score={score as number} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <CompanyAvatar name={name as string} />
                        <span className="text-ink">{name}</span>
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">{cat}</td>
                    <td className="hidden px-3 py-2 text-ink-soft md:table-cell">{hc}</td>
                    <td className="px-3 py-2 text-ink-soft">{sig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

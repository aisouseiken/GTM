// 特定商取引法に基づく表記（日本で有料サービスを販売する際に必要）。
// 事業者固有の情報は正式運用前に必ず実際の値へ差し替えてください（プレースホルダ）。
export const metadata = { title: "特定商取引法に基づく表記 | GTM" };

const ROWS: [string, string][] = [
  ["販売事業者", "（正式運用前に記載）"],
  ["運営責任者", "（正式運用前に記載）"],
  ["所在地", "（請求があった場合に遅滞なく開示します／正式運用前に記載）"],
  ["連絡先", "support@example.com（正式運用前に差し替え）"],
  ["販売価格", "各プランの料金は料金ページに表示します（税込表記）。"],
  ["商品代金以外の必要料金", "インターネット接続に必要な通信料等はお客様のご負担となります。"],
  ["支払方法", "クレジットカード（Stripe）"],
  ["支払時期", "サブスクリプションは各請求期間の開始時に決済されます。"],
  ["サービス提供時期", "決済完了後、直ちにご利用いただけます。"],
  ["返品・キャンセル", "サービスの性質上、原則として提供後の返金はできません。解約はいつでも可能で、次回更新以降の請求が停止します。"],
];

export default function TokushohoPage() {
  return (
    <article className="text-sm leading-relaxed text-ink-soft">
      <h1 className="font-serif-display text-3xl text-ink">特定商取引法に基づく表記</h1>
      <p className="mt-2 text-xs text-muted">最終更新日：2026年7月10日</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <tbody>
            {ROWS.map(([k, v]) => (
              <tr key={k} className="border-t border-line/70 first:border-0">
                <th className="w-40 bg-cream-100/50 px-4 py-3 align-top font-medium text-ink">{k}</th>
                <td className="px-4 py-3 text-ink-soft">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-xs text-muted">
        ※ 本ページはひな型です。販売事業者名・所在地・連絡先・価格等を正式運用前に必ず実際の情報へ差し替えてください。
      </p>
    </article>
  );
}

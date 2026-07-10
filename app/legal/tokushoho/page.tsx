// 特定商取引法に基づく表記（日本で有料サービスを販売する際に必要）。
// 事業者固有の情報は正式運用前に必ず実際の値へ差し替えてください（プレースホルダ）。
// ※プレースホルダ＝仮の値（後で本物に置き換える前提の穴埋め）。
// metadata＝このページの設定情報。ブラウザのタブに出るページ名（タイトル）を指定。
export const metadata = { title: "特定商取引法に基づく表記 | GTM" };

// 表に並べる「項目名」と「その内容」の組を一覧にしたもの。あとで順番に表の行にします。
const ROWS: [string, string][] = [
  // 誰が売っているか（会社名）
  ["販売事業者", "（正式運用前に記載）"],
  // 運営の責任者名
  ["運営責任者", "（正式運用前に記載）"],
  // 事業者の住所
  ["所在地", "（請求があった場合に遅滞なく開示します／正式運用前に記載）"],
  // 問い合わせ先
  ["連絡先", "support@example.com（正式運用前に差し替え）"],
  // 値段の案内
  ["販売価格", "各プランの料金は料金ページに表示します（税込表記）。"],
  // 商品代金以外にかかるお金
  ["商品代金以外の必要料金", "インターネット接続に必要な通信料等はお客様のご負担となります。"],
  // どうやって支払うか
  ["支払方法", "クレジットカード（Stripe）"],
  // いつ支払うか
  ["支払時期", "サブスクリプションは各請求期間の開始時に決済されます。"],
  // いつからサービスを使えるか
  ["サービス提供時期", "決済完了後、直ちにご利用いただけます。"],
  // 返金や解約の扱い
  ["返品・キャンセル", "サービスの性質上、原則として提供後の返金はできません。解約はいつでも可能で、次回更新以降の請求が停止します。"],
];

// 特定商取引法の表記ページ本文を組み立てる部品。
export default function TokushohoPage() {
  // return（返す）の中身が、実際に画面に表示される見た目です。
  return (
    // article＝記事のまとまり。この中に表記を入れる
    <article className="text-sm leading-relaxed text-ink-soft">
      {/* ページの大見出し */}
      <h1 className="font-serif-display text-3xl text-ink">特定商取引法に基づく表記</h1>
      {/* いつ最後に更新したかの表示 */}
      <p className="mt-2 text-xs text-muted">最終更新日：2026年7月10日</p>

      {/* 上のROWS一覧を表（テーブル）にして見せる枠 */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
        {/* table＝表。左に項目名、右にその内容を並べる */}
        <table className="w-full text-left text-sm">
          <tbody>
            {/* ROWS一覧を1件ずつ取り出して（k＝項目名, v＝内容）、表の1行を作る */}
            {ROWS.map(([k, v]) => (
              // 表の1行。keyは各行を区別する目印（画面には出ない）
              <tr key={k} className="border-t border-line/70 first:border-0">
                {/* 左側のセル：項目名（見出し） */}
                <th className="w-40 bg-cream-100/50 px-4 py-3 align-top font-medium text-ink">{k}</th>
                {/* 右側のセル：その項目の内容 */}
                <td className="px-4 py-3 text-ink-soft">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページ末尾の注意書き（このページは下書きで、正式運用前に本物へ差し替える必要がある旨） */}
      <p className="mt-8 text-xs text-muted">
        ※ 本ページはひな型です。販売事業者名・所在地・連絡先・価格等を正式運用前に必ず実際の情報へ差し替えてください。
      </p>
    </article>
  );
}

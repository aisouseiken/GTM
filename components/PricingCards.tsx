// この部品は「料金プランの比較カード」を作ります。無料〜有料の各プランを横に並べ、
// 月額料金・付与クレジット・使える機能の一覧を表にして見せます。
// カードのボタンを押すと新規登録ページへ進みます（金額の表示は日本円）。

import Link from "next/link"; // ページ移動用のリンク部品。
import { PLAN_INFO, type Plan } from "@/lib/domain/types"; // 各プランの料金情報と、プラン種別の「型（決まった形）」。
import { formatJpy } from "@/lib/config"; // 金額を日本円の見やすい表記（¥・カンマ区切り）に整える関数。

// 左から右へカードを並べる順番。
const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "scale"];

// 各機能欄に入る値の種類：文字・数値・オン/オフ（true/false）のいずれか。
type Val = string | number | boolean;

// 機能項目のマトリクス（GTM 独自のプラン内容）
// ※マトリクス = 縦に機能、横にプランを並べた対応表。各プランでその機能が使えるかを表す。
const FEATURES: { label: string; values: Record<Plan, Val> }[] = [
  { label: "AIモデル", values: { free: "GTM Lite 1.2", starter: "GTM Lite 1.2", pro: "GTM Max 1.2", scale: "GTM Max 1.2", enterprise: "カスタム" } },
  { label: "チームメンバー", values: { free: "1", starter: "無制限", pro: "無制限", scale: "無制限", enterprise: "無制限" } },
  { label: "エージェントへの指示", values: { free: "20回", starter: "無制限", pro: "無制限", scale: "無制限", enterprise: "無制限" } },
  { label: "ワークスペース", values: { free: 1, starter: 40, pro: 200, scale: 1000, enterprise: "無制限" } },
  { label: "テーブル行数", values: { free: 30, starter: "無制限", pro: "無制限", scale: "無制限", enterprise: "無制限" } },
  { label: "同時実行数", values: { free: 3, starter: 10, pro: 20, scale: 50, enterprise: "無制限" } },
  { label: "検証済みメール・電話", values: { free: false, starter: true, pro: true, scale: true, enterprise: true } },
  { label: "信頼度スコア", values: { free: true, starter: true, pro: true, scale: true, enterprise: true } },
  { label: "CSVエクスポート", values: { free: false, starter: true, pro: true, scale: true, enterprise: true } },
  // Sequencer は未実装のため「近日」表記（誇大表示を避ける）
  { label: "Sequencer", values: { free: "近日", starter: "近日", pro: "近日", scale: "近日", enterprise: "近日" } },
  { label: "再現実行（スナップショット）", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
  { label: "公開REST API", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
  // CRM連携も未提供のため「近日」表記（LeadDrawerの「最終フェーズで有効化」と整合）
  { label: "CRM連携（HubSpot / Salesforce）", values: { free: false, starter: false, pro: "近日", scale: "近日", enterprise: "近日" } },
  { label: "優先サポート", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
];

// 「その機能が使える」ことを示すチェックマーク（レ点）の絵。
function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-brand">
      <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.5 7.6 19.1 6.2z" />
    </svg>
  );
}

// 機能欄1マスの表示を決める部品。true ならチェック、false なら「—」、
// それ以外は文字や数字をそのまま表示する（数字はカンマ区切りに整える）。
function ValueCell({ v }: { v: Val }) {
  if (v === true) return <Check />;
  if (v === false) return <span className="text-line-strong">—</span>;
  return <span className="text-ink">{typeof v === "number" ? v.toLocaleString() : v}</span>;
}

// 料金カードを全プランぶん並べる本体。
export function PricingCards() {
  return (
    // 画面幅に応じてカードを1〜4列に並べる入れ物。
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 決めた順番でプランを1つずつ取り出し、それぞれ1枚のカードを作る */}
      {PLAN_ORDER.map((p) => {
        const info = PLAN_INFO[p]; // そのプランの料金やクレジット等の情報。
        const highlight = p === "pro"; // pro プランだけ目立たせる（おすすめ枠）。
        return (
          // カード本体。おすすめ枠はピンクの枠線で強調する。
          <div
            key={p}
            className={`flex flex-col rounded-2xl border bg-paper p-6 ${
              highlight ? "border-brand ring-1 ring-brand/30" : "border-line"
            }`}
          >
            {/* プラン名（おすすめ枠は色を変える） */}
            <div
              className={`text-sm font-medium ${highlight ? "text-brand" : "text-ink-soft"}`}
            >
              {info.label}
            </div>
            {/* 月額料金。0円なら「¥0」、それ以外は円表示に整形して見せる */}
            <div className="mt-2 text-3xl font-semibold text-ink">
              {info.priceJpy === 0 ? "¥0" : formatJpy(info.priceJpy)}
              <span className="text-sm font-normal text-muted">/月</span>
            </div>
            {/* 毎月付与されるクレジット数（3桁ごとにカンマ区切り） */}
            <div className="mt-2 text-sm text-ink-soft">
              {info.monthlyCredits.toLocaleString()} クレジット/月
            </div>

            {/* 「はじめる」ボタン。押すと新規登録ページへ。おすすめ枠だけ黒背景で強調 */}
            <Link
              href="/signup"
              className={`mt-5 block rounded-full px-4 py-2 text-center text-sm font-medium ${
                highlight
                  ? "bg-ink text-white"
                  : "border border-line-strong bg-paper text-ink hover:bg-cream-100"
              }`}
            >
              はじめる
            </Link>

            {/* 機能項目：機能名（左）と、そのプランでの対応状況（右）を並べる */}
            <dl className="mt-6 space-y-3 border-t border-line/70 pt-5 text-[13px]">
              {/* 機能一覧を1つずつ取り出し、機能名とこのプランでの対応を1行にする */}
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-2">
                  {/* 左：機能名 */}
                  <dt className="text-muted">{f.label}</dt>
                  {/* 右：このプランでの対応状況（チェック/—/文字） */}
                  <dd className="shrink-0 text-right font-medium">
                    <ValueCell v={f.values[p]} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

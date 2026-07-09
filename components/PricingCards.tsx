import Link from "next/link";
import { PLAN_INFO, type Plan } from "@/lib/domain/types";
import { formatJpy } from "@/lib/config";

const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "scale"];

type Val = string | number | boolean;

// 機能項目のマトリクス（GTM 独自のプラン内容）
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
  { label: "Sequencer", values: { free: true, starter: true, pro: true, scale: true, enterprise: true } },
  { label: "再現実行（スナップショット）", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
  { label: "公開REST API", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
  { label: "CRM連携（HubSpot / Salesforce）", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
  { label: "優先サポート", values: { free: false, starter: false, pro: true, scale: true, enterprise: true } },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-brand">
      <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.5 7.6 19.1 6.2z" />
    </svg>
  );
}

function ValueCell({ v }: { v: Val }) {
  if (v === true) return <Check />;
  if (v === false) return <span className="text-line-strong">—</span>;
  return <span className="text-ink">{typeof v === "number" ? v.toLocaleString() : v}</span>;
}

export function PricingCards() {
  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {PLAN_ORDER.map((p) => {
        const info = PLAN_INFO[p];
        const highlight = p === "pro";
        return (
          <div
            key={p}
            className={`flex flex-col rounded-2xl border bg-paper p-6 ${
              highlight ? "border-brand ring-1 ring-brand/30" : "border-line"
            }`}
          >
            <div
              className={`text-sm font-medium ${highlight ? "text-brand" : "text-ink-soft"}`}
            >
              {info.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-ink">
              {info.priceJpy === 0 ? "¥0" : formatJpy(info.priceJpy)}
              <span className="text-sm font-normal text-muted">/月</span>
            </div>
            <div className="mt-2 text-sm text-ink-soft">
              {info.monthlyCredits.toLocaleString()} クレジット/月
            </div>

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

            {/* 機能項目 */}
            <dl className="mt-6 space-y-3 border-t border-line/70 pt-5 text-[13px]">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-2">
                  <dt className="text-muted">{f.label}</dt>
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

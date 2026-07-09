// エージェント：自然言語プロンプト → 構造化ICP → 検索プラン
// MOCK_MODE ではヒューリスティック（キーワード抽出）で決定的に解釈する。
// 実 LLM アダプタは planWithLLM() として最終フェーズで差し替え可能。

import type {
  ConnectorPlanItem,
  Market,
  SearchPlan,
  StructuredICP,
} from "@/lib/domain/types";
import { id, saveSearchPlan } from "@/lib/data/store";

interface IndustryDef {
  label: string;
  keywords: string[]; // マッチ用（日英）
  expand: string[]; // クエリ拡張の同義語
}

const INDUSTRIES: IndustryDef[] = [
  { label: "歯科・デンタル", keywords: ["歯科", "デンタル", "dental", "dentist"], expand: ["歯科医院", "矯正歯科", "デンタルクリニック"] },
  { label: "医療・クリニック", keywords: ["クリニック", "医院", "病院", "clinic", "medical", "healthcare"], expand: ["内科", "整形外科", "医療法人"] },
  { label: "空調・HVAC", keywords: ["空調", "hvac", "設備", "電気工事"], expand: ["空調設備", "冷暖房", "設備工事"] },
  { label: "飲食・レストラン", keywords: ["飲食", "レストラン", "restaurant", "cafe", "カフェ", "居酒屋"], expand: ["飲食店", "外食", "food service"] },
  { label: "SaaS・ソフトウェア", keywords: ["saas", "ソフトウェア", "software", "スタートアップ", "startup", "it"], expand: ["B2B SaaS", "クラウド", "dev tools"] },
  { label: "Eコマース", keywords: ["ec", "eコマース", "ecommerce", "e-commerce", "shopify", "通販", "d2c"], expand: ["ネットショップ", "D2C", "online store"] },
  { label: "不動産", keywords: ["不動産", "real estate", "proptech", "賃貸"], expand: ["不動産会社", "仲介", "管理会社"] },
  { label: "建設・工務店", keywords: ["建設", "工務店", "建築", "construction", "リフォーム"], expand: ["建設会社", "施工", "リフォーム会社"] },
  { label: "製造業", keywords: ["製造", "工場", "manufacturing", "メーカー", "factory"], expand: ["製造業", "町工場", "部品メーカー"] },
  { label: "物流・運送", keywords: ["物流", "運送", "logistics", "配送", "倉庫"], expand: ["運送会社", "3PL", "倉庫業"] },
];

const SIGNAL_RULES: { keywords: string[]; jp: string; en: string }[] = [
  { keywords: ["採用", "hiring", "採用中", "求人", "sdr", "ae"], jp: "採用強化中", en: "Hiring" },
  { keywords: ["資金調達", "調達", "funding", "raised", "series", "シリーズ"], jp: "資金調達済み", en: "Recently funded" },
  { keywords: ["広告", "ads", "google広告", "出稿", "running ads"], jp: "広告出稿中", en: "Running ads" },
  { keywords: ["開業", "新規", "オープン", "new", "opened", "開店"], jp: "新規開業", en: "Newly opened" },
  { keywords: ["拡大", "拠点", "expansion", "growing"], jp: "事業拡大中", en: "Expanding" },
];

const JP_LOCATION_HINTS = ["東京", "大阪", "名古屋", "福岡", "北海道", "札幌", "京都", "横浜", "神戸", "仙台", "日本", "国内", "関東", "関西"];

// カタカナ／英語の海外地名（これがあればグローバル市場と判定）
const GLOBAL_LOCATION_HINTS = [
  "フロリダ", "テキサス", "カリフォルニア", "ニューヨーク", "シアトル", "ボストン",
  "アメリカ", "米国", "ロンドン", "ヨーロッパ", "海外", "グローバル",
];
const GLOBAL_LOCATION_EN = /\b(usa|us|florida|texas|california|new york|seattle|boston|london|uk|europe|global|america)\b/;

function detectMarket(text: string, fallback: Market): Market {
  const t = text.toLowerCase();
  // 海外地名が明示されていればグローバル優先
  if (GLOBAL_LOCATION_HINTS.some((h) => text.includes(h)) || GLOBAL_LOCATION_EN.test(t))
    return "GLOBAL";
  if (JP_LOCATION_HINTS.some((h) => text.includes(h))) return "JP";
  if (/[ぁ-んァ-ヶ一-龠]/.test(text)) return "JP";
  return fallback;
}

function detectIndustry(text: string): IndustryDef {
  const t = text.toLowerCase();
  for (const def of INDUSTRIES) {
    if (def.keywords.some((k) => t.includes(k.toLowerCase()))) return def;
  }
  return { label: "企業全般", keywords: [], expand: ["ビジネス", "企業"] };
}

function detectLocation(text: string, market: Market): string {
  if (market === "JP") {
    for (const h of JP_LOCATION_HINTS) {
      if (text.includes(h)) return h;
    }
    return "日本全国";
  }
  // グローバル：カタカナ地名を英語表記に寄せて返す
  for (const h of GLOBAL_LOCATION_HINTS) {
    if (text.includes(h)) return h;
  }
  const m = text.match(/\b(Florida|Texas|California|New York|Seattle|Boston|London|USA|UK)\b/i);
  if (m) return m[1];
  return "United States";
}

function detectSignals(text: string, market: Market): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const rule of SIGNAL_RULES) {
    if (rule.keywords.some((k) => t.includes(k.toLowerCase()))) {
      out.push(market === "JP" ? rule.jp : rule.en);
    }
  }
  return out;
}

export function buildICP(prompt: string, marketDefault: Market): StructuredICP {
  const market = detectMarket(prompt, marketDefault);
  const ind = detectIndustry(prompt);
  const location = detectLocation(prompt, market);
  const signals = detectSignals(prompt, market);
  return {
    industry: ind.label,
    industryKeywords: ind.expand,
    location,
    market,
    signals,
    raw: prompt,
  };
}

// コネクタ選定（市場別）
function connectorsForMarket(market: Market, signals: string[]): ConnectorPlanItem[] {
  const items: ConnectorPlanItem[] =
    market === "JP"
      ? [
          { connectorId: "maps_jp", label: "地図・ローカル企業", params: {} },
          { connectorId: "houjin", label: "法人番号(gBizINFO)", params: {} },
          { connectorId: "site", label: "企業サイト", params: {} },
        ]
      : [
          { connectorId: "maps", label: "Google Maps", params: {} },
          { connectorId: "linkedin", label: "企業データ", params: {} },
          { connectorId: "site", label: "Website", params: {} },
        ];
  if (signals.some((s) => /採用|Hiring/.test(s)))
    items.push({ connectorId: market === "JP" ? "jobs_jp" : "jobs", label: "求人シグナル", params: {} });
  if (signals.some((s) => /広告|ads/i.test(s)))
    items.push({ connectorId: "ads", label: "広告透明性", params: {} });
  return items;
}

function estimate(count: number, connectors: number): { credits: number; leads: number } {
  // 1リード ≈ 発見1 + 検証1〜2 + エンリッチ1 相当の消費
  const leads = count;
  const credits = Math.round(leads * (2.4 + connectors * 0.1));
  return { credits, leads };
}

export function createPlan(
  workspaceId: string,
  sessionId: string,
  prompt: string,
  marketDefault: Market,
  targetCount = 24
): SearchPlan {
  const icp = buildICP(prompt, marketDefault);
  const connectors = connectorsForMarket(icp.market, icp.signals);
  const est = estimate(targetCount, connectors.length);
  const plan: SearchPlan = {
    id: id("plan"),
    workspaceId,
    sessionId,
    icp,
    connectors,
    estimatedCredits: est.credits,
    estimatedLeads: est.leads,
    createdAt: Date.now(),
  };
  saveSearchPlan(plan);
  return plan;
}

// 実 LLM 接続用のフック（最終フェーズ）
export async function planWithLLM(): Promise<never> {
  throw new Error("LLM plan not configured (set MOCK_MODE=false and provide LLM_API_KEY)");
}

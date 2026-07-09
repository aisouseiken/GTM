// エージェント：自然言語プロンプト → 構造化ICP → 検索プラン
// MOCK_MODE ではヒューリスティック（キーワード抽出）で決定的に解釈する。
// 実 LLM アダプタは planWithLLM() として最終フェーズで差し替え可能。
//
// このファイルの役割：ユーザーが入力した文章（例:「東京で採用中の歯科医院を探して」）を読み取り、
// 「業種・地域・シグナル」などに分解して、検索の計画（プラン）を組み立てます。
// ヒューリスティック＝AIを使わず、あらかじめ決めたキーワードの当てはめで判断する簡易手法。
// LLM＝大規模言語モデル（ChatGPTのようなAI）。本番ではこれに置き換え可能。

import type {
  ConnectorPlanItem,
  Market,
  SearchPlan,
  StructuredICP,
} from "@/lib/domain/types";
import { id, saveSearchPlan } from "@/lib/data/store";
import { getConnectors } from "@/lib/connectors/registry";

// 業種1つ分の定義。どんな言葉に反応し、検索時にどう言い換えるかを持つ。
interface IndustryDef {
  label: string; // 業種の正式な表示名
  keywords: string[]; // マッチ用（日英）＝この言葉が文中にあればこの業種と判定
  expand: string[]; // クエリ拡張の同義語＝検索を広げるための言い換え候補
}

// 対応している業種の一覧。上から順にキーワード照合していく。
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

// 買い手シグナルを判定するルール一覧。文中の言葉から企業の動きを推測する。
// jp=日本語表示, en=英語表示（市場に応じて使い分ける）。
const SIGNAL_RULES: { keywords: string[]; jp: string; en: string }[] = [
  { keywords: ["採用", "hiring", "採用中", "求人", "sdr", "ae"], jp: "採用強化中", en: "Hiring" },
  { keywords: ["資金調達", "調達", "funding", "raised", "series", "シリーズ"], jp: "資金調達済み", en: "Recently funded" },
  { keywords: ["広告", "ads", "google広告", "出稿", "running ads"], jp: "広告出稿中", en: "Running ads" },
  { keywords: ["開業", "新規", "オープン", "new", "opened", "開店"], jp: "新規開業", en: "Newly opened" },
  { keywords: ["拡大", "拠点", "expansion", "growing"], jp: "事業拡大中", en: "Expanding" },
];

// 国内地名のヒント（これが文中にあれば日本市場と判定しやすくなる）。
const JP_LOCATION_HINTS = ["東京", "大阪", "名古屋", "福岡", "北海道", "札幌", "京都", "横浜", "神戸", "仙台", "日本", "国内", "関東", "関西"];

// カタカナ／英語の海外地名（これがあればグローバル市場と判定）
const GLOBAL_LOCATION_HINTS = [
  "フロリダ", "テキサス", "カリフォルニア", "ニューヨーク", "シアトル", "ボストン",
  "アメリカ", "米国", "ロンドン", "ヨーロッパ", "海外", "グローバル",
];
// 英語表記の海外地名を検出する正規表現（\b は単語の区切り、i は大文字小文字を無視）。
const GLOBAL_LOCATION_EN = /\b(usa|us|florida|texas|california|new york|seattle|boston|london|uk|europe|global|america)\b/;

// 入力文から対象市場（日本 or グローバル）を判定する。fallback は判定できなかったときの既定値。
function detectMarket(text: string, fallback: Market): Market {
  const t = text.toLowerCase(); // 英語判定用に小文字化
  // 海外地名が明示されていればグローバル優先
  if (GLOBAL_LOCATION_HINTS.some((h) => text.includes(h)) || GLOBAL_LOCATION_EN.test(t))
    return "GLOBAL";
  if (JP_LOCATION_HINTS.some((h) => text.includes(h))) return "JP"; // 国内地名があれば日本
  if (/[ぁ-んァ-ヶ一-龠]/.test(text)) return "JP"; // ひらがな/カタカナ/漢字が含まれれば日本
  return fallback; // どれにも当てはまらなければ既定値
}

// 入力文から業種を判定する。どれにも当てはまらなければ「企業全般」を返す。
function detectIndustry(text: string): IndustryDef {
  const t = text.toLowerCase();
  for (const def of INDUSTRIES) { // 業種一覧を上から順に照合
    if (def.keywords.some((k) => t.includes(k.toLowerCase()))) return def; // 最初に一致した業種を採用
  }
  return { label: "企業全般", keywords: [], expand: ["ビジネス", "企業"] };
}

// 入力文から地域名を取り出す。市場に応じて日本/海外の地名リストを参照する。
function detectLocation(text: string, market: Market): string {
  if (market === "JP") {
    for (const h of JP_LOCATION_HINTS) {
      if (text.includes(h)) return h; // 見つかった国内地名を返す
    }
    return "日本全国"; // 具体的な地名がなければ全国扱い
  }
  // グローバル：カタカナ地名を英語表記に寄せて返す
  for (const h of GLOBAL_LOCATION_HINTS) {
    if (text.includes(h)) return h;
  }
  const m = text.match(/\b(Florida|Texas|California|New York|Seattle|Boston|London|USA|UK)\b/i);
  if (m) return m[1]; // 英語の地名が見つかればそれを返す
  return "United States"; // 見つからなければ米国を既定にする
}

// 入力文から買い手シグナル（採用中・資金調達など）を抽出する。
function detectSignals(text: string, market: Market): string[] {
  const t = text.toLowerCase();
  const out: string[] = []; // 見つかったシグナルをためる
  for (const rule of SIGNAL_RULES) {
    if (rule.keywords.some((k) => t.includes(k.toLowerCase()))) {
      out.push(market === "JP" ? rule.jp : rule.en); // 市場に応じた表記で追加
    }
  }
  return out;
}

// 上記の判定をまとめて呼び出し、構造化ICP（整理された顧客像）を組み立てて返す。
export function buildICP(prompt: string, marketDefault: Market): StructuredICP {
  const market = detectMarket(prompt, marketDefault); // 市場を判定
  const ind = detectIndustry(prompt); // 業種を判定
  const location = detectLocation(prompt, market); // 地域を判定
  const signals = detectSignals(prompt, market); // シグナルを抽出
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
// 市場に応じて「どのデータ取得先を使うか」を一覧で返す。
// ★実際に実行するコネクタ（registry）からそのまま導出する。
//   こうすることで「プランに表示・保存するコネクタ」と「実行するコネクタ」が必ず一致する
//   （＝以前の site と site_jp のズレ、存在しない ads を計画に載せる不整合を解消）。
function connectorsForMarket(market: Market): ConnectorPlanItem[] {
  return getConnectors(market).map((c) => ({
    connectorId: c.id,
    label: c.label,
    params: {},
  }));
}

// 想定コスト（クレジット）と想定件数をざっくり見積もる。
function estimate(count: number, connectors: number): { credits: number; leads: number } {
  // 1リード ≈ 発見1 + 検証1〜2 + エンリッチ1 相当の消費
  // ＝1件のリードを得るのに、探す・確かめる・情報を補う工程ぶんのクレジットがかかる想定
  const leads = count;
  const credits = Math.round(leads * (2.4 + connectors * 0.1)); // 件数×単価（コネクタが多いほど微増）
  return { credits, leads };
}

// 検索プランを作成して保存する、このファイルの中心的な関数。
export function createPlan(
  workspaceId: string,
  sessionId: string,
  prompt: string,
  marketDefault: Market,
  targetCount = 24 // 目標取得件数（省略時は24件）
): SearchPlan {
  const icp = buildICP(prompt, marketDefault); // 文章を顧客像に変換
  const connectors = connectorsForMarket(icp.market); // 使うデータ取得先を決定（実行と一致）
  const est = estimate(targetCount, connectors.length); // コストと件数を見積もる
  const plan: SearchPlan = { // プランを組み立てる
    id: id("plan"),
    workspaceId,
    sessionId,
    icp,
    connectors,
    estimatedCredits: est.credits,
    estimatedLeads: est.leads,
    createdAt: Date.now(),
  };
  saveSearchPlan(plan); // 作成したプランを保存
  return plan;
}

// 実 LLM 接続用のフック（最終フェーズ）
// ＝将来ここに本物のAIを繋ぐ差し込み口。今は未設定なのでエラーを投げるだけ。
export async function planWithLLM(): Promise<never> {
  throw new Error("LLM plan not configured (set MOCK_MODE=false and provide LLM_API_KEY)");
}

// コネクタ・レジストリ（データ取得先の一覧と、市場ごとの選定）。
//
// このファイルの役割：
//   市場（JP / GLOBAL）に応じて「どの取得先を使うか」を返し、各取得先が
//   企業プールから“自分が見つけられる範囲”の候補を返します。
//   ・取得先ごとに担当範囲を変える → 重複と、取りこぼしの補完（Recall向上）を再現
//   ・取得先ごとに埋める項目を変える（地図は電話、求人はシグナル、サイトはメール等）
//     → 後段の名寄せで「最も良い値」を採用する様子を再現
//   実データ源（LinkedIn/求人API/地図API等）へ差し替える際は、この形に合わせるだけ。

// 市場（JP/GLOBAL）の型を借りる。
import type { Market } from "@/lib/domain/types";
// コネクタの契約・候補1件・検索条件の型を借りる。
import type { DataSourceConnector, LeadCandidate, ConnectorSearchInput } from "./types";
// モックの企業プール（偽の企業一覧）を作る機能と、安定した数値を作る機能、1社分の型を借りる。
import { generateCompanyPool, stableFraction, type PoolCompany } from "@/lib/mock/pool";
// gBizINFO の実コネクタと、それが有効かどうかを判定する機能を借りる。
import { gbizConnector, gbizEnabled } from "./gbizinfo";

// どの項目を埋めるコネクタか（部分データを再現するための指定）
// 各コネクタは得意分野が違うので、埋める項目を true/false で切り替える。
interface FieldProfile {
  email?: boolean; // メールを埋めるか
  phone?: boolean; // 電話を埋めるか
  signal?: boolean; // 買い手シグナルを埋めるか
  funding?: boolean; // 資金調達情報を埋めるか
  tech?: boolean; // 技術スタック（使っているツール）を埋めるか
}

// プールの1社を、そのコネクタ視点の「候補」に変換する（担当外の項目は空にする）
function toCandidate(
  c: PoolCompany,
  icp: ConnectorSearchInput["icp"],
  connectorId: string,
  label: string,
  fields: FieldProfile,
  now: number
): LeadCandidate {
  // プールの1社(c)を、このコネクタ視点の候補に詰め替えて返す。
  return {
    companyName: c.companyName, // 会社名（そのまま）
    domain: c.domain, // ドメイン（そのまま。名寄せの目印になる）
    email: fields.email ? c.email : undefined, // メール担当のコネクタだけ埋める（他は空）
    phone: fields.phone ? c.phone : undefined, // 電話担当のコネクタだけ埋める
    address: c.city, // 住所（市区名）
    location: c.city, // 所在地（同じく市区名）
    industry: icp.industry, // 業種（検索条件のもの）
    category: icp.industry, // カテゴリ（ここでは業種と同じ）
    size: c.size, // 企業規模の目安
    headcount: c.headcount, // 従業員数
    funding: fields.funding ? c.funding : undefined, // 資金調達担当のコネクタだけ埋める
    signals: icp.signals, // 買い手シグナルの一覧（検索条件のもの）
    buyingSignal: fields.signal ? c.buyingSignal : undefined, // シグナル担当のコネクタだけ代表シグナルを埋める
    enrichment: fields.tech ? { techStack: c.techStack, website: `https://${c.domain}` } : {}, // 技術担当なら技術情報とサイトを、他は空
    fitScore: c.fitScore, // ICP適合スコア
    source: { // この候補の出典（どのコネクタが見つけたか）
      connectorId, // コネクタの識別子
      label, // コネクタの表示名
      url: `https://${connectorId}.example/${c.domain}`, // 出典を模した仮のURL
      snippet: `${c.companyName} — ${icp.industry} / ${c.city}`, // 抜粋（会社名・業種・所在地）
    },
    fetchedAt: now, // 取得時刻
  };
}

// 1コネクタ分を定義するヘルパー。
// coverage=このコネクタが担当する割合（0..1）、offset=担当範囲をずらす値。
function makeConnector(opts: {
  id: string;
  label: string;
  markets: Market[];
  costPerCall: number;
  coverage: number;
  offset: number;
  fields: FieldProfile;
}): DataSourceConnector {
  // opts の設定をそのままコネクタの各項目に写し、search（探す処理）だけ実装する。
  return {
    id: opts.id, // 識別子
    label: opts.label, // 表示名
    markets: opts.markets, // 対応市場
    costPerCall: opts.costPerCall, // 1回あたりの想定原価
    async search(input: ConnectorSearchInput): Promise<LeadCandidate[]> {
      const now = Date.now(); // 取得時刻を1回だけ用意
      // 目標件数より多めのプールを作り、その中から担当分だけ返す（→ コネクタ間で重複が出る）
      // 各コネクタは担当割合ぶんしか返さないため、目標件数の約1.7倍を用意して取りこぼしを防ぐ。
      const pool = generateCompanyPool(input.icp, input.planId, Math.max(Math.round(input.count * 1.7), 40));
      const found: LeadCandidate[] = []; // 見つけた候補を貯める入れ物
      for (const c of pool) { // プールの企業を1社ずつ調べる
        // ドメイン＋offset から安定した値を作り、coverage 未満なら「このコネクタが見つけた」とする
        const f = stableFraction(c.domain + opts.offset); // 0〜1の安定した数値（毎回同じ結果）
        if (f < opts.coverage) { // 担当割合の範囲内なら、このコネクタが見つけたことにする
          found.push(toCandidate(c, input.icp, opts.id, opts.label, opts.fields, now)); // 候補の形に変換して追加
        }
      }
      return found; // このコネクタが見つけた候補一覧を返す
    },
  };
}

// 日本市場のコネクタ群
const JP_CONNECTORS: DataSourceConnector[] = [
  makeConnector({ id: "maps_jp", label: "地図・ローカル企業", markets: ["JP"], costPerCall: 1, coverage: 0.7, offset: 1, fields: { phone: true, tech: true } }),
  makeConnector({ id: "houjin", label: "法人番号(gBizINFO)", markets: ["JP"], costPerCall: 0, coverage: 0.6, offset: 2, fields: { funding: true } }),
  makeConnector({ id: "jobs_jp", label: "求人シグナル", markets: ["JP"], costPerCall: 1, coverage: 0.55, offset: 3, fields: { signal: true } }),
  makeConnector({ id: "site_jp", label: "企業サイト", markets: ["JP"], costPerCall: 1, coverage: 0.65, offset: 4, fields: { email: true, tech: true } }),
];

// グローバル市場のコネクタ群
const GLOBAL_CONNECTORS: DataSourceConnector[] = [
  makeConnector({ id: "maps", label: "Google Maps", markets: ["GLOBAL"], costPerCall: 1, coverage: 0.7, offset: 1, fields: { phone: true } }),
  makeConnector({ id: "linkedin", label: "企業データ", markets: ["GLOBAL"], costPerCall: 1, coverage: 0.65, offset: 2, fields: { funding: true, tech: true } }),
  makeConnector({ id: "jobs", label: "求人シグナル", markets: ["GLOBAL"], costPerCall: 1, coverage: 0.55, offset: 3, fields: { signal: true } }),
  makeConnector({ id: "site", label: "Website", markets: ["GLOBAL"], costPerCall: 1, coverage: 0.65, offset: 4, fields: { email: true } }),
];

// 市場に応じてコネクタ一覧を返す（実データ源に差し替える差込口）
export function getConnectors(market: Market): DataSourceConnector[] {
  if (market === "JP") {
    // gBizINFO のトークンが投入されていれば、公式の実データ源を先頭に追加する。
    // （未設定ならモックのみ。＝クライアントがトークンを入れるだけで本物に切り替わる）
    return gbizEnabled() ? [gbizConnector, ...JP_CONNECTORS] : JP_CONNECTORS;
  }
  return GLOBAL_CONNECTORS;
}

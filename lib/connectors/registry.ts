// コネクタ・レジストリ（データ取得先の一覧と、市場ごとの選定）。
//
// このファイルの役割：
//   市場（JP / GLOBAL）に応じて「どの取得先を使うか」を返し、各取得先が
//   企業プールから“自分が見つけられる範囲”の候補を返します。
//   ・取得先ごとに担当範囲を変える → 重複と、取りこぼしの補完（Recall向上）を再現
//   ・取得先ごとに埋める項目を変える（地図は電話、求人はシグナル、サイトはメール等）
//     → 後段の名寄せで「最も良い値」を採用する様子を再現
//   実データ源（LinkedIn/求人API/地図API等）へ差し替える際は、この形に合わせるだけ。

import type { Market } from "@/lib/domain/types";
import type { DataSourceConnector, LeadCandidate, ConnectorSearchInput } from "./types";
import { generateCompanyPool, stableFraction, type PoolCompany } from "@/lib/mock/pool";
import { gbizConnector, gbizEnabled } from "./gbizinfo";

// どの項目を埋めるコネクタか（部分データを再現するための指定）
interface FieldProfile {
  email?: boolean;
  phone?: boolean;
  signal?: boolean;
  funding?: boolean;
  tech?: boolean;
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
  return {
    companyName: c.companyName,
    domain: c.domain,
    email: fields.email ? c.email : undefined,
    phone: fields.phone ? c.phone : undefined,
    address: c.city,
    location: c.city,
    industry: icp.industry,
    category: icp.industry,
    size: c.size,
    headcount: c.headcount,
    funding: fields.funding ? c.funding : undefined,
    signals: icp.signals,
    buyingSignal: fields.signal ? c.buyingSignal : undefined,
    enrichment: fields.tech ? { techStack: c.techStack, website: `https://${c.domain}` } : {},
    fitScore: c.fitScore,
    source: {
      connectorId,
      label,
      url: `https://${connectorId}.example/${c.domain}`,
      snippet: `${c.companyName} — ${icp.industry} / ${c.city}`,
    },
    fetchedAt: now,
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
  return {
    id: opts.id,
    label: opts.label,
    markets: opts.markets,
    costPerCall: opts.costPerCall,
    async search(input: ConnectorSearchInput): Promise<LeadCandidate[]> {
      const now = Date.now();
      // 目標件数より多めのプールを作り、その中から担当分だけ返す（→ コネクタ間で重複が出る）
      const pool = generateCompanyPool(input.icp, input.planId, Math.max(input.count + 12, 24));
      const found: LeadCandidate[] = [];
      for (const c of pool) {
        // ドメイン＋offset から安定した値を作り、coverage 未満なら「このコネクタが見つけた」とする
        const f = stableFraction(c.domain + opts.offset);
        if (f < opts.coverage) {
          found.push(toCandidate(c, input.icp, opts.id, opts.label, opts.fields, now));
        }
      }
      return found;
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

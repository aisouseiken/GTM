// 決定的モック・リード生成器
// 実データソースAPI接続前（MOCK_MODE）に、現実的なリードを再現性ありで生成する。
// 同じ検索プラン → 同じ結果（seed をプラン内容から決定）。

import type { Lead, LeadSource, StructuredICP } from "@/lib/domain/types";
import { id } from "@/lib/data/store";

// ---- 決定的乱数（seed から）----
function seedFrom(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JP_PREFIX = [
  "株式会社", "有限会社", "合同会社", "", "", "",
];
const JP_CORE = [
  "サンライズ", "みらい", "つなぐ", "青葉", "大和", "こだま", "光和", "アオゾラ",
  "ヒカリ", "結", "山本", "田中", "さくら", "宮本", "北斗", "陽和", "翔",
  "しらかば", "森本", "松風",
];
const JP_SUFFIX = [
  "工業", "商事", "製作所", "システムズ", "クリニック", "歯科", "デンタル",
  "建設", "サービス", "テック", "メディカル", "興業", "物流", "食品",
];
const JP_CITY = [
  "東京都渋谷区", "東京都新宿区", "大阪市北区", "名古屋市中区", "福岡市博多区",
  "横浜市西区", "札幌市中央区", "京都市下京区", "神戸市中央区", "仙台市青葉区",
];

const GLOBAL_CORE = [
  "Northwind", "Brightline", "Cedar", "Vertex", "Harbor", "Lumen", "Quill",
  "Summit", "Meridian", "Atlas", "Ironwood", "Beacon", "Copper", "Delta",
  "Everest", "Foundry", "Granite", "Halcyon", "Juniper", "Kestrel",
];
const GLOBAL_SUFFIX = [
  "Labs", "Health", "Systems", "Dental", "Group", "Works", "Tech", "Digital",
  "Partners", "HVAC", "Clinic", "Logistics", "Foods", "Solutions",
];
const GLOBAL_CITY = [
  "Austin, TX", "Miami, FL", "Denver, CO", "Seattle, WA", "Chicago, IL",
  "Boston, MA", "Atlanta, GA", "Phoenix, AZ", "Portland, OR", "Nashville, TN",
];

const FUNDING = ["—", "Seed", "Series A $8M", "Series B $30M", "Series A ¥5億", "Bootstrapped", "Series C $80M"];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function domainFrom(name: string, i: number): string {
  const ascii = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 12);
  const base = ascii.length >= 3 ? ascii : `company${i}`;
  return `${base}${i}.example.com`;
}

function buyingSignalFor(icp: StructuredICP, rng: () => number): string {
  const jp = icp.market === "JP";
  const pool = icp.signals.length
    ? icp.signals
    : jp
      ? ["採用強化中", "新規開業", "広告出稿中"]
      : ["Hiring SDRs", "Recently funded", "Running ads"];
  const s = pick(rng, pool);
  const extra = jp
    ? ["（今月）", "（3名募集）", "（拠点拡大）", ""]
    : [" (this month)", " (3 roles)", " (new location)", ""];
  return `${s}${pick(rng, extra)}`;
}

// 検索プランに対する決定的リード生成
export function generateLeads(
  icp: StructuredICP,
  workspaceId: string,
  jobId: string,
  count: number,
  planId: string
): Lead[] {
  const jp = icp.market === "JP";
  const rng = mulberry32(seedFrom(planId + icp.industry + icp.location + count));
  const leads: Lead[] = [];

  for (let i = 0; i < count; i++) {
    const name = jp
      ? `${pick(rng, JP_PREFIX)}${pick(rng, JP_CORE)}${pick(rng, JP_SUFFIX)}`
      : `${pick(rng, GLOBAL_CORE)} ${pick(rng, GLOBAL_SUFFIX)}`;
    const domain = domainFrom(name, i + 1);
    const city = jp ? pick(rng, JP_CITY) : pick(rng, GLOBAL_CITY);
    const headcount = 5 + Math.floor(rng() * 480);
    const category = icp.industry;

    // fit score: 上位ほど高い（ソート済みに見えるよう i に応じ減衰＋揺らぎ）
    const base = 98 - Math.floor((i / Math.max(count, 1)) * 42);
    const fitScore = Math.max(52, Math.min(99, base + Math.floor(rng() * 6 - 3)));

    const hasEmail = rng() > 0.12;
    const hasPhone = rng() > 0.28;
    const emailUser = jp ? "info" : pick(rng, ["hello", "info", "sales", "contact"]);
    const email = hasEmail ? `${emailUser}@${domain}` : undefined;
    const phone = hasPhone
      ? jp
        ? `0${3 + Math.floor(rng() * 6)}-${1000 + Math.floor(rng() * 8999)}-${1000 + Math.floor(rng() * 8999)}`
        : `+1 ${200 + Math.floor(rng() * 799)}-${100 + Math.floor(rng() * 899)}-${1000 + Math.floor(rng() * 8999)}`
      : undefined;

    const sources: LeadSource[] = [];
    const srcPool = jp
      ? [
          { connectorId: "maps_jp", label: "地図検索", url: `https://maps.example/${domain}` },
          { connectorId: "jobs_jp", label: "求人サイト", url: `https://job.example/${domain}` },
          { connectorId: "houjin", label: "法人番号", url: `https://houjin.example/${domain}` },
          { connectorId: "site", label: "企業サイト", url: `https://${domain}` },
        ]
      : [
          { connectorId: "maps", label: "Google Maps", url: `https://maps.example/${domain}` },
          { connectorId: "jobs", label: "Job Boards", url: `https://job.example/${domain}` },
          { connectorId: "linkedin", label: "LinkedIn", url: `https://li.example/${domain}` },
          { connectorId: "site", label: "Website", url: `https://${domain}` },
        ];
    const nSources = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < nSources; s++) {
      const sp = srcPool[s];
      sources.push({ ...sp, snippet: `${name} — ${category} / ${city}` });
    }

    const buyingSignal = buyingSignalFor(icp, rng);

    leads.push({
      id: id("lead"),
      workspaceId,
      jobId,
      companyName: name,
      domain,
      email,
      phone,
      address: city,
      location: city,
      industry: icp.industry,
      category,
      size: headcount < 20 ? "1-20" : headcount < 100 ? "20-100" : "100-500",
      headcount,
      funding: pick(rng, FUNDING),
      signals: icp.signals,
      buyingSignal,
      enrichment: {
        website: `https://${domain}`,
        techStack: jp ? pick(rng, ["予約システム", "ECカート", "MAツール", "—"]) : pick(rng, ["Shopify", "HubSpot", "Segment", "—"]),
      },
      fitScore,
      confidence: 0, // 検証で後から確定
      verifications: [],
      sources,
      status: "new",
      createdAt: Date.now(),
    });
  }

  return leads.sort((a, b) => b.fitScore - a.fitScore);
}

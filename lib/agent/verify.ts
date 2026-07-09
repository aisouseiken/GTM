// 多段ウォーターフォール検証 + 信頼度スコア（設計書 08 精度向上戦略）
// MOCK_MODE では決定的に判定。実検証API（メール/電話）は最終フェーズで差し替え。

import type { Lead, LeadVerification, VerificationResult } from "@/lib/domain/types";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const EMAIL_PROVIDERS = ["syntax", "mx", "smtp-A", "smtp-B"];
const PHONE_PROVIDERS = ["format", "carrier", "line-type"];

function resultFromScore(score: number): VerificationResult {
  if (score >= 80) return "valid";
  if (score >= 55) return "risky";
  if (score > 0) return "invalid";
  return "unknown";
}

// メール検証：ウォーターフォール（確度が閾値超で確定、以降スキップ）
function verifyEmail(email: string): LeadVerification[] {
  const out: LeadVerification[] = [];
  const base = hash(email);
  let score = 40 + Math.floor(base * 60); // 40-99
  // catch-all っぽいドメインは減点（決定的）
  if (base < 0.15) score -= 30;
  for (const provider of EMAIL_PROVIDERS) {
    out.push({ field: "email", provider, result: resultFromScore(score), score: Math.max(0, score) });
    if (score >= 82) break; // 閾値超えたら以降の段はスキップ
    score += 6; // 次段でさらに裏取り
  }
  return out;
}

function verifyPhone(phone: string): LeadVerification[] {
  const out: LeadVerification[] = [];
  const base = hash(phone);
  let score = 45 + Math.floor(base * 55);
  for (const provider of PHONE_PROVIDERS) {
    out.push({ field: "phone", provider, result: resultFromScore(score), score: Math.max(0, score) });
    if (score >= 80) break;
    score += 8;
  }
  return out;
}

function fieldScore(vs: LeadVerification[], field: "email" | "phone"): number {
  const rel = vs.filter((v) => v.field === field);
  if (!rel.length) return 0;
  return Math.max(...rel.map((v) => v.score));
}

export interface VerifyOutcome {
  lead: Lead;
  creditsUsed: number; // 成功した検証のみ課金
}

// リード1件を検証し、信頼度スコアを確定。成功分のみ課金対象を返す。
export function verifyLead(lead: Lead): VerifyOutcome {
  const verifications: LeadVerification[] = [];
  let credits = 0;

  if (lead.email) {
    const vs = verifyEmail(lead.email);
    verifications.push(...vs);
    if (fieldScore(vs, "email") >= 55) credits += 1; // マッチ成功時のみ課金
  }
  if (lead.phone) {
    const vs = verifyPhone(lead.phone);
    verifications.push(...vs);
    if (fieldScore(vs, "phone") >= 55) credits += 1;
  }

  const emailS = fieldScore(verifications, "email");
  const phoneS = fieldScore(verifications, "phone");

  // 総合信頼度：fitScore(0.3) + emailスコア(0.45) + phoneスコア(0.25) の加重
  const confidence = Math.round(
    lead.fitScore * 0.3 +
      emailS * 0.45 +
      phoneS * 0.25
  );

  return {
    lead: { ...lead, verifications, confidence: Math.max(0, Math.min(100, confidence)) },
    creditsUsed: credits,
  };
}

export function confidenceTier(score: number): "high" | "mid" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "mid";
  return "low";
}

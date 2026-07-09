// 最新化（freshness）＝データの鮮度を管理する仕組み。
//
// このファイルの役割：
//   同じ条件の検索を繰り返したとき、毎回ゼロから取り直すのはムダで遅い。
//   そこで一度取得した候補を「署名（条件のハッシュ）」ごとに一定時間キャッシュし、
//   ・新鮮（TTL以内）ならキャッシュを再利用（速い・原価節約）
//   ・古ければ取り直す（＝最新化）
//   という判断を行う。TTL＝Time To Live（有効な寿命）。

import type { StructuredICP } from "@/lib/domain/types";
import type { LeadCandidate } from "@/lib/connectors/types";

// キャッシュの寿命（ミリ秒）。ここでは6時間を「新鮮」とみなす。
const TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  candidates: LeadCandidate[];
  fetchedAt: number; // いつ取得したか
}

// HMRでも消えないようグローバルに保持
const g = globalThis as unknown as { __gtmFresh?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = (g.__gtmFresh ??= new Map());

// 検索条件から一意の「署名」を作る。
// ★重要：先頭に workspaceId を必ず含める。これが無いと、あるワークスペースのキャッシュが
//   別のワークスペース（＝別の利用者）に返ってしまい、情報漏洩・誤課金になる。
//   さらに元プロンプト(raw)も含めて、似た条件どうしの取り違え（衝突）を防ぐ。
export function signatureOf(workspaceId: string, icp: StructuredICP, count: number): string {
  return [
    workspaceId, // ← 利用者ごとに必ず分離する
    icp.market,
    icp.industry,
    icp.location,
    [...icp.signals].sort().join(","),
    icp.raw.trim(), // 元の入力文も含めて取り違えを防ぐ
    count,
  ].join("|");
}

// 新鮮なキャッシュがあれば候補を返す。無い/古いなら null（＝取り直しが必要）。
export function getFreshCandidates(signature: string): LeadCandidate[] | null {
  const entry = cache.get(signature);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  if (age > TTL_MS) return null; // 寿命切れ → 古いので使わない
  return entry.candidates;
}

// 取得した候補をキャッシュに保存する
export function setCandidates(signature: string, candidates: LeadCandidate[]): void {
  cache.set(signature, { candidates, fetchedAt: Date.now() });
}

// キャッシュの鮮度（分）を返す（画面表示や説明用）。無ければ null。
export function cacheAgeMinutes(signature: string): number | null {
  const entry = cache.get(signature);
  if (!entry) return null;
  return Math.floor((Date.now() - entry.fetchedAt) / 60000);
}

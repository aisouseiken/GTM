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

// キャッシュ（一時保存）の寿命（ミリ秒）。ここでは6時間を「新鮮」とみなす。
// 6（時間）× 60（分）× 60（秒）× 1000（ミリ秒）を掛け算して6時間分のミリ秒数にしている。
const TTL_MS = 6 * 60 * 60 * 1000;

// キャッシュに1件分としてしまっておく中身の形。
interface CacheEntry {
  candidates: LeadCandidate[]; // その条件で見つかった候補（会社の候補リスト）
  fetchedAt: number; // いつ取得したか（時刻を数値で記録し、後で古さを計算する）
}

// HMR（開発中にコードを保存すると自動で再読み込みされる仕組み）でも消えないよう、
// アプリ全体で共有される場所（グローバル）にキャッシュ置き場を持たせる。
const g = globalThis as unknown as { __gtmFresh?: Map<string, CacheEntry> };
// すでに置き場があればそれを使い、無ければ新しく空の入れ物（Map＝キーと値の対応表）を作る。
const cache: Map<string, CacheEntry> = (g.__gtmFresh ??= new Map());

// 検索条件から一意の「署名」を作る。
// ★重要：先頭に workspaceId を必ず含める。これが無いと、あるワークスペースのキャッシュが
//   別のワークスペース（＝別の利用者）に返ってしまい、情報漏洩・誤課金になる。
//   さらに元プロンプト(raw)も含めて、似た条件どうしの取り違え（衝突）を防ぐ。
export function signatureOf(workspaceId: string, icp: StructuredICP, count: number): string {
  // 下の項目を順番に並べ、最後に「|」でつないで1本の文字列（＝署名）にする。
  return [
    workspaceId, // ← 利用者（ワークスペース）ごとに必ず分離する
    icp.market, // 対象市場（日本 or グローバル）
    icp.industry, // 業種
    icp.location, // 地域
    [...icp.signals].sort().join(","), // シグナル一覧を並び替えて連結（順番違いで別物と誤判定しないように揃える）
    icp.raw.trim(), // 元の入力文も含めて取り違え（衝突）を防ぐ。trim＝前後の余分な空白を除く
    count, // 目標件数（件数が違えば別条件として扱う）
  ].join("|"); // 各項目を「|」で区切ってひとつの署名文字列にまとめる
}

// 新鮮なキャッシュがあれば候補を返す。無い/古いなら null（＝取り直しが必要）。
export function getFreshCandidates(signature: string): LeadCandidate[] | null {
  const entry = cache.get(signature); // 署名をキーにキャッシュを探す
  if (!entry) return null; // そもそも保存が無ければ「取り直し必要」を意味する null を返す
  const age = Date.now() - entry.fetchedAt; // 取得してから今まで何ミリ秒経ったか（＝古さ）を計算
  if (age > TTL_MS) {
    // 寿命（6時間）を超えていたら古すぎるので使わない
    cache.delete(signature); // ★寿命切れは削除（メモリ肥大防止）
    return null; // 古かったので「取り直し必要」を返す
  }
  return entry.candidates; // まだ新鮮なので、保存しておいた候補をそのまま返す
}

// 取得した候補をキャッシュに保存する
export function setCandidates(signature: string, candidates: LeadCandidate[]): void {
  // ★メモリ肥大防止：エントリ（保存件数）が増えすぎたら、期限切れを掃除する（それでも多ければ全消し）
  if (cache.size > 5000) {
    const now = Date.now(); // 現在時刻を1回だけ取って使い回す
    // 保存済みを全部見て、寿命を超えた古いものだけ削除する
    for (const [k, v] of cache) if (now - v.fetchedAt > TTL_MS) cache.delete(k);
    // 掃除してもまだ5000件を超えるなら、思い切って全部消してリセットする
    if (cache.size > 5000) cache.clear();
  }
  // 今回の候補を、取得時刻（現在時刻）を添えてキャッシュに保存する
  cache.set(signature, { candidates, fetchedAt: Date.now() });
}

// キャッシュの鮮度（分）を返す（画面表示や説明用）。無ければ null。
export function cacheAgeMinutes(signature: string): number | null {
  const entry = cache.get(signature); // 署名でキャッシュを探す
  if (!entry) return null; // 無ければ「鮮度不明」として null を返す
  // 経過ミリ秒 ÷ 60000（1分＝60000ミリ秒）で「何分前か」を求める。端数は切り捨て。
  return Math.floor((Date.now() - entry.fetchedAt) / 60000);
}

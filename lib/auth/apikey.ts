// APIキー（外部プログラムからこのサービスを使うための鍵）の発行・照合を行うファイル。
// 大事な考え方：生の鍵はそのまま保存せず、ハッシュ化（元に戻せない変換）した値だけを保存する。
// こうすると、万一保存データが漏れても本物の鍵は分からず、安全性が高まる。
// ハッシュ＝入力を一方向に変換した固定長の文字列。同じ入力なら必ず同じ結果になる。

// crypto（暗号）＝Node.js に最初から入っている暗号の道具箱。
// createHash＝ハッシュ化（元に戻せない変換）を行う道具、randomBytes＝推測できないランダムな値を作る道具。
import { createHash, randomBytes } from "crypto";
// データ保管庫（store）から、ID生成・APIキー保存・ハッシュでのキー検索の機能を借りてくる。
import { id, saveApiKey, findApiKeyByHash } from "@/lib/data/store";
// APIキーと、ワークスペース（利用者の作業場）の「データの形（型）」の定義を借りてくる。
import type { ApiKey, Workspace } from "@/lib/domain/types";

// 生の鍵文字列を SHA-256 でハッシュ化して16進数文字列で返す（照合や保存に使う）。
// SHA-256＝入力を必ず同じ長さの文字列に変換する代表的なハッシュ方式。
export function hashKey(raw: string): string {
  // 生の鍵(raw)を受け取り → ハッシュ計算し → 16進数(hex)の文字列にして返す、を1行でつなげている。
  return createHash("sha256").update(raw).digest("hex");
}

// 新規APIキー発行。生キーは発行時のみ返す（保存はハッシュのみ）。
// 引数：workspaceId=どの作業場のキーか、name=キーの用途名。返り値：キー情報と生キーの組。
export function issueApiKey(workspaceId: string, name: string): { apiKey: ApiKey; raw: string } {
  // ランダムな生キーを作る（"gtm_sk_" は接頭辞、その後ろに推測困難な48文字を付ける）
  // randomBytes(24)=24バイトのランダム値、それを16進数にすると48文字になる。
  const raw = "gtm_sk_" + randomBytes(24).toString("hex");
  // 保存用のAPIキー情報（型 ApiKey に沿った入れ物）を組み立てる。
  const apiKey: ApiKey = {
    id: id("key"), // このキー自体を識別するID（"key_" で始まる）
    workspaceId, // どのワークスペース（作業場）に属するキーか
    name: name || "API Key", // 名前が空なら既定名
    keyPreview: raw.slice(0, 12) + "…", // 表示用に先頭12文字だけ見せる（全体は見せない）
    keyHash: hashKey(raw), // 保存するのはハッシュ値だけ
    createdAt: Date.now(), // 発行した時刻（現在時刻をミリ秒の数値で記録）
  };
  saveApiKey(apiKey); // ハッシュ入りのキー情報を保存
  return { apiKey, raw }; // 生キー(raw)はこの瞬間だけ返す（あとで再取得は不可）
}

// 受け取った生キーが有効かを照合する。ハッシュ化して一致する登録済みキーを探して返す。
// 見つかれば ApiKey を、無ければ undefined（該当なし）を返す。
export function resolveApiKey(raw: string | null): ApiKey | undefined {
  if (!raw) return undefined; // キーが無ければ該当なし
  return findApiKeyByHash(hashKey(raw)); // ハッシュで突き合わせて探す
}

// HTTPリクエストの Authorization ヘッダーから "Bearer 〈鍵〉" 形式の鍵部分を取り出す。
// Bearer トークン＝リクエストヘッダーに鍵を添えて本人確認する一般的な方式。
// ヘッダー＝リクエストに添える付箋のような追加情報。ここに認証用の鍵を入れて送る。
export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization") || ""; // ヘッダー値を取得（無ければ空文字）
  const m = h.match(/^Bearer\s+(.+)$/i); // "Bearer " に続く部分を抜き出す（大文字小文字は区別しない）
  return m ? m[1] : null; // 抜き出せた鍵を返す。無ければ null
}

// Workspace 型を、このファイルを使う他の場所からも参照できるように再公開（re-export）する。
export type { Workspace };

// Gemini（GoogleのAI）で、自然文から検索条件（構造化ICP）を読み取るアダプタ。
//
// このファイルの役割：
//   ユーザーの入力文（例:「東京都の23区内でラーメン店を全てリストアップして」）を Gemini に渡し、
//   「業種・地域・市場・買い手シグナル」に整理して返してもらいます。
//   これまでのルールベース（キーワード当てはめ）より賢く、言い回しの揺れや未知の業種にも対応できます。
//
//   ・環境変数 GEMINI_API_KEY があれば有効。無ければ null を返し、呼び出し側が従来のルールベースに戻ります。
//   ・Google AI Studio(https://aistudio.google.com/) で無料のAPIキーを発行できます（無料枠あり）。
//   ・失敗（通信エラー・想定外の応答）時も null を返して安全にフォールバックします。

import type { Market, StructuredICP } from "@/lib/domain/types";

// Gemini のモデル名（環境変数で上書き可。既定は無料枠で使える高速モデル）。
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Gemini の問い合わせ先URLを組み立てる（key＝APIキー＝利用許可の鍵）。
function endpoint(key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

// GEMINI_API_KEY が設定されているか（＝AI抽出を使える状態か）。
export function geminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Gemini から返ってくるJSONの形（必要な項目だけ緩く定義。?付きは「無いこともある」）。
interface GeminiICP {
  industry?: string; // 業種の日本語ラベル
  industryKeywords?: string[]; // 業種の言い換え候補
  location?: string; // 地域
  market?: string; // "JP" か "GLOBAL"
  signals?: string[]; // 買い手シグナル
  sizeHint?: string; // 規模のヒント
}

// 入力文を Gemini に渡し、構造化ICP（整理された顧客像）にして返す。失敗時は null。
export async function geminiExtractICP(
  prompt: string,
  marketDefault: Market
): Promise<StructuredICP | null> {
  const key = process.env.GEMINI_API_KEY; // 環境変数からAPIキーを読む
  if (!key) return null; // 未設定なら使わない（呼び出し側がルールベースへ）

  // Gemini への指示文。JSONだけを返すように明確に指定する。
  const instruction = `あなたはB2B営業のリスト作成アシスタントです。
次のユーザーの要望文を読み、企業リストの検索条件をJSONで抽出してください。JSON以外は出力しないこと。
キーと意味:
- industry: 業種の日本語ラベル（例:「ラーメン店」「歯科・デンタル」「SaaS・ソフトウェア」）。不明なら「企業全般」。
- industryKeywords: 業種の言い換え・関連語を3〜5個の配列（検索を広げるため）。
- location: 地域名（例:「東京」「大阪」「United States」）。不明なら空文字。
- market: 日本向けなら "JP"、海外向けなら "GLOBAL"。
- signals: 買い手の兆しの配列。使える値の例:「採用強化中」「資金調達済み」「広告出稿中」「新規開業」「事業拡大中」。該当なければ空配列。
- sizeHint: 従業員規模などのヒント。無ければ空文字。
要望文: """${prompt}"""`;

  try {
    // Gemini に問い合わせる（fetch＝ネット越しに送受信、await＝返答を待つ）。
    // ★8秒でタイムアウト（signal）。無応答でリクエストが無限に固まるのを防ぐ。
    //   タイムアウト時は下の catch に入り null を返す＝ルールベースへ自動フォールバックする。
    const res = await fetch(endpoint(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: instruction }] }],
        // responseMimeType=JSONで返させる、temperature=低めで安定した抽出にする。
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null; // エラー応答なら諦めてフォールバック
    const data = await res.json(); // 返答をJSONとして読む
    // Gemini の返答テキスト（ここに抽出結果のJSON文字列が入っている）を取り出す。
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null; // テキストが無ければフォールバック
    const parsed = JSON.parse(text) as GeminiICP; // テキスト（JSON文字列）をオブジェクトに変換

    // 受け取った値を、このアプリで使う形（StructuredICP）に整える。欠けていれば無難な既定値を入れる。
    const market: Market =
      parsed.market === "GLOBAL" ? "GLOBAL" : parsed.market === "JP" ? "JP" : marketDefault;
    const industry = (parsed.industry || "").trim() || "企業全般";
    const industryKeywords =
      Array.isArray(parsed.industryKeywords) && parsed.industryKeywords.length
        ? parsed.industryKeywords.slice(0, 6).map(String) // 多すぎる場合は6個までに制限
        : [industry];
    const location =
      (parsed.location || "").trim() || (market === "JP" ? "日本全国" : "United States");
    const signals = Array.isArray(parsed.signals) ? parsed.signals.slice(0, 6).map(String) : [];

    return {
      industry, // 業種ラベル
      industryKeywords, // 言い換え候補
      location, // 地域
      market, // 市場（JP/GLOBAL）
      signals, // 買い手シグナル
      sizeHint: parsed.sizeHint ? String(parsed.sizeHint) : undefined, // 規模ヒント（あれば）
      raw: prompt, // 元の入力文
    };
  } catch {
    return null; // JSON崩れ・通信エラー等は null（＝ルールベースに任せる）
  }
}

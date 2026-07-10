// gBizINFO（経済産業省の法人情報API）実コネクタ。
//
// このファイルの役割：
//   日本の法人情報を無料で取得できる公式API「gBizINFO」を叩いて、実在の企業を返します。
//   環境変数 GBIZINFO_API_TOKEN が設定されていれば有効になり、無ければ使われません（モックのまま）。
//   → クライアントが無料トークンを登録して投入するだけで、本物の企業データに切り替わる“準備済み”実装です。
//
//   ※ gBizINFO は主に企業名・所在地・法人番号などの公開情報を返します（メール/電話は基本含みません）。
//     連絡先は別途の検証・エンリッチ工程で補います（設計どおり）。

import type { DataSourceConnector, LeadCandidate, ConnectorSearchInput } from "./types";

const ENDPOINT = "https://info.gbiz.go.jp/hojin/v1/hojin";

// gBizINFO のトークンが設定されているか
export function gbizEnabled(): boolean {
  return !!process.env.GBIZINFO_API_TOKEN;
}

// gBizINFO のレスポンス（必要な項目だけ緩く型定義）
interface GbizHojin {
  corporate_number?: string;
  name?: string;
  location?: string;
  business_summary?: string;
}

export const gbizConnector: DataSourceConnector = {
  id: "gbizinfo",
  label: "法人番号(gBizINFO・公式)",
  markets: ["JP"],
  costPerCall: 0, // 公式・無料
  async search(input: ConnectorSearchInput): Promise<LeadCandidate[]> {
    const token = process.env.GBIZINFO_API_TOKEN;
    if (!token) return []; // トークン未設定なら何も返さない（registry側でモックが使われる）

    // 業種キーワードを検索名に使う（gBizINFOは名称・所在地などで絞り込み可能）
    const q = new URLSearchParams({
      name: input.icp.industry,
      limit: String(Math.min(input.count, 20)),
    });

    try {
      const res = await fetch(`${ENDPOINT}?${q.toString()}`, {
        headers: { "X-hojinInfo-api-token": token, Accept: "application/json" },
        // 外部APIが遅い/落ちていてもアプリを止めないよう、失敗は握りつぶす
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { "hojin-infos"?: GbizHojin[] };
      const infos = data["hojin-infos"] ?? [];
      const now = Date.now();

      return infos.slice(0, input.count).map((h, i) => {
        const name = h.name ?? `法人${i + 1}`;
        const domain = `houjin-${h.corporate_number ?? i}.example.jp`; // 実運用ではサイト探索で補完
        const enrichment: Record<string, string> = {};
        if (h.business_summary) enrichment.summary = h.business_summary;
        return {
          companyName: name,
          domain,
          location: h.location ?? "日本",
          industry: input.icp.industry,
          category: input.icp.industry,
          signals: input.icp.signals,
          enrichment,
          fitScore: 80, // スコアは後段でICP適合を再計算
          source: {
            connectorId: "gbizinfo",
            label: "gBizINFO",
            url: `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${h.corporate_number ?? ""}`,
            snippet: `${name} — ${h.location ?? ""}`,
          },
          fetchedAt: now,
        };
      });
    } catch {
      return []; // ネットワークエラー等は空で返し、他のコネクタ/モックに任せる
    }
  },
};

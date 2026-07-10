// gBizINFO（経済産業省の法人情報API）実コネクタ。
//
// このファイルの役割：
//   日本の法人情報を無料で取得できる公式API「gBizINFO」を叩いて、実在の企業を返します。
//   環境変数 GBIZINFO_API_TOKEN が設定されていれば有効になり、無ければ使われません（モックのまま）。
//   → クライアントが無料トークンを登録して投入するだけで、本物の企業データに切り替わる“準備済み”実装です。
//
//   ※ gBizINFO は主に企業名・所在地・法人番号などの公開情報を返します（メール/電話は基本含みません）。
//     連絡先は別途の検証・エンリッチ工程で補います（設計どおり）。

// コネクタ（データ取得先）の共通の「データの形（型）」を借りる。
// DataSourceConnector=取得先の契約、LeadCandidate=見つけた企業1件、ConnectorSearchInput=検索条件。
import type { DataSourceConnector, LeadCandidate, ConnectorSearchInput } from "./types";

// gBizINFO の問い合わせ先URL（法人情報を取得するAPIの住所）。
const ENDPOINT = "https://info.gbiz.go.jp/hojin/v1/hojin";

// gBizINFO のトークンが設定されているか
// !! は「値があれば true / 無ければ false」に変換する書き方。トークン(利用許可の鍵)の有無を返す。
export function gbizEnabled(): boolean {
  return !!process.env.GBIZINFO_API_TOKEN;
}

// gBizINFO のレスポンス（必要な項目だけ緩く型定義）
// レスポンス＝APIからの返答。?付きは「無いこともある項目」を表す。
interface GbizHojin {
  corporate_number?: string; // 法人番号（国が企業に割り振る13桁の番号）
  name?: string; // 法人名（会社名）
  location?: string; // 所在地
  business_summary?: string; // 事業内容の要約
}

// gBizINFO 用のコネクタ本体（この形＝DataSourceConnector に合わせて実装）。
export const gbizConnector: DataSourceConnector = {
  id: "gbizinfo", // このコネクタの識別子
  label: "法人番号(gBizINFO・公式)", // 画面表示用の名前
  markets: ["JP"], // 対応市場は日本のみ
  costPerCall: 0, // 公式・無料
  // 実際に企業を探しにいく処理（async＝時間のかかる通信を待てる関数）。
  async search(input: ConnectorSearchInput): Promise<LeadCandidate[]> {
    const token = process.env.GBIZINFO_API_TOKEN; // 環境変数から利用許可の鍵を読む
    if (!token) return []; // トークン未設定なら何も返さない（registry側でモックが使われる）

    // 業種キーワードを検索名に使う（gBizINFOは名称・所在地などで絞り込み可能）
    // URLSearchParams＝URLの「?key=value」部分を組み立てる道具。
    const q = new URLSearchParams({
      name: input.icp.industry, // 探したい業種を検索名として渡す
      limit: String(Math.min(input.count, 20)), // 取得件数（多くても20件までに制限）
    });

    // try＝失敗するかもしれない通信を試す。失敗したら下の catch に飛ぶ。
    try {
      // 組み立てたURLへ問い合わせる（fetch＝インターネット越しにデータを取りにいく）。await＝返答を待つ。
      const res = await fetch(`${ENDPOINT}?${q.toString()}`, {
        headers: { "X-hojinInfo-api-token": token, Accept: "application/json" }, // 鍵を添え、JSON形式で欲しいと伝える
        // 外部APIが遅い/落ちていてもアプリを止めないよう、失敗は握りつぶす
      });
      if (!res.ok) return []; // 応答が正常でなければ（エラー）空で返す
      const data = (await res.json()) as { "hojin-infos"?: GbizHojin[] }; // 返答をJSON（データ形式）として読み取る
      const infos = data["hojin-infos"] ?? []; // 企業一覧を取り出す（無ければ空の配列）
      const now = Date.now(); // 取得時刻（現在時刻）を1回だけ用意して全件で使い回す

      // 取得した企業を、必要件数だけ選んで、このアプリ共通の「候補」の形に変換する。
      return infos.slice(0, input.count).map((h, i) => {
        const name = h.name ?? `法人${i + 1}`; // 会社名（無ければ連番の仮名）
        const domain = `houjin-${h.corporate_number ?? i}.example.jp`; // 実運用ではサイト探索で補完
        const enrichment: Record<string, string> = {}; // 追加情報の入れ物（最初は空）
        if (h.business_summary) enrichment.summary = h.business_summary; // 事業要約があれば追加情報に入れる
        return {
          companyName: name, // 会社名
          domain, // 会社のドメイン（仮の値）
          location: h.location ?? "日本", // 所在地（無ければ「日本」）
          industry: input.icp.industry, // 業種（検索条件のものを設定）
          category: input.icp.industry, // カテゴリ（ここでは業種と同じ）
          signals: input.icp.signals, // 買い手シグナル（検索条件のものを引き継ぐ）
          enrichment, // 上で作った追加情報
          fitScore: 80, // スコアは後段でICP適合を再計算
          source: { // この企業をどこから見つけたか（出典）
            connectorId: "gbizinfo", // 見つけたコネクタの識別子
            label: "gBizINFO", // 出典の表示名
            url: `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${h.corporate_number ?? ""}`, // 元情報のURL
            snippet: `${name} — ${h.location ?? ""}`, // 抜粋（会社名と所在地）
          },
          fetchedAt: now, // 取得時刻
        };
      });
    } catch {
      return []; // ネットワークエラー等は空で返し、他のコネクタ/モックに任せる
    }
  },
};

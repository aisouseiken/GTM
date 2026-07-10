// コネクタ（データ取得先）の共通インターフェース。
//
// このファイルの役割：
//   「企業リストをどこから取ってくるか」を統一の形で扱うための“契約”を定義します。
//   Googleマップ・求人サイト・企業DBなど、実際の取得先はこの形に合わせて実装すれば
//   バックエンド本体（runner）から同じ手順で呼び出せます（＝差し替え可能）。
//   いまは MOCK（モック＝本物そっくりの偽物）で動かし、最終フェーズで実データ源に差し替えます。

// 出典・市場・構造化ICP（整理された理想の顧客像）の「データの形（型）」を借りる。
import type { LeadSource, Market, StructuredICP } from "@/lib/domain/types";

// 1件の「候補」＝あるコネクタが見つけた企業の断片情報。
// 各コネクタは自分が分かる項目だけを埋める（例：地図は電話に強い、求人はシグナルに強い等）。
// 後段の「名寄せ（resolve）」で、同じ会社の候補どうしを1社に統合する。
export interface LeadCandidate {
  companyName: string; // 会社名
  domain: string; // 名寄せの主キー（会社の同一判定に使う）
  email?: string; // メールアドレス（見つかったコネクタだけ埋める）
  phone?: string; // 電話番号（見つかったコネクタだけ埋める）
  address?: string; // 住所（任意）
  location: string; // 所在地
  industry: string; // 業種
  category: string; // カテゴリ（業種の細分類など）
  size?: string; // 企業規模の目安
  headcount?: number; // 従業員数
  funding?: string; // 資金調達状況
  signals: string[]; // 買い手シグナルの一覧
  buyingSignal?: string; // 代表的な買い手シグナル
  enrichment: Record<string, string>; // 追加で補強した情報（キーと値の組）
  fitScore: number; // ICP適合スコア（後段でもう一度整える）
  source: LeadSource; // このコネクタ由来という出典
  fetchedAt: number; // このコネクタが取得した時刻（鮮度）
}

// コネクタに渡す検索条件。
export interface ConnectorSearchInput {
  icp: StructuredICP; // 構造化された理想顧客像
  count: number; // 目標件数
  planId: string; // 検索プランID（決定的生成のシード）
}

// データ取得先1つ分の“接続口”。実装はこの形に合わせる。
export interface DataSourceConnector {
  id: string; // 識別子（例: "maps_jp"）
  label: string; // 画面表示名（例: "地図・ローカル企業"）
  markets: Market[]; // 対応市場（JP / GLOBAL）
  costPerCall: number; // 1回あたりの想定原価（クレジット換算の見積りに使う）
  search(input: ConnectorSearchInput): Promise<LeadCandidate[]>; // 候補を返す
}

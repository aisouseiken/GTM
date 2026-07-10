// GTM ドメイン型定義（設計書 05_データモデル設計 に準拠）
// このファイルは、アプリ全体で使う「データの形（型）」をまとめて定義する場所です。
// 例：ユーザーとは何か、リード（見込み客）とは何か、といった情報の「入れ物の設計図」を並べています。
// ここでは実際の処理は行わず、あくまで「どんな項目を持つか」だけを宣言しています。
// （interface = データの構造の定義、type = 取りうる値の種類の定義）

// 市場の種類。日本国内（JP）か、グローバル（GLOBAL）かのどちらか。
export type Market = "JP" | "GLOBAL";

// 料金プランの種類。無料（free）から法人向け（enterprise）まで5段階。
export type Plan = "free" | "starter" | "pro" | "scale" | "enterprise";

// ユーザー（このサービスを使う人）1人分の情報。
export interface User {
  id: string; // ユーザーを一意に識別するID
  email: string; // メールアドレス
  name: string; // 表示名
  passwordHash?: string; // パスワードのハッシュ（そのままは保存しない）
  createdAt: number; // 作成日時（数値のタイムスタンプ）
}

// ワークスペース（利用者の作業場・アカウント単位）の情報。
export interface Workspace {
  id: string; // ワークスペースのID
  name: string; // ワークスペース名
  ownerId: string; // 所有者（このワークスペースを作ったユーザー）のID
  market: Market; // 対象市場（日本/グローバル）
  plan: Plan; // 契約中の料金プラン
  createdAt: number; // 作成日時
}

// 構造化ICP（自然言語プロンプトをエージェントが変換した結果）
// ICP = Ideal Customer Profile（理想の顧客像）。
// 「東京の歯科医院を探して」のような文章を、機械が扱いやすい項目に整理したもの。
export interface StructuredICP {
  industry: string; // 業種（正規化ラベル）
  industryKeywords: string[]; // 展開された同義語
  location: string; // 地域
  market: Market;
  signals: string[]; // 採用中 / 資金調達 / 広告出稿 など
  sizeHint?: string; // 従業員規模のヒント
  raw: string; // 元のプロンプト
}

// コネクタ（データ取得先）1つ分の設定。どの情報源をどう使うか。
// コネクタ＝Google マップや求人サイトなど、企業情報を取ってくる外部サービスの接続口のこと。
export interface ConnectorPlanItem {
  connectorId: string; // コネクタの識別子（例: "maps_jp"）
  label: string; // 画面表示用の名前
  params: Record<string, string>; // コネクタに渡す追加パラメータ（キーと値の組）
}

// 検索プラン：ユーザーの要望をもとに「どう探すか」をまとめた計画書。
export interface SearchPlan {
  id: string; // プランのID
  workspaceId: string; // どのワークスペースのプランか
  sessionId: string; // どの会話（チャット）から生まれたか
  icp: StructuredICP; // 構造化された理想顧客像
  connectors: ConnectorPlanItem[]; // 使用するデータ取得先の一覧
  estimatedCredits: number; // 想定消費クレジット（利用料の単位）
  estimatedLeads: number; // 想定で取得できるリード件数
  createdAt: number; // 作成日時
}

// ジョブ（検索処理）の進行状態。下書きから完了・失敗までの段階を表す。
export type JobStatus =
  | "draft" // 下書き
  | "queued" // 実行待ち（順番待ち）
  | "running" // 実行中
  | "verifying" // 検証中（連絡先の正しさを確認中）
  | "partial" // 部分完了（途中まで成功）
  | "done" // 完了
  | "failed"; // 失敗

// ジョブ実行中に発生する「出来事（イベント）」1件分。進捗を画面に伝えるために使う。
export interface JobEvent {
  type: // イベントの種類
    | "queued"
    | "source_started"
    | "source_done"
    | "dedupe"
    | "verifying"
    | "lead"
    | "completed"
    | "failed";
  message: string; // 画面に表示する説明文
  payload?: Record<string, unknown>; // 付随データ（任意）。件数やIDなどを入れる
  at: number; // 発生時刻
}

// ジョブ（1回の検索処理）の実行記録。進捗・結果・消費クレジットなどを保持する。
export interface Job {
  id: string; // ジョブのID
  workspaceId: string; // どのワークスペースのジョブか
  searchPlanId: string; // もとになった検索プランのID
  status: JobStatus; // 現在の状態
  resultCount: number; // 取得できたリード件数
  creditsSpent: number; // 消費したクレジット数
  costInternal: number; // 外部API原価（粗利管理）＝実際に外部サービスへ支払ったコスト
  events: JobEvent[]; // 発生したイベントの履歴
  startedAt: number; // 開始日時
  finishedAt?: number; // 終了日時（未完了なら未設定）
}

// 検証結果の判定。valid=有効, risky=注意, invalid=無効, unknown=不明。
export type VerificationResult = "valid" | "risky" | "invalid" | "unknown";

// リードの連絡先（メール/電話）を1回検証した結果。
export interface LeadVerification {
  field: "email" | "phone"; // 検証した項目（メールか電話か）
  provider: string; // 検証に使った手段・提供元
  result: VerificationResult; // 判定結果
  score: number; // 信頼度スコア 0-100（高いほど確実）
}

// リードの情報がどの情報源から見つかったか（出典）。
export interface LeadSource {
  connectorId: string; // 見つけたコネクタの識別子
  label: string; // 情報源の表示名
  url: string; // 参照元のURL
  snippet: string; // 抜粋（見つかった箇所の短い説明）
}

// リード（見込み客＝営業対象の企業）1社分の情報。このサービスの中心となるデータ。
export interface Lead {
  id: string; // リードのID
  workspaceId: string; // どのワークスペースのリードか
  jobId: string; // どのジョブで取得したか
  companyName: string; // 会社名
  domain: string; // 会社のドメイン（例: example.com）
  email?: string; // メールアドレス（見つからなければ未設定）
  phone?: string; // 電話番号（見つからなければ未設定）
  address?: string; // 住所（任意）
  location: string; // 所在地
  industry: string; // 業種
  category: string; // カテゴリ（業種の細分類など）
  size?: string; // 企業規模の目安（例: "20-100"）
  headcount?: number; // 従業員数
  funding?: string; // 資金調達状況（例: "Series A $8M"）
  signals: string[]; // 買い手シグナル（採用中・資金調達など）の一覧
  buyingSignal?: string; // 代表的な買い手シグナルの表示文
  enrichment: Record<string, string>; // 追加で補強した情報（キーと値の組）
  fitScore: number; // ICP適合スコア 0-100（理想顧客像とどれだけ合っているか）
  confidence: number; // 総合信頼度 0-100（この情報がどれだけ確かか）
  verifications: LeadVerification[]; // 連絡先の検証結果の一覧
  sources: LeadSource[]; // 情報の出典の一覧
  status: "new" | "favorite" | "excluded"; // 状態（新規/お気に入り/除外）
  fetchedAt: number; // データを取得した時刻（最新化＝鮮度の判定に使う）
  createdAt: number; // 作成日時
}

// チャットのメッセージ1件分（ユーザーとエージェントの会話ログ）。
export interface ChatMessage {
  id: string; // メッセージのID
  sessionId: string; // どの会話に属するか
  role: "user" | "assistant" | "system"; // 発言者（利用者/AI/システム）
  content: string; // 本文
  kind?: "text" | "plan" | "progress" | "result"; // 表示の種類（普通の文/プラン/進捗/結果）
  data?: Record<string, unknown>; // 付随データ（任意）
  createdAt: number; // 作成日時
}

// チャットセッション（1つの会話のまとまり）。
export interface ChatSession {
  id: string; // セッションのID
  workspaceId: string; // どのワークスペースの会話か
  title: string; // 会話のタイトル
  createdAt: number; // 作成日時
}

// リードリスト：ユーザーが保存したリードのまとめ（お気に入りリストのようなもの）。
export interface LeadList {
  id: string; // リストのID
  workspaceId: string; // どのワークスペースのリストか
  name: string; // リスト名
  leadIds: string[]; // このリストに入っているリードのIDの一覧
  createdAt: number; // 作成日時
}

// クレジットウォレット：利用料の単位「クレジット」の残高を管理する財布。
export interface CreditWallet {
  workspaceId: string; // どのワークスペースの財布か
  balance: number; // 現在の残高
  monthlyGrant: number; // 毎月付与されるクレジット数
}

// サブスクリプション（Stripe連携。鍵は最後に設定するまでモックで動作）
// ＝月額課金の契約情報。Stripe は決済サービスの名前。
export interface Subscription {
  id: string; // 契約のID
  workspaceId: string; // どのワークスペースの契約か
  stripeCustomerId?: string; // Stripe側の顧客ID（任意）
  stripeSubscriptionId?: string; // Stripe側のサブスクID（任意）
  plan: Plan; // 契約プラン
  status: "active" | "past_due" | "canceled" | "incomplete"; // 状態（有効/支払遅延/解約/未完了）
  currentPeriodEnd?: number; // 現在の課金期間の終了日時
}

// 監査ログ：誰がいつ何をしたかの記録（不正利用の追跡・コンプラ対応に使う）。
export interface AuditLog {
  id: string;
  at: number; // 発生時刻
  actor: string; // 実行者（例: "user:usr_xxx" / "apikey:key_xxx" / "public"）
  action: string; // 操作（例: "login" / "search" / "export" / "apikey.issue" / "optout"）
  target?: string; // 対象（例: workspaceId / jobId など）
  meta?: Record<string, unknown>; // 補足情報
}

// クレジットの増減記録（1件ずつの入出金履歴）。
export interface CreditTransaction {
  id: string; // 記録のID
  workspaceId: string; // どのワークスペースの記録か
  jobId?: string; // 関連するジョブID（任意）
  delta: number; // +付与 / -消費（増減の量。プラスなら追加、マイナスなら消費）
  reason: "grant" | "search" | "verify" | "enrich" | "purchase"; // 理由（付与/検索/検証/補強/購入）
  note: string; // 補足メモ
  createdAt: number; // 作成日時
}

// APIキー：外部プログラムからこのサービスを使うための鍵（パスワードのようなもの）。
export interface ApiKey {
  id: string; // キーのID
  workspaceId: string; // どのワークスペースのキーか
  name: string; // キーの名前（用途の識別用）
  keyPreview: string; // 表示用の先頭数文字（全体は見せない）
  keyHash: string; // キーをハッシュ化した値（元の鍵は保存しない）
  createdAt: number; // 発行日時
  lastUsedAt?: number; // 最終利用日時（任意）
  revokedAt?: number; // 無効化した日時（失効させた場合）
}

// 各プランの詳細情報（表示名・料金・毎月のクレジット・同時実行数）をまとめた一覧表。
export const PLAN_INFO: Record<
  Plan,
  { label: string; priceJpy: number; monthlyCredits: number; concurrency: number }
> = {
  // priceJpy=月額（円）, monthlyCredits=毎月付与クレジット, concurrency=同時に動かせる検索数
  free: { label: "Free", priceJpy: 0, monthlyCredits: 1000, concurrency: 3 },
  starter: { label: "Starter", priceJpy: 4500, monthlyCredits: 2000, concurrency: 10 },
  pro: { label: "Pro", priceJpy: 19800, monthlyCredits: 9000, concurrency: 20 },
  scale: { label: "Scale", priceJpy: 74800, monthlyCredits: 40000, concurrency: 50 },
  enterprise: {
    label: "Enterprise",
    priceJpy: 0,
    monthlyCredits: 1_000_000,
    concurrency: 100,
  },
};

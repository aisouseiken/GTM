// GTM ドメイン型定義（設計書 05_データモデル設計 に準拠）

export type Market = "JP" | "GLOBAL";

export type Plan = "free" | "starter" | "pro" | "scale" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  market: Market;
  plan: Plan;
  createdAt: number;
}

// 構造化ICP（自然言語プロンプトをエージェントが変換した結果）
export interface StructuredICP {
  industry: string; // 業種（正規化ラベル）
  industryKeywords: string[]; // 展開された同義語
  location: string; // 地域
  market: Market;
  signals: string[]; // 採用中 / 資金調達 / 広告出稿 など
  sizeHint?: string; // 従業員規模のヒント
  raw: string; // 元のプロンプト
}

export interface ConnectorPlanItem {
  connectorId: string;
  label: string;
  params: Record<string, string>;
}

export interface SearchPlan {
  id: string;
  workspaceId: string;
  sessionId: string;
  icp: StructuredICP;
  connectors: ConnectorPlanItem[];
  estimatedCredits: number;
  estimatedLeads: number;
  createdAt: number;
}

export type JobStatus =
  | "draft"
  | "queued"
  | "running"
  | "verifying"
  | "partial"
  | "done"
  | "failed";

export interface JobEvent {
  type:
    | "queued"
    | "source_started"
    | "source_done"
    | "dedupe"
    | "verifying"
    | "lead"
    | "completed"
    | "failed";
  message: string;
  payload?: Record<string, unknown>;
  at: number;
}

export interface Job {
  id: string;
  workspaceId: string;
  searchPlanId: string;
  status: JobStatus;
  resultCount: number;
  creditsSpent: number;
  costInternal: number; // 外部API原価（粗利管理）
  events: JobEvent[];
  startedAt: number;
  finishedAt?: number;
}

export type VerificationResult = "valid" | "risky" | "invalid" | "unknown";

export interface LeadVerification {
  field: "email" | "phone";
  provider: string;
  result: VerificationResult;
  score: number; // 0-100
}

export interface LeadSource {
  connectorId: string;
  label: string;
  url: string;
  snippet: string;
}

export interface Lead {
  id: string;
  workspaceId: string;
  jobId: string;
  companyName: string;
  domain: string;
  email?: string;
  phone?: string;
  address?: string;
  location: string;
  industry: string;
  category: string;
  size?: string;
  headcount?: number;
  funding?: string;
  signals: string[];
  buyingSignal?: string;
  enrichment: Record<string, string>;
  fitScore: number; // ICP適合スコア 0-100
  confidence: number; // 総合信頼度 0-100
  verifications: LeadVerification[];
  sources: LeadSource[];
  status: "new" | "favorite" | "excluded";
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  kind?: "text" | "plan" | "progress" | "result";
  data?: Record<string, unknown>;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
}

export interface LeadList {
  id: string;
  workspaceId: string;
  name: string;
  leadIds: string[];
  createdAt: number;
}

export interface CreditWallet {
  workspaceId: string;
  balance: number;
  monthlyGrant: number;
}

// サブスクリプション（Stripe連携。鍵は最後に設定するまでモックで動作）
export interface Subscription {
  id: string;
  workspaceId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: Plan;
  status: "active" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd?: number;
}

export interface CreditTransaction {
  id: string;
  workspaceId: string;
  jobId?: string;
  delta: number; // +付与 / -消費
  reason: "grant" | "search" | "verify" | "enrich" | "purchase";
  note: string;
  createdAt: number;
}

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPreview: string; // 表示用の先頭数文字
  keyHash: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

export const PLAN_INFO: Record<
  Plan,
  { label: string; priceJpy: number; monthlyCredits: number; concurrency: number }
> = {
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

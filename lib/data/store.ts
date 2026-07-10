// インメモリ・データストア（リポジトリ抽象化）
// MOCK/開発用。Supabase アダプタに差し替え可能な形にしている（設計書04参照）。
// dev サーバは単一プロセスなのでモジュールスコープの Map で永続化する。

import type {
  ApiKey,
  AuditLog,
  ChatMessage,
  ChatSession,
  CreditTransaction,
  CreditWallet,
  Job,
  Lead,
  LeadList,
  Plan,
  SearchPlan,
  Subscription,
  User,
  Workspace,
} from "@/lib/domain/types";
import { PLAN_INFO as PLANS } from "@/lib/domain/types";

interface DB {
  users: Map<string, User>;
  usersByEmail: Map<string, string>;
  workspaces: Map<string, Workspace>;
  wallets: Map<string, CreditWallet>;
  creditTx: CreditTransaction[];
  sessions: Map<string, ChatSession>;
  messages: ChatMessage[];
  plans: Map<string, SearchPlan>;
  jobs: Map<string, Job>;
  leads: Map<string, Lead>;
  lists: Map<string, LeadList>;
  apiKeys: Map<string, ApiKey>;
  subscriptions: Map<string, Subscription>; // key: workspaceId
  grantedKeys: Set<string>; // クレジット付与の冪等キー（二重計上防止）
  audits: AuditLog[]; // 監査ログ（誰がいつ何をしたか）
  suppression: Set<string>; // オプトアウト抑制リスト（メール/ドメインを小文字で保持）
}

// HMR で state が飛ばないよう globalThis に保持
const g = globalThis as unknown as { __gtmdb?: DB };

function fresh(): DB {
  return {
    users: new Map(),
    usersByEmail: new Map(),
    workspaces: new Map(),
    wallets: new Map(),
    creditTx: [],
    sessions: new Map(),
    messages: [],
    plans: new Map(),
    jobs: new Map(),
    leads: new Map(),
    lists: new Map(),
    apiKeys: new Map(),
    subscriptions: new Map(),
    grantedKeys: new Set(),
    audits: [],
    suppression: new Set(),
  };
}

export const db: DB = (g.__gtmdb ??= fresh());

// ---- ID 生成 ----
// ★以前は「時刻＋連番」で推測可能だった（監査指摘）。暗号乱数を足して推測できないIDにする。
//   userId/jobId/ワークスペースID などが推測されると列挙攻撃の入口になるため。
import { randomBytes } from "crypto";
export function id(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

// ---- users ----
// ユーザーを作成する（同じメールが既にあればそれを返す）。passwordHash は任意。
export function createUser(email: string, name: string, passwordHash?: string): User {
  const existing = db.usersByEmail.get(email.toLowerCase());
  if (existing) return db.users.get(existing)!;
  const user: User = {
    id: id("usr"),
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: Date.now(),
  };
  db.users.set(user.id, user);
  db.usersByEmail.set(user.email, user.id);
  return user;
}

export function getUserByEmail(email: string): User | undefined {
  const uid = db.usersByEmail.get(email.toLowerCase());
  return uid ? db.users.get(uid) : undefined;
}

export function getUser(uid: string): User | undefined {
  return db.users.get(uid);
}

// ---- workspaces ----
export function createWorkspace(
  ownerId: string,
  name: string,
  market: Workspace["market"] = "JP",
  plan: Workspace["plan"] = "free"
): Workspace {
  const ws: Workspace = {
    id: id("ws"),
    name,
    ownerId,
    market,
    plan,
    createdAt: Date.now(),
  };
  db.workspaces.set(ws.id, ws);
  // ウォレット初期化
  const grant = PLANS[plan].monthlyCredits;
  db.wallets.set(ws.id, {
    workspaceId: ws.id,
    balance: grant,
    monthlyGrant: grant,
  });
  db.creditTx.push({
    id: id("ctx"),
    workspaceId: ws.id,
    delta: grant,
    reason: "grant",
    note: `${PLANS[plan].label} プラン初期付与`,
    createdAt: Date.now(),
  });
  return ws;
}

export function listWorkspaces(ownerId: string): Workspace[] {
  return [...db.workspaces.values()]
    .filter((w) => w.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getWorkspace(wid: string): Workspace | undefined {
  return db.workspaces.get(wid);
}

// ---- credits ----
export function getWallet(wid: string): CreditWallet | undefined {
  return db.wallets.get(wid);
}

export function spendCredits(
  wid: string,
  amount: number,
  reason: CreditTransaction["reason"],
  note: string,
  jobId?: string
): boolean {
  const w = db.wallets.get(wid);
  if (!w || w.balance < amount) return false;
  w.balance -= amount;
  db.creditTx.push({
    id: id("ctx"),
    workspaceId: wid,
    jobId,
    delta: -amount,
    reason,
    note,
    createdAt: Date.now(),
  });
  return true;
}


export function listTransactions(wid: string): CreditTransaction[] {
  return db.creditTx
    .filter((t) => t.workspaceId === wid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- sessions & messages ----
export function createSession(wid: string, title: string): ChatSession {
  const s: ChatSession = {
    id: id("cs"),
    workspaceId: wid,
    title,
    createdAt: Date.now(),
  };
  db.sessions.set(s.id, s);
  return s;
}

export function getSession(sid: string): ChatSession | undefined {
  return db.sessions.get(sid);
}

export function listSessions(wid: string): ChatSession[] {
  return [...db.sessions.values()]
    .filter((s) => s.workspaceId === wid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function addMessage(m: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  const msg: ChatMessage = { ...m, id: id("msg"), createdAt: Date.now() };
  db.messages.push(msg);
  return msg;
}

export function listMessages(sid: string): ChatMessage[] {
  return db.messages
    .filter((m) => m.sessionId === sid)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ---- search plans ----
export function saveSearchPlan(p: SearchPlan) {
  db.plans.set(p.id, p);
}
export function getSearchPlan(pid: string): SearchPlan | undefined {
  return db.plans.get(pid);
}

// ---- jobs ----
export function saveJob(j: Job) {
  db.jobs.set(j.id, j);
}
export function getJob(jid: string): Job | undefined {
  return db.jobs.get(jid);
}
export function listJobs(wid: string): Job[] {
  return [...db.jobs.values()]
    .filter((j) => j.workspaceId === wid)
    .sort((a, b) => b.startedAt - a.startedAt);
}
// 実行中（順番待ち/実行中/検証中）のジョブ数を数える（同時実行の上限チェック用）。
export function countActiveJobs(wid: string): number {
  return [...db.jobs.values()].filter(
    (j) => j.workspaceId === wid && (j.status === "queued" || j.status === "running" || j.status === "verifying")
  ).length;
}

// ---- leads ----
export function saveLead(l: Lead) {
  db.leads.set(l.id, l);
}
export function getLead(lid: string): Lead | undefined {
  return db.leads.get(lid);
}
export function listLeadsByJob(jid: string): Lead[] {
  return [...db.leads.values()]
    .filter((l) => l.jobId === jid)
    .sort((a, b) => b.fitScore - a.fitScore);
}
export function listLeadsByWorkspace(wid: string): Lead[] {
  return [...db.leads.values()]
    .filter((l) => l.workspaceId === wid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- lists ----
export function createList(wid: string, name: string, leadIds: string[]): LeadList {
  const list: LeadList = {
    id: id("list"),
    workspaceId: wid,
    name,
    leadIds,
    createdAt: Date.now(),
  };
  db.lists.set(list.id, list);
  return list;
}
export function getList(lid: string): LeadList | undefined {
  return db.lists.get(lid);
}
export function listLists(wid: string): LeadList[] {
  return [...db.lists.values()]
    .filter((l) => l.workspaceId === wid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// ---- api keys ----
export function saveApiKey(k: ApiKey) {
  db.apiKeys.set(k.id, k);
}
export function listApiKeys(wid: string): ApiKey[] {
  return [...db.apiKeys.values()]
    .filter((k) => k.workspaceId === wid && !k.revokedAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}
export function findApiKeyByHash(hash: string): ApiKey | undefined {
  return [...db.apiKeys.values()].find((k) => k.keyHash === hash && !k.revokedAt);
}
export function getApiKey(keyId: string): ApiKey | undefined {
  return db.apiKeys.get(keyId);
}
// APIキーを失効させる（漏えい時に無効化できるように）。revokedAt を立てるだけで以後照合されない。
export function revokeApiKey(keyId: string): void {
  const k = db.apiKeys.get(keyId);
  if (k) k.revokedAt = Date.now();
}

// ---- subscriptions / plan change（Stripe連携から呼ばれる）----
export function getSubscription(wid: string): Subscription | undefined {
  return db.subscriptions.get(wid);
}
// StripeのサブスクID/顧客IDから、どのワークスペースの契約かを逆引きする。
// ★Webhookのイベントに metadata が欠けていても、この逆引きで解約/付与を正しく反映するため。
export function findWorkspaceByStripe(
  subscriptionId?: string,
  customerId?: string
): string | undefined {
  for (const s of db.subscriptions.values()) {
    if (subscriptionId && s.stripeSubscriptionId === subscriptionId) return s.workspaceId;
    if (customerId && s.stripeCustomerId === customerId) return s.workspaceId;
  }
  return undefined;
}

export function upsertSubscription(
  wid: string,
  data: Partial<Omit<Subscription, "id" | "workspaceId">>
): Subscription {
  const existing = db.subscriptions.get(wid);
  const sub: Subscription = {
    id: existing?.id ?? id("sub"),
    workspaceId: wid,
    stripeCustomerId: existing?.stripeCustomerId,
    stripeSubscriptionId: existing?.stripeSubscriptionId,
    plan: existing?.plan ?? "free",
    status: existing?.status ?? "active",
    currentPeriodEnd: existing?.currentPeriodEnd,
    ...data,
  };
  db.subscriptions.set(wid, sub);
  return sub;
}

// ---- プラン設定とクレジット付与を「分離」して二重計上を防ぐ ----
//
// なぜ分けるか：
//   Stripe は新規契約時に checkout.session.completed / customer.subscription.updated /
//   invoice.paid を“ほぼ同時”に発火する。以前は全部で「プラン設定＋クレジット付与」を
//   一緒にやっていたため、同じ月のクレジットが2〜3回ダブって足されていた（＝二重計上）。
//   → 「プランを変える処理」と「クレジットを足す処理」を別関数にし、
//     クレジット付与は invoice.paid でだけ・冪等（同じ支払いは1回だけ）に実行する。

// プランを変えるだけ（クレジット残高は増やさない）
export function setWorkspacePlan(wid: string, plan: Plan): void {
  const ws = db.workspaces.get(wid);
  if (!ws) return;
  ws.plan = plan;
  const w = db.wallets.get(wid);
  if (w) w.monthlyGrant = PLANS[plan].monthlyCredits;
}

// 月次クレジットを付与する（dedupeKey が同じ支払いは二度と付与しない＝二重計上防止）
export function grantMonthlyCredits(wid: string, plan: Plan, dedupeKey?: string): void {
  if (dedupeKey) {
    if (db.grantedKeys.has(dedupeKey)) return; // 既に付与済み → スキップ
    // ★メモリ肥大防止：冪等キーが増えすぎたら古い分を捨てる（本番はDBのユニーク制約に移行）
    if (db.grantedKeys.size > 50000) db.grantedKeys.clear();
    db.grantedKeys.add(dedupeKey);
  }
  const w = db.wallets.get(wid);
  if (!w) return;
  const grant = PLANS[plan].monthlyCredits;
  w.balance += grant;
  db.creditTx.push({
    id: id("ctx"),
    workspaceId: wid,
    delta: grant,
    reason: "grant",
    note: `${PLANS[plan].label} プランのクレジット付与`,
    createdAt: Date.now(),
  });
}

// ---- 監査ログ（誰がいつ何をしたか）----
export function addAudit(entry: Omit<AuditLog, "id" | "at">): void {
  db.audits.push({ ...entry, id: id("aud"), at: Date.now() });
  if (db.audits.length > 100000) db.audits.splice(0, db.audits.length - 100000); // 上限
}
// 指定ワークスペースに関する監査ログ（新しい順）
export function listAudits(target: string, limit = 50): AuditLog[] {
  return db.audits
    .filter((a) => a.target === target)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// ---- オプトアウト抑制リスト（メール/ドメインを配信・取得から除外）----
export function addSuppression(value: string): void {
  const v = value.trim().toLowerCase();
  if (v) db.suppression.add(v);
}
// メール（とそのドメイン）が抑制対象かどうか
export function isSuppressed(email?: string): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (db.suppression.has(e)) return true;
  const at = e.lastIndexOf("@");
  if (at >= 0 && db.suppression.has(e.slice(at + 1))) return true; // ドメイン単位の抑制
  return false;
}


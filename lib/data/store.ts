// インメモリ・データストア（リポジトリ抽象化）
// MOCK/開発用。Supabase アダプタに差し替え可能な形にしている（設計書04参照）。
// dev サーバは単一プロセスなのでモジュールスコープの Map で永続化する。

import type {
  ApiKey,
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
  };
}

export const db: DB = (g.__gtmdb ??= fresh());

// ---- ID 生成（Math.random は使わずカウンタ＋時刻で決定的寄りに）----
let counter = 0;
export function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

// ---- users ----
export function createUser(email: string, name: string): User {
  const existing = db.usersByEmail.get(email.toLowerCase());
  if (existing) return db.users.get(existing)!;
  const user: User = {
    id: id("usr"),
    email: email.toLowerCase(),
    name,
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

export function grantCredits(wid: string, amount: number, note: string) {
  const w = db.wallets.get(wid);
  if (!w) return;
  w.balance += amount;
  db.creditTx.push({
    id: id("ctx"),
    workspaceId: wid,
    delta: amount,
    reason: "purchase",
    note,
    createdAt: Date.now(),
  });
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

// ---- subscriptions / plan change（Stripe連携から呼ばれる）----
export function getSubscription(wid: string): Subscription | undefined {
  return db.subscriptions.get(wid);
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

// プラン変更を適用：workspace.plan とウォレット月次付与量を更新し、当月分を付与
export function applyPlanChange(wid: string, plan: Plan): void {
  const ws = db.workspaces.get(wid);
  if (!ws) return;
  ws.plan = plan;
  const grant = PLANS[plan].monthlyCredits;
  const w = db.wallets.get(wid);
  if (w) {
    w.monthlyGrant = grant;
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
}

// インメモリ・データストア（リポジトリ抽象化）
// MOCK/開発用。Supabase アダプタに差し替え可能な形にしている（設計書04参照）。
// dev サーバは単一プロセスなのでモジュールスコープの Map で永続化する。
//
// このファイルの役割：本物のデータベースの代わりに、メモリ上（プログラム稼働中だけ残る場所）に
// ユーザー・ワークスペース・リード（見込み客）などのデータをしまっておく「簡易保管庫」です。
// インメモリ＝メモリ上に置くので、サーバーを止めると中身は消えます（開発・お試し向け）。
// Map＝「鍵→値」で素早く出し入れできる入れ物。将来は本物のDB（Supabase）に差し替えます。

// アプリ全体で使う「データの形（型）」の定義をまとめて借りてくる。
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
// 各プランの詳細（料金・毎月のクレジットなど）の一覧表を PLANS という名前で借りる。
import { PLAN_INFO as PLANS } from "@/lib/domain/types";

// この保管庫が持つ「棚」の一覧（どんなデータをどんな形でしまうか）の定義。
interface DB {
  users: Map<string, User>; // ユーザー（ID→ユーザー情報）
  usersByEmail: Map<string, string>; // メール→ユーザーIDの索引（メールから素早く引くため）
  workspaces: Map<string, Workspace>; // ワークスペース（作業場）
  wallets: Map<string, CreditWallet>; // クレジットの財布（残高管理）
  creditTx: CreditTransaction[]; // クレジットの増減履歴（入出金記録の一覧）
  sessions: Map<string, ChatSession>; // チャットの会話まとまり
  messages: ChatMessage[]; // チャットのメッセージ1件ずつの一覧
  plans: Map<string, SearchPlan>; // 検索プラン（どう探すかの計画）
  jobs: Map<string, Job>; // ジョブ（1回の検索処理の実行記録）
  leads: Map<string, Lead>; // リード（見込み客の企業）
  lists: Map<string, LeadList>; // リードリスト（保存したまとめ）
  apiKeys: Map<string, ApiKey>; // APIキー（外部連携用の鍵）
  subscriptions: Map<string, Subscription>; // key: workspaceId
  grantedKeys: Set<string>; // クレジット付与の冪等キー（二重計上防止）
  audits: AuditLog[]; // 監査ログ（誰がいつ何をしたか）
  suppression: Set<string>; // オプトアウト抑制リスト（メール/ドメインを小文字で保持）
}

// HMR で state が飛ばないよう globalThis に保持
// HMR＝開発中にコードを保存すると自動で再読み込みする仕組み。その際にデータが消えないよう、
// アプリ全体で共有される場所(globalThis)に保管庫を置いておく。
const g = globalThis as unknown as { __gtmdb?: DB };

// 空っぽの新しい保管庫を1つ作って返す（全部の棚を空の状態で用意する）。
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

// 既に保管庫があれば使い回し、無ければ新しく作る。以後このアプリ全体で db を共有する。
export const db: DB = (g.__gtmdb ??= fresh());

// ---- ID 生成 ----
// ★以前は「時刻＋連番」で推測可能だった（監査指摘）。暗号乱数を足して推測できないIDにする。
//   userId/jobId/ワークスペースID などが推測されると列挙攻撃の入口になるため。
import { randomBytes } from "crypto"; // 推測できないランダム値を作る道具
// prefix（例: "usr"）の後ろにランダム文字を付けて、推測されにくいIDを作る。
export function id(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

// ---- users ----
// ユーザーを作成する（同じメールが既にあればそれを返す）。passwordHash は任意。
export function createUser(email: string, name: string, passwordHash?: string): User {
  const existing = db.usersByEmail.get(email.toLowerCase()); // 同じメールの既存ユーザーを探す（小文字にそろえて比較）
  if (existing) return db.users.get(existing)!; // 既にいればそのユーザーを返す（重複作成しない）
  const user: User = { // 新しいユーザー情報を組み立てる
    id: id("usr"), // ユーザーID（"usr_" で始まる）
    email: email.toLowerCase(), // メールは小文字にそろえて保存（表記ゆれ対策）
    name, // 表示名
    passwordHash, // パスワードのハッシュ（無い場合もある）
    createdAt: Date.now(), // 作成時刻
  };
  db.users.set(user.id, user); // ID→ユーザーの棚に登録
  db.usersByEmail.set(user.email, user.id); // メール→IDの索引にも登録
  return user; // 作ったユーザーを返す
}

// メールアドレスからユーザーを探す（見つからなければ undefined）。
export function getUserByEmail(email: string): User | undefined {
  const uid = db.usersByEmail.get(email.toLowerCase()); // まずメールからIDを引く
  return uid ? db.users.get(uid) : undefined; // IDが取れればそのユーザーを返す
}

// ユーザーID からユーザーを探す（見つからなければ undefined）。
export function getUser(uid: string): User | undefined {
  return db.users.get(uid);
}

// ---- workspaces ----
// ワークスペース（作業場）を新しく作る。市場とプランは省略時「JP・free」を既定にする。
export function createWorkspace(
  ownerId: string, // 所有者（作成するユーザー）のID
  name: string, // ワークスペース名
  market: Workspace["market"] = "JP", // 対象市場（既定は日本）
  plan: Workspace["plan"] = "free" // 料金プラン（既定は無料）
): Workspace {
  const ws: Workspace = { // ワークスペース情報を組み立てる
    id: id("ws"), // ワークスペースID
    name,
    ownerId,
    market,
    plan,
    createdAt: Date.now(), // 作成時刻
  };
  db.workspaces.set(ws.id, ws); // 棚に登録
  // ウォレット初期化
  const grant = PLANS[plan].monthlyCredits; // このプランで毎月もらえるクレジット数
  db.wallets.set(ws.id, { // この作業場用の財布を作る
    workspaceId: ws.id, // どの作業場の財布か
    balance: grant, // 初期残高（初回付与ぶん）
    monthlyGrant: grant, // 毎月付与される量
  });
  db.creditTx.push({ // 初回付与を履歴にも1件記録する
    id: id("ctx"), // 履歴のID
    workspaceId: ws.id, // 対象の作業場
    delta: grant, // 増減量（プラス＝付与）
    reason: "grant", // 理由＝付与
    note: `${PLANS[plan].label} プラン初期付与`, // メモ
    createdAt: Date.now(), // 記録時刻
  });
  return ws; // 作ったワークスペースを返す
}

// 指定ユーザーが所有するワークスペースを、新しい順に一覧で返す。
export function listWorkspaces(ownerId: string): Workspace[] {
  return [...db.workspaces.values()] // すべてのワークスペースを配列にして
    .filter((w) => w.ownerId === ownerId) // 所有者が一致するものだけ残し
    .sort((a, b) => b.createdAt - a.createdAt); // 作成日時の新しい順に並べる
}

// ワークスペースID から1件を取得する（無ければ undefined）。
export function getWorkspace(wid: string): Workspace | undefined {
  return db.workspaces.get(wid);
}

// ---- credits ----
// 指定ワークスペースの財布（残高情報）を取得する。
export function getWallet(wid: string): CreditWallet | undefined {
  return db.wallets.get(wid);
}

// クレジットを使う（支払う）。残高が足りれば減らして true、足りなければ何もせず false。
export function spendCredits(
  wid: string, // どの作業場の財布か
  amount: number, // 使う量
  reason: CreditTransaction["reason"], // 使う理由（検索/検証など）
  note: string, // メモ
  jobId?: string // 関連するジョブID（任意）
): boolean {
  const w = db.wallets.get(wid); // 財布を取り出す
  if (!w || w.balance < amount) return false; // 財布が無い/残高不足なら支払い失敗
  w.balance -= amount; // 残高を減らす
  db.creditTx.push({ // 支払いを履歴に1件記録する
    id: id("ctx"),
    workspaceId: wid,
    jobId,
    delta: -amount, // マイナス＝消費
    reason,
    note,
    createdAt: Date.now(),
  });
  return true; // 支払い成功
}


// 指定ワークスペースのクレジット増減履歴を、新しい順に返す。
export function listTransactions(wid: string): CreditTransaction[] {
  return db.creditTx
    .filter((t) => t.workspaceId === wid) // その作業場の記録だけ残す
    .sort((a, b) => b.createdAt - a.createdAt); // 新しい順に並べる
}

// ---- sessions & messages ----
// チャットの会話（セッション）を新しく1つ作る。
export function createSession(wid: string, title: string): ChatSession {
  const s: ChatSession = {
    id: id("cs"), // 会話のID
    workspaceId: wid, // どの作業場の会話か
    title, // 会話のタイトル
    createdAt: Date.now(), // 作成時刻
  };
  db.sessions.set(s.id, s); // 棚に登録
  return s;
}

// 会話ID から1件を取得する。
export function getSession(sid: string): ChatSession | undefined {
  return db.sessions.get(sid);
}

// 指定ワークスペースの会話を、新しい順に一覧で返す。
export function listSessions(wid: string): ChatSession[] {
  return [...db.sessions.values()]
    .filter((s) => s.workspaceId === wid) // その作業場の会話だけ残す
    .sort((a, b) => b.createdAt - a.createdAt); // 新しい順に並べる
}

// メッセージを1件追加する（ID と作成時刻はこちらで自動付与する）。
export function addMessage(m: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  const msg: ChatMessage = { ...m, id: id("msg"), createdAt: Date.now() }; // 渡された内容にID・時刻を足す
  db.messages.push(msg); // 一覧に追加
  return msg;
}

// 指定した会話に属するメッセージを、古い順（会話の流れ順）に返す。
export function listMessages(sid: string): ChatMessage[] {
  return db.messages
    .filter((m) => m.sessionId === sid) // その会話のメッセージだけ残す
    .sort((a, b) => a.createdAt - b.createdAt); // 古い順（発言された順）に並べる
}

// ---- search plans ----
// 検索プラン（探し方の計画書）を保存する（同じIDなら上書き）。
export function saveSearchPlan(p: SearchPlan) {
  db.plans.set(p.id, p);
}
// 検索プランID から1件を取得する。
export function getSearchPlan(pid: string): SearchPlan | undefined {
  return db.plans.get(pid);
}

// ---- jobs ----
// ジョブ（1回の検索処理）を保存する（同じIDなら上書き＝進捗更新に使う）。
export function saveJob(j: Job) {
  db.jobs.set(j.id, j);
}
// ジョブID から1件を取得する。
export function getJob(jid: string): Job | undefined {
  return db.jobs.get(jid);
}
// 指定ワークスペースのジョブを、開始が新しい順に一覧で返す。
export function listJobs(wid: string): Job[] {
  return [...db.jobs.values()]
    .filter((j) => j.workspaceId === wid) // その作業場のジョブだけ残す
    .sort((a, b) => b.startedAt - a.startedAt); // 開始時刻の新しい順に並べる
}
// 実行中（順番待ち/実行中/検証中）のジョブ数を数える（同時実行の上限チェック用）。
export function countActiveJobs(wid: string): number {
  return [...db.jobs.values()].filter(
    (j) => j.workspaceId === wid && (j.status === "queued" || j.status === "running" || j.status === "verifying")
  ).length;
}

// ---- leads ----
// リード（見込み客）を保存する（同じIDなら上書き）。
export function saveLead(l: Lead) {
  db.leads.set(l.id, l);
}
// リードID から1件を取得する。
export function getLead(lid: string): Lead | undefined {
  return db.leads.get(lid);
}
// 指定ジョブで見つかったリードを、適合スコアの高い順に返す。
export function listLeadsByJob(jid: string): Lead[] {
  return [...db.leads.values()]
    .filter((l) => l.jobId === jid) // そのジョブのリードだけ残す
    .sort((a, b) => b.fitScore - a.fitScore); // 適合スコアの高い順（有望な順）に並べる
}
// 指定ワークスペースのリードを、新しい順に返す。
export function listLeadsByWorkspace(wid: string): Lead[] {
  return [...db.leads.values()]
    .filter((l) => l.workspaceId === wid) // その作業場のリードだけ残す
    .sort((a, b) => b.createdAt - a.createdAt); // 新しい順に並べる
}

// ---- lists ----
// リードリスト（お気に入りのまとめ）を新しく作る。
export function createList(wid: string, name: string, leadIds: string[]): LeadList {
  const list: LeadList = {
    id: id("list"), // リストのID
    workspaceId: wid, // どの作業場のリストか
    name, // リスト名
    leadIds, // 入れるリードのID一覧
    createdAt: Date.now(), // 作成時刻
  };
  db.lists.set(list.id, list); // 棚に登録
  return list;
}
// リストID から1件を取得する。
export function getList(lid: string): LeadList | undefined {
  return db.lists.get(lid);
}
// 指定ワークスペースのリストを、新しい順に返す。
export function listLists(wid: string): LeadList[] {
  return [...db.lists.values()]
    .filter((l) => l.workspaceId === wid) // その作業場のリストだけ残す
    .sort((a, b) => b.createdAt - a.createdAt); // 新しい順に並べる
}

// ---- api keys ----
// APIキー情報を保存する（同じIDなら上書き）。
export function saveApiKey(k: ApiKey) {
  db.apiKeys.set(k.id, k);
}
// 指定ワークスペースの「有効な（失効していない）」APIキーを、新しい順に返す。
export function listApiKeys(wid: string): ApiKey[] {
  return [...db.apiKeys.values()]
    .filter((k) => k.workspaceId === wid && !k.revokedAt) // その作業場かつ未失効のものだけ
    .sort((a, b) => b.createdAt - a.createdAt); // 新しい順に並べる
}
// ハッシュ値から、一致する有効なAPIキーを探す（キーの照合に使う）。
export function findApiKeyByHash(hash: string): ApiKey | undefined {
  return [...db.apiKeys.values()].find((k) => k.keyHash === hash && !k.revokedAt); // ハッシュ一致かつ未失効
}
// キーID から1件を取得する。
export function getApiKey(keyId: string): ApiKey | undefined {
  return db.apiKeys.get(keyId);
}
// APIキーを失効させる（漏えい時に無効化できるように）。revokedAt を立てるだけで以後照合されない。
export function revokeApiKey(keyId: string): void {
  const k = db.apiKeys.get(keyId);
  if (k) k.revokedAt = Date.now();
}

// ---- subscriptions / plan change（Stripe連携から呼ばれる）----
// 指定ワークスペースの契約（サブスク）情報を取得する。
export function getSubscription(wid: string): Subscription | undefined {
  return db.subscriptions.get(wid);
}
// StripeのサブスクID/顧客IDから、どのワークスペースの契約かを逆引きする。
// ★Webhookのイベントに metadata が欠けていても、この逆引きで解約/付与を正しく反映するため。
export function findWorkspaceByStripe(
  subscriptionId?: string,
  customerId?: string
): string | undefined {
  for (const s of db.subscriptions.values()) { // 全契約を1件ずつ調べる
    if (subscriptionId && s.stripeSubscriptionId === subscriptionId) return s.workspaceId; // サブスクIDが一致すればその作業場
    if (customerId && s.stripeCustomerId === customerId) return s.workspaceId; // 顧客IDが一致すればその作業場
  }
  return undefined; // どれにも該当しなければ「不明」
}

// 契約情報を作成または更新する（upsert＝無ければ作る・あれば更新する）。
// data には変更したい項目だけを渡せばよく、残りは既存値を引き継ぐ。
export function upsertSubscription(
  wid: string,
  data: Partial<Omit<Subscription, "id" | "workspaceId">>
): Subscription {
  const existing = db.subscriptions.get(wid); // 既存の契約があれば取り出す
  const sub: Subscription = { // 新しい契約情報を組み立てる（既存値を土台に）
    id: existing?.id ?? id("sub"), // 既存IDがあれば流用、無ければ新規発行
    workspaceId: wid, // 対象の作業場
    stripeCustomerId: existing?.stripeCustomerId, // Stripe顧客ID（既存を引き継ぐ）
    stripeSubscriptionId: existing?.stripeSubscriptionId, // StripeサブスクID（既存を引き継ぐ）
    plan: existing?.plan ?? "free", // プラン（既存が無ければ free）
    status: existing?.status ?? "active", // 状態（既存が無ければ active）
    currentPeriodEnd: existing?.currentPeriodEnd, // 課金期間の終了日時（既存を引き継ぐ）
    ...data, // 最後に data の内容で上書き（変更したい項目だけ反映される）
  };
  db.subscriptions.set(wid, sub); // 棚に保存
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
  const ws = db.workspaces.get(wid); // 対象の作業場を取り出す
  if (!ws) return; // 無ければ何もしない
  ws.plan = plan; // プランを差し替える
  const w = db.wallets.get(wid); // その作業場の財布
  if (w) w.monthlyGrant = PLANS[plan].monthlyCredits; // 毎月付与量を新プランの値に更新（残高はここでは変えない）
}

// 月次クレジットを付与する（dedupeKey が同じ支払いは二度と付与しない＝二重計上防止）
// dedupeKey＝二重付与を防ぐための「支払いの合言葉」。同じ合言葉なら2回目以降は無視する。
export function grantMonthlyCredits(wid: string, plan: Plan, dedupeKey?: string): void {
  if (dedupeKey) {
    if (db.grantedKeys.has(dedupeKey)) return; // 既に付与済み → スキップ
    // ★メモリ肥大防止：冪等キーが増えすぎたら古い分を捨てる（本番はDBのユニーク制約に移行）
    if (db.grantedKeys.size > 50000) db.grantedKeys.clear();
    db.grantedKeys.add(dedupeKey); // 今回の合言葉を「付与済み」として覚える
  }
  const w = db.wallets.get(wid); // 対象の財布を取り出す
  if (!w) return; // 無ければ何もしない
  const grant = PLANS[plan].monthlyCredits; // このプランで付与すべきクレジット数
  w.balance += grant; // 残高に足す
  db.creditTx.push({ // 付与を履歴にも記録する
    id: id("ctx"),
    workspaceId: wid,
    delta: grant, // プラス＝付与
    reason: "grant",
    note: `${PLANS[plan].label} プランのクレジット付与`,
    createdAt: Date.now(),
  });
}

// ---- 監査ログ（誰がいつ何をしたか）----
// 監査ログを1件追加する（ID と時刻は自動付与）。上限を超えたら古い分を捨てる。
export function addAudit(entry: Omit<AuditLog, "id" | "at">): void {
  db.audits.push({ ...entry, id: id("aud"), at: Date.now() }); // 渡された内容にID・時刻を足して追加
  if (db.audits.length > 100000) db.audits.splice(0, db.audits.length - 100000); // 上限（10万件を超えたら古い方から削る）
}
// 指定ワークスペースに関する監査ログ（新しい順）
// target＝対象（作業場IDなど）、limit＝取得件数の上限（既定50件）。
export function listAudits(target: string, limit = 50): AuditLog[] {
  return db.audits
    .filter((a) => a.target === target) // 対象が一致するログだけ残す
    .sort((a, b) => b.at - a.at) // 新しい順に並べる
    .slice(0, limit); // 先頭から上限件数だけ取り出す
}

// ---- オプトアウト抑制リスト（メール/ドメインを配信・取得から除外）----
// オプトアウト＝相手が「連絡してこないで」と拒否すること。ここではその対象を登録する。
export function addSuppression(value: string): void {
  const v = value.trim().toLowerCase(); // 前後の空白を削り小文字にそろえる（表記ゆれ対策）
  if (v) db.suppression.add(v); // 空でなければ抑制リストに追加
}
// メール（とそのドメイン）が抑制対象かどうか
export function isSuppressed(email?: string): boolean {
  if (!email) return false; // メールが無ければ対象外
  const e = email.trim().toLowerCase(); // 比較用に整える
  if (db.suppression.has(e)) return true; // メール完全一致で抑制されていれば true
  const at = e.lastIndexOf("@"); // 「@」の位置を探す（ドメイン部分を取り出すため）
  if (at >= 0 && db.suppression.has(e.slice(at + 1))) return true; // ドメイン単位の抑制
  return false; // どれにも当たらなければ対象外
}
// 会社のドメインそのものが抑制対象かどうか（メールが未取得のリードでもドメイン抑制を効かせるため）。
export function isDomainSuppressed(domain?: string): boolean {
  if (!domain) return false; // ドメインが無ければ対象外
  const d = domain.trim().toLowerCase().replace(/^www\./, ""); // 比較用に整える（www.は除く）
  return db.suppression.has(d); // ドメイン完全一致で抑制されていれば true
}


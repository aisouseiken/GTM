// ============================================================================
// このファイルは「新規登録」「ログイン」「ログアウト」の3つの処理をまとめたものです。
// つまり“ユーザーが会員になったり、入口を通ったり、出ていったり”する部分の担当です。
//
// ※「"use server"」= これらの関数はサーバー（会社の裏側のコンピューター）側で動く、という宣言です。
//   ブラウザ（利用者の画面）ではなくサーバーで動かすことで、パスワードなどの大事な情報を安全に扱えます。
//   このような「画面から呼び出してサーバーで動かす関数」をサーバーアクションと呼びます。
//
//   本物のパスワード認証（本人確認）の流れ：
//   登録時にパスワードをハッシュ化（元に戻せない形に変換）して保存し、
//   ログイン時に「入力されたパスワードを同じ方法で変換した結果」と保存済みの値を照合します。
//   こうすると、たとえ保存データが盗まれても元のパスワードはバレません。
// ============================================================================

"use server";

// redirect = 別のページへ自動的に画面を移動させる道具
import { redirect } from "next/navigation";
// randomUUID = 重複しないランダムな文字列を作る道具（ゲスト用の使い捨てメールに使う）
import { randomUUID } from "crypto";
// establishSession = ログイン状態を作る（本人だと覚えさせる）／ signOut = ログイン状態を消す
import { establishSession, signOut } from "@/lib/auth/session";
// ユーザー作成・メールからユーザー検索・ワークスペース一覧取得・監査ログ記録などの部品
import { createUser, getUserByEmail, listWorkspaces, addAudit } from "@/lib/data/store";
// hashPassword = パスワードを元に戻せない形に変換 ／ verifyPassword = 入力と保存済みが一致するか確認
import { hashPassword, verifyPassword } from "@/lib/auth/password";
// rateLimit = 短時間に何度も試された回数を制限する仕組み（いたずら・攻撃を防ぐ）
import { rateLimit } from "@/lib/ratelimit";

// フォームの結果（エラー文言を画面に返すための入れ物）
// error があればその文章を画面に赤字などで表示する想定です。
export interface AuthState {
  error?: string;
}

// ★タイミング攻撃対策用のダミーハッシュ（起動時に1回だけ作る）。
//   ログインで「メールが存在しない／パスワード未設定」のときも、これに対して照合を走らせ、
//   処理時間を「実在ユーザーの照合」とそろえる。応答の速さでメールの有無を推測させないため。
const DUMMY_PASSWORD_HASH = hashPassword("gtm-timing-guard-constant");

// メールアドレスの形式が正しいかを、簡単なパターン照合でチェックする関数。
// 「文字＠文字．文字」のような、最低限メールらしい形かどうかだけを見ています。
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 【新規登録】メール・名前・パスワードを受け取り、問題なければ会員を作ってログイン状態にする関数。
export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // 入力フォームから各項目を取り出す。
  // メールは前後の空白を消し（trim）、大文字を小文字にそろえる（toLowerCase）＝表記ゆれ防止
  const email = String(formData.get("email") || "").trim().toLowerCase();
  // 名前も前後の空白を消しておく
  const name = String(formData.get("name") || "").trim();
  // パスワードは空白を消さない（先頭・末尾のスペースも本人が決めた一部かもしれないため）
  const password = String(formData.get("password") || "");
  const agree = formData.get("agree"); // 「利用規約に同意する」のチェックが入っているか

  // ここから入力チェック。1つでもダメならエラー文言を返して登録を中止する。
  if (!isValidEmail(email)) return { error: "メールアドレスの形式が正しくありません。" }; // メール形式がおかしい
  if (name.length < 1) return { error: "お名前を入力してください。" }; // 名前が空
  if (password.length < 8) return { error: "パスワードは8文字以上にしてください。" }; // 短すぎるパスワードは危険
  if (!agree) return { error: "利用規約とプライバシーポリシーへの同意が必要です。" }; // 同意なしは登録不可
  // レート制限：同じメールで1分（60_000ミリ秒）に5回まで。連続登録の乱発を防ぐ
  if (!rateLimit(`signup:${email}`, 5, 60_000)) return { error: "しばらくしてからお試しください。" };

  // 既に登録済みのメールなら、登録ではなくログインへ誘導する
  if (getUserByEmail(email)) return { error: "このメールアドレスは既に登録されています。ログインしてください。" };

  // 会員を新規作成する。パスワードはハッシュ化（元に戻せない形に変換）してから渡す＝生のまま保存しない
  const user = createUser(email, name, hashPassword(password));
  // 作った会員でログイン状態を確立する（この後はログイン済みとして扱われる）
  await establishSession(user);
  // 監査ログ（誰が何をしたかの記録）に「新規登録した」ことを残す
  addAudit({ actor: `user:${user.id}`, action: "signup", meta: { email } });
  // この会員が持つワークスペース（作業場）の一覧を取得する
  const ws = listWorkspaces(user.id);
  // ワークスペースがあればその最初の作業場へ、なければ共通の入口(/app)へ画面を移動させる
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// 【ログイン】メールとパスワードを照合し、正しければログイン状態にする関数。
export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // フォームからメールとパスワードを取り出す（メールは表記ゆれ防止のため小文字化）
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  // どちらかが未入力なら中止
  if (!email || !password) return { error: "メールアドレスとパスワードを入力してください。" };
  // レート制限：同じメールで1分に10回まで（パスワードの総当たり＝片っ端から試す攻撃を抑える）
  if (!rateLimit(`login:${email}`, 10, 60_000)) return { error: "試行回数が多すぎます。しばらくしてからお試しください。" };

  // メールをもとに会員を探す（存在しなければ user は空になる）
  const user = getUserByEmail(email);
  // ★「そのメールが登録されているかどうか」を攻撃者に推測されないよう、
  //   ユーザーが居ない場合も、パスワードが違う場合も、まったく同じエラー文言を返す。
  //   さらに、ユーザー不在／パスワード未設定でもダミーハッシュに対して照合を実行し、
  //   処理時間をそろえる（応答の速さでメールの有無を推測されるのを防ぐ＝タイミング攻撃対策）。
  const ok = user?.passwordHash
    ? verifyPassword(password, user.passwordHash)
    : (verifyPassword(password, DUMMY_PASSWORD_HASH), false);
  if (!ok || !user) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // ここまで来たら本人確認OK。ログイン状態を確立する
  await establishSession(user);
  // 監査ログに「ログインした」ことを記録する
  addAudit({ actor: `user:${user.id}`, action: "login", meta: { email } });
  // 会員のワークスペース一覧を取得する
  const ws = listWorkspaces(user.id);
  // ワークスペースがあればその最初の作業場へ、なければ共通の入口(/app)へ移動させる
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// 【ゲストで試す】ID・パスワードなしで、その場で使い捨てのお試しアカウントを作ってログイン状態にする関数。
//   登録フォームを一切通さずに、すぐアプリを触ってもらうための無料お試し導線。
//   ※メモリ上の一時アカウントなので、サーバー再起動で消えます（お試し用途に十分）。
export async function guestAction() {
  // レート制限：ゲスト作成の乱発（メモリ圧迫・いたずら）を防ぐ。全体で1分に30回まで。
  if (!rateLimit("guest-create", 30, 60_000)) redirect("/login");
  // 重複しない使い捨てメールを作る（画面上は表示されない内部用の識別子）。
  // ★UUID全体を使う（以前は先頭8桁=32bitで衝突しうり、衝突時に別ゲストへ相乗りする恐れがあった）。
  const email = `guest-${randomUUID()}@guest.local`;
  // パスワードなしでゲスト会員を作成する（このアカウントはログイン照合には使えない＝ゲスト専用）。
  const user = createUser(email, "ゲスト");
  // 作ったゲストでログイン状態を確立する（この後はログイン済みとして扱われる）。
  await establishSession(user);
  // 監査ログに「ゲストとして開始した」ことを記録する。
  addAudit({ actor: `user:${user.id}`, action: "guest", meta: { email } });
  // ゲストにも自動でワークスペース（作業場）が用意される。その最初の作業場へ移動させる。
  const ws = listWorkspaces(user.id);
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

// 【ログアウト】ログイン状態を消して、トップページ("/")へ戻す関数。
export async function logoutAction() {
  // ログイン情報（セッション＝本人だと覚えている情報）を消す
  await signOut();
  // トップページへ画面を移動させる
  redirect("/");
}

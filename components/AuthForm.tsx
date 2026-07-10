"use client";

// この部品は「ログイン／新規登録」の入力フォームです。
// サーバーの処理(loginAction / signupAction)に送信し、エラーがあれば画面に表示します。
// useActionState = サーバー処理の結果（エラー文言）を受け取り、画面に反映するためのReactの仕組み。

// useActionState（サーバー処理の結果を画面に反映する仕組み）をReactから取り込む。
import { useActionState } from "react";
import Link from "next/link"; // ページ移動用のリンク部品。
import { Logo } from "./Logo"; // 自作のロゴ部品。
import type { AuthState } from "@/app/actions/auth"; // 処理結果（エラー文言など）の「型（決まった形）」。

// Action = このフォームが呼び出すサーバー処理の形。前回の状態と入力内容を受け取り、新しい状態を返す。
type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

// mode = ログイン用か新規登録用か / action = 送信時に実行するサーバー処理。
export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  // state=処理結果（エラー文言）/ formAction=フォーム送信先の処理 / pending=送信中かどうか(true/false)。
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const isSignup = mode === "signup"; // 新規登録モードなら true。表示文言や項目の出し分けに使う。

  return (
    // 画面全体を縦に並べ、高さは最低でも画面いっぱいにする枠。
    <div className="flex min-h-screen flex-col">
      {/* 上部：ロゴを左に置くヘッダー領域 */}
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <Logo />
      </div>
      {/* 中央：フォーム本体を画面の真ん中に配置する領域 */}
      <div className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">
          {/* 見出し。モードによって文言を切り替える */}
          <h1 className="font-serif-display text-3xl text-ink">
            {isSignup ? "無料ではじめる" : "おかえりなさい"}
          </h1>
          {/* 見出し下の説明文。モードによって文言を切り替える */}
          <p className="mt-2 text-sm text-ink-soft">
            {isSignup
              ? "1,000 クレジット付き。クレジットカード不要。"
              : "メールアドレスとパスワードでログイン"}
          </p>

          {/* 入力フォーム本体。送信すると formAction（サーバー処理）が実行される */}
          <form action={formAction} className="mt-8 space-y-4">
            {/* 新規登録のときだけ「お名前」欄を表示する */}
            {isSignup && (
              <div>
                <label className="mb-1 block text-sm text-ink-soft">お名前</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="山田 太郎"
                  className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
                />
              </div>
            )}
            {/* メールアドレスの入力欄（必須・メール形式） */}
            <div>
              <label className="mb-1 block text-sm text-ink-soft">メールアドレス</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </div>
            {/* パスワードの入力欄（必須・8文字以上） */}
            <div>
              <label className="mb-1 block text-sm text-ink-soft">パスワード</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={isSignup ? "8文字以上" : "パスワード"}
                className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </div>

            {/* 新規登録のときだけ、利用規約への同意チェックを表示する */}
            {isSignup && (
              <label className="flex items-start gap-2 text-xs text-ink-soft">
                <input name="agree" type="checkbox" className="mt-0.5" />
                <span>
                  <Link href="/legal/terms" className="text-brand hover:underline">利用規約</Link>
                  と
                  <Link href="/legal/privacy" className="text-brand hover:underline">プライバシーポリシー</Link>
                  に同意します
                </span>
              </label>
            )}

            {/* サーバーから返ってきたエラー文言 */}
            {state.error && (
              <p className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm text-[#9a3b3b]">{state.error}</p>
            )}

            {/* 送信ボタン。送信中は押せなくし（disabled）、文言も切り替える */}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "処理中…" : isSignup ? "無料で登録" : "ログイン"}
            </button>
          </form>

          {/* フォーム下の案内文。ログイン画面と登録画面を互いに行き来できるリンク */}
          <p className="mt-6 text-center text-sm text-muted">
            {isSignup ? (
              // 新規登録画面のとき：既に会員ならログインへ誘導。
              <>
                すでにアカウントがある場合は{" "}
                <Link href="/login" className="font-medium text-brand hover:underline">ログイン</Link>
              </>
            ) : (
              // ログイン画面のとき：未会員なら登録へ誘導。
              <>
                アカウントがない場合は{" "}
                <Link href="/signup" className="font-medium text-brand hover:underline">無料で登録</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

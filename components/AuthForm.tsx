"use client";

// この部品は「ログイン／新規登録」の入力フォームです。
// サーバーの処理(loginAction / signupAction)に送信し、エラーがあれば画面に表示します。
// useActionState = サーバー処理の結果（エラー文言）を受け取り、画面に反映するためのReactの仕組み。

import { useActionState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import type { AuthState } from "@/app/actions/auth";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-3xl text-ink">
            {isSignup ? "無料ではじめる" : "おかえりなさい"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {isSignup
              ? "1,000 クレジット付き。クレジットカード不要。"
              : "メールアドレスとパスワードでログイン"}
          </p>

          <form action={formAction} className="mt-8 space-y-4">
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

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "処理中…" : isSignup ? "無料で登録" : "ログイン"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {isSignup ? (
              <>
                すでにアカウントがある場合は{" "}
                <Link href="/login" className="font-medium text-brand hover:underline">ログイン</Link>
              </>
            ) : (
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

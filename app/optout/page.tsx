"use client";

// このページは「オプトアウト（自分の連絡先を提供・配信の対象から外す）」の受付窓口です。
// メールアドレスまたはドメインを入力して送信すると、以後その連絡先は当社の対象から除外されます。
// ログイン不要で誰でも利用できます（個人情報保護のため）。

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function OptOutPage() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (!value.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/optout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(data.error || "送信に失敗しました。");
      }
    } catch {
      setStatus("error");
      setMessage("送信に失敗しました。");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-line/60">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="font-serif-display text-3xl text-ink">オプトアウト・データ削除のご請求</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          ご自身のメールアドレス、または会社のドメインを入力して送信してください。
          以後、当該の連絡先は GTM の提供・配信の対象から除外されます。
          既に保有している該当データも削除の対象とします。
        </p>

        {status === "done" ? (
          <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
            <p className="text-sm text-ink">
              受け付けました。以後、入力いただいた連絡先は対象から除外されます。ご協力ありがとうございました。
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              トップへ戻る
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="you@company.com または company.com"
              className="flex-1 rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={submit}
              disabled={status === "sending"}
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "sending" ? "送信中…" : "除外を申請する"}
            </button>
          </div>
        )}
        {status === "error" && <p className="mt-3 text-sm text-[#9a3b3b]">{message}</p>}

        <p className="mt-8 text-xs text-muted">
          個人情報の取り扱いについては
          <Link href="/legal/privacy" className="text-brand hover:underline">プライバシーポリシー</Link>
          をご覧ください。
        </p>
      </main>
    </div>
  );
}

// このファイルには、料金・請求まわりの操作ボタンが2つあります。
// 1つ目 PlanChangeButton はプランを変更するボタン、2つ目 ManageBillingButton は支払い方法を管理するボタン。
// どちらもボタンを押すとサーバーに依頼し、必要なら決済サービス（Stripe）の画面へ移動します。
// ※「"use client"」= ブラウザ側で動く部品（クリックに反応するため）。
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/domain/types";

// プラン変更ボタン（Stripe Checkout へ。鍵未設定時はモックで即時反映）
// ※Stripe = 決済（お金の支払い）を扱う外部サービス。※モック = 本番の代わりの仮の動き。
export function PlanChangeButton({
  workspaceId,
  plan,
  current,
  highlight,
}: {
  workspaceId: string;
  plan: Plan;
  current: boolean;
  highlight?: boolean;
}) {
  const [loading, setLoading] = useState(false); // 処理中かどうか（二重押し防止）。
  const [error, setError] = useState<string | null>(null); // 失敗時のメッセージ（無言失敗を防ぐ）
  const router = useRouter(); // 画面の再表示などに使う。

  // ボタンが押されたときの処理。
  const onClick = async () => {
    if (current || loading) return; // 今のプラン、または処理中なら何もしない。
    setLoading(true);
    setError(null);
    try {
      // サーバーに「このプランに変えたい」と伝える。
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // ★失敗（403/503等）を無言でにぎりつぶさず、ユーザーに伝える（本番で決済未設定時など）
        setError(
          res.status === 503
            ? "現在、決済の準備中のため変更できません。"
            : (data.error ?? "プランを変更できませんでした。")
        );
        return;
      }
      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url; // Stripe Checkout へ遷移（支払いページへ移動）
      } else {
        // モック：プラン適用済み。画面を更新
        router.refresh();
      }
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false); // 成功・失敗どちらでも最後に処理中を解除。
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        disabled={current || loading}
        className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-medium ${
          current
            ? "cursor-default border border-line text-muted"
            : highlight
              ? "bg-ink text-white"
              : "border border-line-strong bg-paper text-ink hover:bg-cream-100"
        }`}
      >
        {current ? "利用中" : loading ? "処理中…" : "変更する"}
      </button>
      {/* 失敗したときのメッセージ（無言失敗を防ぐ） */}
      {error && <p className="mt-2 text-xs text-[#9a3b3b]">{error}</p>}
    </>
  );
}

// 支払い方法・請求管理（Stripe Billing Portal へ）
// ※Billing Portal = クレジットカード変更や請求履歴を確認できる Stripe の管理画面。
export function ManageBillingButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false); // 処理中かどうか。
  // ボタンが押されたときの処理。
  const onClick = async () => {
    setLoading(true);
    try {
      // サーバーに、請求管理画面のリンクを作ってもらうよう頼む。
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      // リンクがあればその管理画面へ移動。無ければデモ中である旨を知らせる。
      if (data.mode === "stripe" && data.url) window.location.href = data.url;
      else alert("決済（Stripe）は最終フェーズで有効化されます。現在はデモ用の残高で動作しています。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-cream-100"
    >
      {loading ? "処理中…" : "支払い方法を管理"}
    </button>
  );
}

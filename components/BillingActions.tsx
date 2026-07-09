"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/domain/types";

// プラン変更ボタン（Stripe Checkout へ。鍵未設定時はモックで即時反映）
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onClick = async () => {
    if (current || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, plan }),
      });
      const data = await res.json();
      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url; // Stripe Checkout へ遷移
      } else {
        // モック：プラン適用済み。画面を更新
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}

// 支払い方法・請求管理（Stripe Billing Portal へ）
export function ManageBillingButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
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

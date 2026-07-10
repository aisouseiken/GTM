import { NextResponse } from "next/server";
import { addSuppression, addAudit } from "@/lib/data/store";
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（POST /api/optout）は、誰でも使える「オプトアウト（配信・提供の停止）」窓口です。
 * 自分のメールアドレスやドメインを送ると、以後そのメール/ドメインは当社の提供・配信対象から除外されます。
 * 個人情報保護の観点から、ログイン不要で受け付けます（ただし乱用防止のためレート制限あり）。
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const value = String(body.value || "").trim().toLowerCase();
  // メールアドレス、または「example.com」形式のドメインのみ受け付ける
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value);
  if (!ok) return NextResponse.json({ error: "メールアドレスまたはドメインを入力してください。" }, { status: 400 });
  // レート制限：同じ値で1時間に5回まで
  if (!rateLimit(`optout:${value}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "しばらくしてからお試しください。" }, { status: 429 });
  }
  addSuppression(value);
  addAudit({ actor: "public", action: "optout", target: value });
  return NextResponse.json({ ok: true });
}

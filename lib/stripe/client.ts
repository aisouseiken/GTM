// Stripe クライアントとプラン設定。
// STRIPE_SECRET_KEY が未設定なら「モック」動作（キー投入で本番稼働）。
// 実装（Checkout / Portal / Webhook）は用意済みで、鍵は最後にクライアントが設定する。

import Stripe from "stripe";
import type { Plan } from "@/lib/domain/types";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null; // 未設定＝モック
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export const STRIPE_ENABLED = () => !!process.env.STRIPE_SECRET_KEY;

// プラン → Stripe Price ID を格納した環境変数名（値は最後に設定）
const PRICE_ENV: Partial<Record<Plan, string>> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  scale: "STRIPE_PRICE_SCALE",
};

export function priceIdForPlan(plan: Plan): string | undefined {
  const envName = PRICE_ENV[plan];
  return envName ? process.env[envName] : undefined;
}

export const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET;

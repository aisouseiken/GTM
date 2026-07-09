import type { Market } from "@/lib/domain/types";

export const MOCK_MODE = process.env.MOCK_MODE !== "false"; // 既定はモック
export const MARKET_DEFAULT: Market =
  (process.env.MARKET_DEFAULT as Market) === "GLOBAL" ? "GLOBAL" : "JP";

export function formatJpy(n: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

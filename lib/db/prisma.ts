// Prisma クライアント（シングルトン）。
// DATABASE_URL（クライアント用意の開発環境）に接続する。
// 接続情報が来るまではインメモリ store で稼働継続 → 接続後にこのクライアント経由へ切替える。

import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __gtmPrisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__gtmPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.__gtmPrisma = prisma;

// DATABASE_URL が設定されているか（未設定ならインメモリ store を使用）
export const DB_ENABLED = () => !!process.env.DATABASE_URL;

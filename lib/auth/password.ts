// パスワードのハッシュ化と照合。
//
// このファイルの役割：
//   パスワードは「そのまま保存」してはいけない（漏れたら即アウト）。
//   一方向の変換（ハッシュ）にして保存し、ログイン時は入力を同じ方式で変換して一致するか比べる。
//   ここでは Node 標準の scrypt（ソルト付き・計算コストが高く総当たりに強い）を使う。外部ライブラリ不要。

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// パスワードをハッシュ化する。形式: "salt:hash"（どちらも16進）。
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex"); // 利用者ごとに違う「塩」を混ぜる（レインボー表対策）
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// 入力パスワードが、保存済みハッシュと一致するか検証する。
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  // タイミング攻撃を避けるため timingSafeEqual で比較（長さが違えば即 false）
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

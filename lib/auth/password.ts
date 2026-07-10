// パスワードのハッシュ化と照合。
//
// このファイルの役割：
//   パスワードは「そのまま保存」してはいけない（漏れたら即アウト）。
//   一方向の変換（ハッシュ）にして保存し、ログイン時は入力を同じ方式で変換して一致するか比べる。
//   ここでは Node 標準の scrypt（ソルト付き・計算コストが高く総当たりに強い）を使う。外部ライブラリ不要。

// crypto（暗号の道具箱）から3つの道具を借りる。
// randomBytes＝推測できないランダム値を作る、scryptSync＝パスワード用の重いハッシュ計算、
// timingSafeEqual＝2つの値を「比較にかかる時間で中身を推測されない」よう安全に比べる道具。
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// パスワードをハッシュ化する。形式: "salt:hash"（どちらも16進）。
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex"); // 利用者ごとに違う「塩」を混ぜる（レインボー表対策）
  // salt（塩）＝ハッシュ前に混ぜる利用者ごとの追加文字。同じパスワードでも結果が変わり、事前計算表での照合を防ぐ。
  const hash = scryptSync(password, salt, 64).toString("hex"); // パスワードと塩から64バイトのハッシュを計算し16進文字列に
  return `${salt}:${hash}`; // 「塩:ハッシュ」を1つの文字列にまとめて返す（検証時に塩を取り出せるようにする）
}

// 入力パスワードが、保存済みハッシュと一致するか検証する。一致すれば true。
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false; // 保存済みの値が無ければ照合しようがないので false
  const [salt, hash] = stored.split(":"); // 保存文字列を「:」で分けて、塩とハッシュに取り出す
  if (!salt || !hash) return false; // どちらかが欠けていれば壊れた値なので false
  const expected = Buffer.from(hash, "hex"); // 保存されていた「正解のハッシュ」をバイト列に戻す
  const actual = scryptSync(password, salt, 64); // 入力パスワードを同じ塩で計算した「今回のハッシュ」
  // タイミング攻撃を避けるため timingSafeEqual で比較（長さが違えば即 false）
  // タイミング攻撃＝比較にかかる時間の差から中身を推測する攻撃。長さが違う時点で安全に false を返す。
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual); // 中身が完全一致すれば true（一致＝正しいパスワード）
}

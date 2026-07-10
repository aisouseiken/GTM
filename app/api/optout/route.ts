// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// データ保管庫の道具を読み込む（除外リストへの追加・監査ログの記録）
import { addSuppression, addAudit } from "@/lib/data/store";
// 「短時間に何度も叩かれていないか（乱用防止）」を判定する道具を読み込む
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（POST /api/optout）は、誰でも使える「オプトアウト（配信・提供の停止）」窓口です。
 * 自分のメールアドレスやドメインを送ると、以後そのメール/ドメインは当社の提供・配信対象から除外されます。
 * 個人情報保護の観点から、ログイン不要で受け付けます（ただし乱用防止のためレート制限あり）。
 * ※「ドメイン」＝メールアドレスの＠より後ろ（例：example.com）の部分。会社まるごと除外したいときに使う。
 */
export async function POST(req: Request) {
  // リクエストの本文（送られてきたデータ）をJSONとして読み取る。壊れていたら null 扱いにする
  const body = await req.json().catch(() => null);
  // 読み取れなかった場合は「400（リクエストが不正）」を返して中断する
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 送られてきた値を文字列にし、前後の空白を除き、すべて小文字にそろえる（表記ゆれをなくすため）
  const value = String(body.value || "").trim().toLowerCase();
  // 入力が「メールアドレスの形」または「example.com のようなドメインの形」のどちらかに合っているか確認する
  // （/.../ は文字の並びのパターン照合。合っていれば true になる）
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value);
  // どちらの形にも当てはまらなければ、入力し直しをお願いして中断する（400＝入力ミス）
  if (!ok) return NextResponse.json({ error: "メールアドレスまたはドメインを入力してください。" }, { status: 400 });
  // 同じ値での申請は「1時間（＝60分×60000ミリ秒）に5回まで」に制限する
  // 上限を超えていたら「429（回数オーバー）」を返し、しばらく待つよう促す（いたずら防止）
  if (!rateLimit(`optout:${value}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "しばらくしてからお試しください。" }, { status: 429 });
  }
  // 受け付けた値を「除外リスト（提供・配信しない一覧）」に追加する
  addSuppression(value);
  // 「誰が・何を・どの対象に対して行ったか」を監査ログ（後から確認できる記録）に残す
  // actor は "public"（＝ログインしていない一般利用者）
  addAudit({ actor: "public", action: "optout", target: value });
  // 正常に受け付けたことを伝える（ok: true）
  return NextResponse.json({ ok: true });
}

// "use client"＝この画面は利用者のブラウザ側で動く部品（ボタン操作などに反応するため）という宣言。
"use client";

// このページは「オプトアウト（自分の連絡先を提供・配信の対象から外す）」の受付窓口です。
// メールアドレスまたはドメインを入力して送信すると、以後その連絡先は当社の対象から除外されます。
// ログイン不要で誰でも利用できます（個人情報保護のため）。

// useState＝画面の状態（入力内容や送信中かどうか）を覚えておくための仕組みを持ち込む。
import { useState } from "react";
// Link＝別ページへ移動する入口（リンク）を作る部品。
import Link from "next/link";
// Logo＝サービスのロゴ（会社のマーク）を表示する部品。
import { Logo } from "@/components/Logo";

// オプトアウトページを組み立てる部品。
export default function OptOutPage() {
  // value＝入力欄に打ち込まれた文字。setValueで書き換える。最初は空っぽ。
  const [value, setValue] = useState("");
  // status＝今の状態。idle=待機中／sending=送信中／done=完了／error=失敗。最初はidle。
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  // message＝失敗したときに表示するエラー文。setMessageで書き換える。最初は空っぽ。
  const [message, setMessage] = useState("");

  // 「除外を申請する」ボタンが押されたときに動く処理。
  const submit = async () => {
    // 入力が空（または空白だけ）なら、何もせずに処理を中断する。
    if (!value.trim()) return;
    // 状態を「送信中」に切り替える（ボタンを押せなくして二重送信を防ぐ）。
    setStatus("sending");
    // 通信は失敗することもあるので、try（試す）で囲んでエラーに備える。
    try {
      // サーバーの受付窓口（/api/optout）へ、入力内容を送る。
      const res = await fetch("/api/optout", {
        method: "POST", // POST＝データを送って処理してもらう送り方
        headers: { "Content-Type": "application/json" }, // 送る中身はJSON形式だと伝える
        body: JSON.stringify({ value }), // 入力値をJSON形式の文字に変換して送る
      });
      // サーバーからの返事（JSON形式）を受け取って読み取る。
      const data = await res.json();
      // res.ok＝サーバーが「成功」で返した場合。
      if (res.ok) {
        // 状態を「完了」に切り替える（お礼メッセージが表示される）。
        setStatus("done");
      } else {
        // 成功でなければ、状態を「失敗」にする。
        setStatus("error");
        // サーバーからのエラー文があればそれを、無ければ定型文を表示用にセット。
        setMessage(data.error || "送信に失敗しました。");
      }
    } catch {
      // 通信自体ができなかった場合（ネット切れ等）も、状態を「失敗」にする。
      setStatus("error");
      // 失敗の定型文を表示用にセット。
      setMessage("送信に失敗しました。");
    }
  };

  // return（返す）の中身が、実際に画面に表示される見た目です。
  return (
    // 画面全体を縦一列に並べる大きな入れ物（クリーム色の背景・最低でも画面の高さいっぱい）。
    <div className="flex min-h-screen flex-col bg-cream">
      {/* header＝ページ上部の帯。ここにロゴを置く */}
      <header className="border-b border-line/60">
        {/* ロゴを置くための中央寄せの枠 */}
        <div className="mx-auto flex h-16 max-w-2xl items-center px-6">
          <Logo />
        </div>
      </header>
      {/* main＝ページの中心。見出し・説明・入力欄などを置く */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {/* ページの大見出し */}
        <h1 className="font-serif-display text-3xl text-ink">オプトアウト・データ削除のご請求</h1>
        {/* 何をする窓口かを説明する文章 */}
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          ご自身のメールアドレス、または会社のドメインを入力して送信してください。
          以後、当該の連絡先は GTM の提供・配信の対象から除外されます。
          既に保有している該当データも削除の対象とします。
        </p>

        {/* 状態が「完了(done)」なら → お礼メッセージを表示。そうでなければ → 入力欄を表示（三項演算＝もし〜ならAを、違えばBを表示） */}
        {status === "done" ? (
          // 【完了時の表示】お礼メッセージとトップへ戻るリンクの枠
          <div className="mt-6 rounded-2xl border border-line bg-paper p-6">
            {/* 受付完了のお礼メッセージ */}
            <p className="text-sm text-ink">
              受け付けました。以後、入力いただいた連絡先は対象から除外されます。ご協力ありがとうございました。
            </p>
            {/* トップページ（/）へ戻るリンク */}
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              トップへ戻る
            </Link>
          </div>
        ) : (
          // 【入力時の表示】入力欄と送信ボタンを横並び（スマホでは縦並び）にする枠
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {/* メールアドレスやドメインを打ち込む入力欄 */}
            <input
              value={value} // 現在の入力内容を表示
              onChange={(e) => setValue(e.target.value)} // 文字が変わるたびに入力内容を覚え直す
              placeholder="you@company.com または company.com" // 何を入れればよいかの薄いお手本文字
              className="flex-1 rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
            />
            {/* 送信ボタン */}
            <button
              onClick={submit} // 押したら上で作ったsubmit（送信処理）を動かす
              disabled={status === "sending"} // 送信中は押せないようにする（二重送信の防止）
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {/* 送信中は「送信中…」、それ以外は「除外を申請する」とボタン文字を切り替える */}
              {status === "sending" ? "送信中…" : "除外を申請する"}
            </button>
          </div>
        )}
        {/* 状態が「失敗(error)」のときだけ、赤い文字でエラー内容を表示する */}
        {status === "error" && <p className="mt-3 text-sm text-[#9a3b3b]">{message}</p>}

        {/* 個人情報の扱いについての案内（プライバシーポリシーへのリンク付き） */}
        <p className="mt-8 text-xs text-muted">
          個人情報の取り扱いについては
          <Link href="/legal/privacy" className="text-brand hover:underline">プライバシーポリシー</Link>
          をご覧ください。
        </p>
      </main>
    </div>
  );
}

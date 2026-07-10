// "use client" = この部品はブラウザ側で動く（ボタンのクリックなどユーザー操作に反応する）という宣言。
"use client";

// このファイルは「ページ内で予期せぬエラーが起きたとき」に表示する画面です。
// アプリ全体が真っ白になって固まるのを防ぎ、利用者に分かりやすい案内と再試行ボタンを出します。
// ※内部のエラー詳細（スタックなど）は画面に出さず、汎用メッセージのみ表示します。
// reset = 「もう一度やり直す」ための関数（呼ぶと画面の再読み込みを試みる）。error は受け取るが画面には出さない。
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    // 画面いっぱいを使い、中身を上下左右の中央にそろえて並べる外枠。
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      {/* 大きな見出し：何か問題が起きたことを伝える */}
      <h1 className="font-serif-display text-3xl text-ink">問題が発生しました</h1>
      {/* 補足の案内文：一時的な不具合なのでやり直してほしい、と伝える */}
      <p className="max-w-md text-sm text-ink-soft">
        一時的なエラーが発生しました。お手数ですが、もう一度お試しください。
      </p>
      {/* 押すと reset() が動き、画面をもう一度読み込み直す再試行ボタン */}
      <button
        onClick={() => reset()} // クリックされたら「やり直す」関数を実行。
        className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white"
      >
        再試行する
      </button>
    </div>
  );
}

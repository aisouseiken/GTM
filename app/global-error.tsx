// "use client" = この部品はブラウザ側で動く（ボタンのクリックに反応する）という宣言。
"use client";

// このファイルは「レイアウトを含む最上位でエラーが起きたとき」の最終防衛ラインの画面です。
// 通常の error.tsx で受け止められない深いエラーでも、真っ白にせず案内を表示します。
// ※このため html/body から自前で用意しています（土台ごと壊れても表示できるように）。
// reset = 「もう一度やり直す」関数（呼ぶと再読み込みを試みる）。
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    // 最上位で壊れているため、共通の土台に頼らず html から自分で書き起こす。日本語ページと宣言。
    <html lang="ja">
      {/* 見た目の指定は共通ファイルが使えない可能性があるため、その場で直接（style で）指定する */}
      {/* 画面いっぱいを使い中央にそろえる・文字色・背景色（クリーム）などをここで直書き */}
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#f7f5f2", color: "#1a1a1a" }}>
        {/* 中央に置く案内のかたまり。中身を中央そろえ・周囲に余白 */}
        <div style={{ textAlign: "center", padding: "24px" }}>
          {/* 見出し：問題が起きたことを伝える */}
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>問題が発生しました</h1>
          {/* 補足案内：一時的な不具合なのでやり直してほしい */}
          <p style={{ fontSize: "14px", color: "#4b4b4b", marginBottom: "16px" }}>
            一時的なエラーが発生しました。もう一度お試しください。
          </p>
          {/* 押すと reset() が動き、画面をもう一度読み込み直す再試行ボタン */}
          <button
            onClick={() => reset()} // クリックで「やり直す」関数を実行。
            style={{ background: "#1a1a1a", color: "#fff", border: "none", borderRadius: "9999px", padding: "12px 24px", fontSize: "14px", cursor: "pointer" }}
          >
            再試行する
          </button>
        </div>
      </body>
    </html>
  );
}

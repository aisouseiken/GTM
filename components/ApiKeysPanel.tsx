// この部品は「APIキー」を管理する画面です。APIキーとは、外部のプログラムがこのサービスを
// 利用するときの合言葉（パスワードのようなもの）です。ここで新しいキーを発行し、一覧を表示します。
// ※「"use client"」= ブラウザ側で動く部品（ボタン操作や入力に反応するため）。
"use client";

// useState（画面が覚えておく状態）を使うための道具をReactから取り込む。
import { useState } from "react";

// 画面で扱う公開用のキー情報（keyHash=鍵のハッシュは含めない＝漏えい防止）
// ※interface = このデータが「どんな項目を持つか」を決めた設計図（決まった形）。
export interface PublicApiKey {
  id: string; // キーを1つずつ見分けるための識別番号（ID）。
  name: string; // 利用者が付けたキーの名前（例：本番サーバー）。
  keyPreview: string; // キー全文の一部だけ（先頭数文字など）。全部は見せない。
  createdAt: number; // 作成した日時（コンピュータ用の数値形式）。
  lastUsedAt?: number; // 最後に使われた日時（?付き＝まだ一度も使われていない場合は無い）。
}

// workspaceId = どの作業スペース用のキーか、initialKeys = 最初から表示しておく既存キーの一覧。
export function ApiKeysPanel({
  workspaceId,
  initialKeys,
}: {
  workspaceId: string;
  initialKeys: PublicApiKey[];
}) {
  // 画面上で変化する値を覚えておく箱（state）。
  const [keys, setKeys] = useState<PublicApiKey[]>(initialKeys); // 表示中のキー一覧。
  const [name, setName] = useState(""); // 入力欄に打ち込まれたキー名。
  const [freshKey, setFreshKey] = useState<string | null>(null); // 発行直後のキー（1回だけ全文表示）。

  // 「発行」ボタンを押したときの処理。サーバーに新しいキーの作成を頼む。
  // ※async（非同期）= サーバーからの返事を待ってから続きを進める書き方。
  const create = async () => {
    // fetch = サーバーに問い合わせる命令。ここでは新規キー作成を依頼している。
    const res = await fetch("/api/apikeys", {
      method: "POST", // POST = 「新しく作って」という種類のお願い。
      headers: { "Content-Type": "application/json" }, // 送るデータがJSON形式だと伝える。
      // 送る中身：どの作業スペース用か＋キー名（未入力なら"API Key"を使う）。
      body: JSON.stringify({ workspaceId, name: name || "API Key" }),
    });
    // サーバーからの返事を受け取り、扱いやすいデータに直す。
    const data = await res.json();
    setFreshKey(data.raw); // 発行された生のキー文字列を保存し、画面に表示する。
    setKeys((k) => [data.apiKey, ...k]); // 一覧の先頭に新しいキーを追加（既存はそのまま後ろに）。
    setName(""); // 入力欄を空に戻す。
  };

  // 「失効」ボタン：漏れたキーを無効化する。サーバーに削除（失効）を頼み、一覧からも消す。
  // keyId = 失効させたいキーの識別番号。
  const revoke = async (keyId: string) => {
    // サーバーに「このキーを削除して」と依頼する。
    await fetch("/api/apikeys", {
      method: "DELETE", // DELETE = 「消して」という種類のお願い。
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId }), // 消したいキーの番号を送る。
    });
    // 一覧から、そのキー以外だけを残す（＝該当キーを画面上でも消す）。
    setKeys((k) => k.filter((x) => x.id !== keyId));
  };

  return (
    <div>
      {/* キー名の入力欄と「発行」ボタン */}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="キー名（例：本番サーバー）"
          className="flex-1 rounded-xl border border-line-strong bg-paper px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={create}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
        >
          発行
        </button>
      </div>

      {/* 発行直後だけ、キーの全文を表示する枠（この画面を離れると二度と見られない） */}
      {freshKey && (
        <div className="mt-4 rounded-xl border border-brand/40 bg-brand-soft/40 p-4">
          <div className="text-sm font-medium text-ink">新しいAPIキー（この画面でのみ表示されます）</div>
          <code className="mt-2 block break-all rounded-lg bg-paper px-3 py-2 font-mono text-xs text-ink">
            {freshKey}
          </code>
          {/* クリックするとキー文字列をクリップボード（コピー置き場）に写す */}
          <button
            onClick={() => navigator.clipboard?.writeText(freshKey)}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            コピー
          </button>
        </div>
      )}

      {/* 発行済みAPIキーの一覧表（名前・キーの一部・作成日を表示） */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          {/* 表の見出し行（各列が何かを示すラベル） */}
          <thead className="bg-cream-100/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">名前</th>
              <th className="px-4 py-2 font-medium">キー</th>
              <th className="px-4 py-2 font-medium">作成日</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {/* キーが1件も無いときの案内表示 */}
            {keys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  APIキーはまだありません
                </td>
              </tr>
            )}
            {/* キーの一覧を1件ずつ取り出し、それぞれを表の1行にして並べる */}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-line/70">
                {/* 1列目：キーの名前 */}
                <td className="px-4 py-2 text-ink">{k.name}</td>
                {/* 2列目：キーの一部だけ（全文は表示しない） */}
                <td className="px-4 py-2 font-mono text-xs text-muted">{k.keyPreview}</td>
                {/* 3列目：作成日を日本の表記（年/月/日）に直して表示 */}
                <td className="px-4 py-2 text-muted">
                  {new Date(k.createdAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-2 text-right">
                  {/* 漏れたキーを無効化する失効ボタン */}
                  <button
                    onClick={() => revoke(k.id)}
                    className="text-xs font-medium text-[#9a3b3b] hover:underline"
                  >
                    失効
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

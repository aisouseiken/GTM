// この画面は「公開API」ページです。外部のプログラムから検索を実行するためのAPIキーを発行・管理し、
// 使い方のサンプルコードも表示します。実際のキー発行フォームは ApiKeysPanel 部品が担当します。
// ※このファイルはサーバー側で動く部品。表示前に本人確認とデータ取得を行います。

// notFound = 「見つかりませんページ」を表示する道具（取り込み）。
import { notFound } from "next/navigation";
// getCurrentUser = 今ログインしている人を調べる道具（取り込み）。
import { getCurrentUser } from "@/lib/auth/session";
// getWorkspace = 作業スペース、getWallet = 残高、listApiKeys = APIキー一覧を取り出す道具（取り込み）。
// ※APIキー = 外部プログラムがこのサービスを使うための「合鍵（パスワードのような文字列）」。
import { getWorkspace, getWallet, listApiKeys } from "@/lib/data/store";
// AppShell = 共通の外枠（サイドバー等）の部品（取り込み）。
import { AppShell } from "@/components/AppShell";
// ApiKeysPanel = APIキーの発行・一覧を操作する部品（取り込み）。
import { ApiKeysPanel } from "@/components/ApiKeysPanel";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ id: string }>; // URLの[id]（作業スペースID）があとで届く、という型。
}) {
  const { id } = await params; // URL から作業スペースのIDを取り出す。
  const user = await getCurrentUser(); // 今ログインしている人。
  const ws = getWorkspace(id); // そのIDの作業スペース情報。
  // 存在しない・未ログイン・持ち主が違う場合は「見つかりません」を表示。
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id); // クレジット残高（画面上部の表示に使う）。
  // ★クライアントへ渡すのは公開用の項目だけ（keyHash=鍵のハッシュは絶対に渡さない）
  // ※ハッシュ = 元の鍵を復元できない形に変換した文字列。これが漏れると危険なので画面へは送らない。
  // .map(...) = 一覧を1件ずつ加工して、表示に必要な項目だけを詰め直した新しい一覧を作る。
  const keys = listApiKeys(ws.id).map((k) => ({
    id: k.id, // キーを見分ける番号。
    name: k.name, // 利用者が付けた分かりやすい名前。
    keyPreview: k.keyPreview, // 鍵の一部だけを見せる「先頭数文字…」のような表示用。
    createdAt: k.createdAt, // 作成日時。
    lastUsedAt: k.lastUsedAt, // 最後に使われた日時。
  }));

  return (
    // 共通の外枠。残高（無ければ0）を渡し、今開いているのはAPIキー画面だと伝える。
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/api-keys">
      {/* 縦にはみ出したら細いスクロールバーで見られるようにした本文エリア（周囲に余白） */}
      <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-8">
        {/* 中身を中央寄せし、横幅を読みやすい幅までに制限する */}
        <div className="mx-auto max-w-3xl">
          {/* ページの大見出し */}
          <h1 className="font-serif-display text-3xl text-ink">公開 API</h1>
          {/* このページで何ができるかの説明文。<code>部分は入力する項目名を等幅で強調 */}
          <p className="mt-2 text-sm text-ink-soft">
            プログラムから検索を実行できます（origami にない差別化機能）。
            APIキーを発行し、<code className="rounded bg-cream-100 px-1">Authorization: Bearer</code> ヘッダで利用します。
          </p>

          {/* APIキーの発行・一覧を扱う部品を差し込む（今あるキー一覧を initialKeys で渡す） */}
          <div className="mt-6">
            <ApiKeysPanel workspaceId={ws.id} initialKeys={keys} />
          </div>

          {/* 使い方：ターミナルにそのまま貼り付けて試せるサンプルコマンド */}
          {/* ※ターミナル = 文字で命令を打ち込んでパソコンを操作する黒い画面 */}
          <h2 className="mt-10 font-serif-display text-xl text-ink">使い方</h2>
          {/* <pre> = 書いたままの見た目（改行や空白）を保って表示する枠。下のサンプル文字はそのまま見せる */}
          <pre className="scroll-thin mt-3 overflow-x-auto rounded-2xl border border-line bg-ink p-4 text-xs leading-relaxed text-cream">
{`# 検索ジョブを作成
curl -X POST https://<your-domain>/v1/search \\
  -H "Authorization: Bearer gtm_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"東京の歯科医院で採用中","market":"JP","max_results":100}'
# ※ /v1/search は完了まで待つ同期実行。返る status は done / partial / failed。
#   market は "JP" または "GLOBAL"、max_results は 1〜250（既定100）。
# => { "job_id": "job_...", "status": "done" }

# 結果（リード一覧）を取得
curl https://<your-domain>/v1/jobs/job_... \\
  -H "Authorization: Bearer gtm_sk_..."`}
          </pre>
        </div>
      </div>
    </AppShell>
  );
}

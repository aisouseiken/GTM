import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet, listApiKeys } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id);
  const keys = listApiKeys(ws.id);

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="/api-keys">
      <div className="scroll-thin h-full overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif-display text-3xl text-ink">公開 API</h1>
          <p className="mt-2 text-sm text-ink-soft">
            プログラムから検索を実行できます（origami にない差別化機能）。
            APIキーを発行し、<code className="rounded bg-cream-100 px-1">Authorization: Bearer</code> ヘッダで利用します。
          </p>

          <div className="mt-6">
            <ApiKeysPanel workspaceId={ws.id} initialKeys={keys} />
          </div>

          <h2 className="mt-10 font-serif-display text-xl text-ink">使い方</h2>
          <pre className="scroll-thin mt-3 overflow-x-auto rounded-2xl border border-line bg-ink p-4 text-xs leading-relaxed text-cream">
{`# 検索ジョブを作成
curl -X POST https://<your-domain>/v1/search \\
  -H "Authorization: Bearer gtm_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"東京の歯科医院で採用中","market":"JP","max_results":24}'
# => { "job_id": "job_...", "status": "created" }

# 結果を取得
curl https://<your-domain>/v1/jobs/job_... \\
  -H "Authorization: Bearer gtm_sk_..."`}
          </pre>
        </div>
      </div>
    </AppShell>
  );
}

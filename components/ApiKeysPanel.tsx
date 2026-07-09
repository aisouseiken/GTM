"use client";

import { useState } from "react";
import type { ApiKey } from "@/lib/domain/types";

export function ApiKeysPanel({
  workspaceId,
  initialKeys,
}: {
  workspaceId: string;
  initialKeys: ApiKey[];
}) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const create = async () => {
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: name || "API Key" }),
    });
    const data = await res.json();
    setFreshKey(data.raw);
    setKeys((k) => [data.apiKey, ...k]);
    setName("");
  };

  return (
    <div>
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

      {freshKey && (
        <div className="mt-4 rounded-xl border border-brand/40 bg-brand-soft/40 p-4">
          <div className="text-sm font-medium text-ink">新しいAPIキー（この画面でのみ表示されます）</div>
          <code className="mt-2 block break-all rounded-lg bg-paper px-3 py-2 font-mono text-xs text-ink">
            {freshKey}
          </code>
          <button
            onClick={() => navigator.clipboard?.writeText(freshKey)}
            className="mt-2 text-xs font-medium text-brand hover:underline"
          >
            コピー
          </button>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-100/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">名前</th>
              <th className="px-4 py-2 font-medium">キー</th>
              <th className="px-4 py-2 font-medium">作成日</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  APIキーはまだありません
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-line/70">
                <td className="px-4 py-2 text-ink">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{k.keyPreview}</td>
                <td className="px-4 py-2 text-muted">
                  {new Date(k.createdAt).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

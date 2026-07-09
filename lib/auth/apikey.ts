import { createHash, randomBytes } from "crypto";
import { id, saveApiKey, findApiKeyByHash } from "@/lib/data/store";
import type { ApiKey, Workspace } from "@/lib/domain/types";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// 新規APIキー発行。生キーは発行時のみ返す（保存はハッシュのみ）。
export function issueApiKey(workspaceId: string, name: string): { apiKey: ApiKey; raw: string } {
  const raw = "gtm_sk_" + randomBytes(24).toString("hex");
  const apiKey: ApiKey = {
    id: id("key"),
    workspaceId,
    name: name || "API Key",
    keyPreview: raw.slice(0, 12) + "…",
    keyHash: hashKey(raw),
    createdAt: Date.now(),
  };
  saveApiKey(apiKey);
  return { apiKey, raw };
}

export function resolveApiKey(raw: string | null): ApiKey | undefined {
  if (!raw) return undefined;
  return findApiKeyByHash(hashKey(raw));
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export type { Workspace };

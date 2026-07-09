// モック認証：cookie にユーザーIDを保持するだけの簡易セッション。
// 外部キー不要で動く。最終フェーズで Supabase Auth に差し替え（設計書04）。

import { cookies } from "next/headers";
import { createUser, getUser, listWorkspaces, createWorkspace } from "@/lib/data/store";
import type { User } from "@/lib/domain/types";

const COOKIE = "gtm_uid";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const uid = store.get(COOKIE)?.value;
  if (!uid) return null;
  return getUser(uid) ?? null;
}

export async function signIn(email: string, name?: string): Promise<User> {
  const user = createUser(email, name || email.split("@")[0]);
  // 初回ログイン時にデフォルトワークスペースを用意
  if (listWorkspaces(user.id).length === 0) {
    createWorkspace(user.id, "マイワークスペース", "JP", "free");
  }
  const store = await cookies();
  store.set(COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return user;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

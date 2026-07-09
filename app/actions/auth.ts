"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/session";
import { listWorkspaces } from "@/lib/data/store";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!email) return;
  const user = await signIn(email, name);
  const ws = listWorkspaces(user.id);
  redirect(ws.length ? `/app/w/${ws[0].id}` : "/app");
}

export async function logoutAction() {
  await signOut();
  redirect("/");
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listWorkspaces, createWorkspace } from "@/lib/data/store";

export default async function AppIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let ws = listWorkspaces(user.id);
  if (ws.length === 0) {
    createWorkspace(user.id, "マイワークスペース", "JP", "free");
    ws = listWorkspaces(user.id);
  }
  redirect(`/app/w/${ws[0].id}`);
}

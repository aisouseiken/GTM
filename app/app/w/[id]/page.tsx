import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, getWallet } from "@/lib/data/store";
import { AppShell } from "@/components/AppShell";
import { Workspace } from "@/components/Workspace";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const ws = getWorkspace(id);
  if (!ws || !user || ws.ownerId !== user.id) notFound();
  const wallet = getWallet(ws.id);

  return (
    <AppShell workspace={ws} balance={wallet?.balance ?? 0} active="search">
      <Workspace workspaceId={ws.id} market={ws.market} initialBalance={wallet?.balance ?? 0} />
    </AppShell>
  );
}

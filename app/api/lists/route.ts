import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createList, getWorkspace } from "@/lib/data/store";

// リードリストを保存
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { workspaceId, name, leadIds } = (await req.json()) as {
    workspaceId: string;
    name: string;
    leadIds: string[];
  };
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const list = createList(workspaceId, name || "無題のリスト", leadIds || []);
  return NextResponse.json({ list });
}

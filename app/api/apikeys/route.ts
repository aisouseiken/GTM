import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspace, listApiKeys } from "@/lib/data/store";
import { issueApiKey } from "@/lib/auth/apikey";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const wid = new URL(req.url).searchParams.get("workspaceId");
  if (!wid) return NextResponse.json({ keys: [] });
  const ws = getWorkspace(wid);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ keys: listApiKeys(wid) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { workspaceId, name } = (await req.json()) as { workspaceId: string; name: string };
  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { apiKey, raw } = issueApiKey(workspaceId, name);
  return NextResponse.json({ apiKey, raw });
}

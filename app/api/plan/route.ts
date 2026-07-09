import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createPlan } from "@/lib/agent/planner";
import { getWorkspace, addMessage, createSession } from "@/lib/data/store";
import { MARKET_DEFAULT } from "@/lib/config";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { workspaceId, prompt } = body as { workspaceId: string; prompt: string; sessionId?: string };
  let sessionId = body.sessionId as string | undefined;

  const ws = getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  if (!prompt?.trim())
    return NextResponse.json({ error: "prompt required" }, { status: 400 });

  if (!sessionId) {
    const s = createSession(workspaceId, prompt.slice(0, 40));
    sessionId = s.id;
  }

  addMessage({ sessionId, role: "user", content: prompt, kind: "text" });
  const plan = createPlan(workspaceId, sessionId, prompt, ws.market ?? MARKET_DEFAULT);
  addMessage({
    sessionId,
    role: "assistant",
    content: "検索プランを作成しました。内容を確認して実行してください。",
    kind: "plan",
    data: { planId: plan.id },
  });

  return NextResponse.json({ sessionId, plan });
}

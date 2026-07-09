import { getCurrentUser } from "@/lib/auth/session";
import { getJob, getWorkspace } from "@/lib/data/store";
import { runSearchJob } from "@/lib/agent/runner";
import type { JobEvent } from "@/lib/domain/types";

// SSE でジョブの進捗を配信しながら実行する
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const job = getJob(id);
  if (!job) return new Response("not found", { status: 404 });
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: JobEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      };
      try {
        await runSearchJob(id, send);
      } catch (e) {
        send({ type: "failed", message: (e as Error).message, at: Date.now() });
      } finally {
        controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

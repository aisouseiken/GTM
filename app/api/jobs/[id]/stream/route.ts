// ============================================================================
// このAPI（GET /api/jobs/[id]/stream）は、指定したジョブ（検索の実行タスク）を実際に動かしながら、
// その進み具合（進捗）を、リアルタイムで少しずつ画面へ送り返す窓口です。
// 受け取るもの: URLの中に埋め込まれたジョブID（[id]の部分）。
// 返すもの: SSE による進捗の通知。
//   SSE（Server-Sent Events）= サーバーから画面へ、継続的に少しずつ情報を送り続ける仕組み。
//   「1回答えて終わり」ではなく、実況中継のように途中経過を何度も送れるのが特徴です。
// 画面側はこの通知を受け取り、検索の途中経過をその場でどんどん表示していきます。
// ============================================================================

// getCurrentUser = 今アクセスしている人が誰か（ログイン済みの本人）を取得する
import { getCurrentUser } from "@/lib/auth/session";
// ジョブ取得・ワークスペース取得の部品
import { getJob, getWorkspace } from "@/lib/data/store";
// runSearchJob = 実際に検索ジョブを動かす本体の処理
import { runSearchJob } from "@/lib/agent/runner";
// JobEvent = 進捗イベント1件のデータの形（型）
import type { JobEvent } from "@/lib/domain/types";

// 【進捗配信】SSEでジョブの進捗を送りながら、ジョブ本体を実行する。GET /api/jobs/[id]/stream
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // URLの[id]部分を後から受け取るための入れ物
) {
  // URLに含まれるジョブID（[id]の部分）を取り出す
  const { id } = await params;
  // ログイン確認：ログインしていなければ 401（＝認証（本人確認）が必要）を返して中止
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  // そのIDのジョブを探す。見つからなければ 404（＝対象が存在しない）を返す
  const job = getJob(id);
  if (!job) return new Response("not found", { status: 404 });
  // 所有者確認：ジョブが属するワークスペースの持ち主が本人かを確認し、違えば 403（＝禁止）を返す
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  // 文字列を、通信で送れるバイト列（数字の並び）へ変換する道具。SSEはテキストを送るので必要。
  const encoder = new TextEncoder();
  // データを少しずつ流し込める「ストリーム（流れ）」を用意する。ここに書き込んだ内容が順次画面へ届く。
  const stream = new ReadableStream({
    // start = ストリームが始まった瞬間に動く処理。controller は「流れに書き込む係」。
    async start(controller) {
      let closed = false; // この流れが既に閉じたかどうかの目印（閉じた後に書き込むとエラーになるため）
      // 進捗イベント1件を、SSEの決まった形（"data: 中身\n\n"）にして送信する関数。
      // ★相手（画面）が既に接続を切っている場合に書き込むとエラーになるので、
      //   closed の目印と try/catch（エラーを捕まえる仕組み）で守っている。
      const send = (ev: JobEvent) => {
        if (closed) return; // 既に閉じていれば何もしない
        try {
          // イベントを文字→バイト列に変換して流れに書き込む（JSON.stringify＝データを文字列化）
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          closed = true; // 書き込みに失敗＝相手が切れたとみなし、以後は送らない
        }
      };
      try {
        // ジョブ本体を実行する。進捗が出るたびに上の send が呼ばれて画面へ届く。
        // req.signal は「画面側が接続を切ったよ」という合図。これを渡すことで、途中で無駄な処理を止められる。
        await runSearchJob(id, send, req.signal);
      } catch (e) {
        // 途中でエラーが起きたら、「失敗した」という進捗イベントを送って知らせる
        send({ type: "failed", message: (e as Error).message, at: Date.now() });
      } finally {
        // 成功・失敗どちらでも最後に必ず実行される後片付け。
        // まだ閉じていなければ「終了(end)」の合図を送り、流れをきちんと閉じる（ここでのエラーは無視する）。
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`)); // 終了イベントを送信
            controller.close(); // 流れを閉じる
          } catch {
            /* すでに閉じている場合は無視 */
          }
        }
      }
    },
    // cancel = 画面側が接続を切ったときに呼ばれる処理。ここでは特別な後始末はしない。
    cancel() {
      /* runner は signal.aborted を見て自ら止まる */
    },
  });

  // 出来上がったストリームを、SSEとして扱ってもらうための設定を付けて返す
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream", // これはSSE（実況中継型の通信）だと相手に伝える
      "Cache-Control": "no-cache, no-transform", // 途中経過を保存（キャッシュ）したり変換したりさせない
      Connection: "keep-alive", // 接続をずっと維持し続ける（切らずに送り続けるため）
    },
  });
}

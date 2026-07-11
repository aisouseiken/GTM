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

// 指定ミリ秒だけ待つ小さな関数（再接続時のポーリング間隔に使う）
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true; // 書き込み失敗＝相手が切れたとみなす
        }
      };
      // 進捗イベント1件を SSE 形式（"data: 中身\n\n"）で送る。
      const send = (ev: JobEvent) => write(`data: ${JSON.stringify(ev)}\n\n`);
      // ★ハートビート：15秒ごとにコメント行(: ping)を送る。長い無送信でプロキシ(Render等)に
      //   接続を切られてスピナーが固まるのを防ぐ。
      const heartbeat = setInterval(() => write(`: ping\n\n`), 15_000);
      try {
        // ★再接続対応：ジョブが既に走り出している(queuedでない)場合は、二重実行せず
        //   これまでの進捗イベント履歴を再生する。こうしないと再接続した画面は completed を
        //   受け取れず、スピナーが永遠に回り続ける。
        const current = getJob(id);
        if (current && current.status !== "queued") {
          let sentCount = 0; // 何件目まで送ったか（差分だけ送るため）
          const flushEvents = () => {
            const j = getJob(id);
            if (!j) return;
            for (; sentCount < j.events.length; sentCount++) send(j.events[sentCount]); // 未送信分だけ送る
          };
          flushEvents(); // まず履歴を再生
          // まだ走行中(running/verifying)なら、終端になるまで少しずつ差分イベントを送り続ける。
          //   （履歴だけ送って end で閉じると、走行中に再接続した画面が完了を受け取れずスピナーが固まるため）
          const isTerminal = () => { const j = getJob(id); return !j || j.status === "done" || j.status === "partial" || j.status === "failed"; };
          while (!isTerminal() && !closed && !req.signal.aborted) {
            await sleep(400);
            flushEvents();
          }
          flushEvents(); // 終端到達後の最後の差分（completed/failed 等）も送る
          // 履歴の中に既に completed/failed が含まれていない場合だけ、最終状態を合成して送る（二重送出を防ぐ）。
          const j = getJob(id);
          const lastType = j?.events[j.events.length - 1]?.type;
          if (j && lastType !== "completed" && lastType !== "failed") {
            if (j.status === "done" || j.status === "partial") {
              send({ type: "completed", message: "完了", at: Date.now(), payload: { status: j.status, count: j.resultCount, credits: j.creditsSpent } });
            } else if (j.status === "failed") {
              send({ type: "failed", message: "失敗", at: Date.now() });
            }
          }
        } else {
          // 初回：ジョブ本体を実行する。進捗が出るたびに send が呼ばれて画面へ届く。
          // req.signal は「画面側が接続を切った」合図。途中で無駄な処理を止められる。
          await runSearchJob(id, send, req.signal);
        }
      } catch (e) {
        // 途中でエラーが起きたら、「失敗した」という進捗イベントを送って知らせる
        send({ type: "failed", message: (e as Error).message, at: Date.now() });
      } finally {
        clearInterval(heartbeat); // ハートビートを止める
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`event: end\ndata: {}\n\n`)); // 終了イベント
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

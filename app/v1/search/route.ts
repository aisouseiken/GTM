// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// APIキー（合言葉）関連の道具を読み込む（bearerFrom＝ヘッダーから合言葉を取り出す／resolveApiKey＝有効か照合する）
import { bearerFrom, resolveApiKey } from "@/lib/auth/apikey";
// データ保管庫の道具を読み込む（ワークスペース取得・ウォレット取得・APIキー保存・ジョブ取得・実行中ジョブ数の集計・監査ログ記録）
import { getWorkspace, getWallet, saveApiKey, getJob, tryReserveJob, releaseJob, addAudit } from "@/lib/data/store";
// 料金プランごとの情報（同時に動かせるジョブ数などの上限）を読み込む
import { PLAN_INFO } from "@/lib/domain/types";
// 指示文から「検索プラン（何をどう検索するかの計画）」を作る道具を読み込む
// createPlanSmart＝GeminiのAIがあればそれで解釈し、無ければ従来ロジックに自動で切り替わる版
import { createPlanSmart } from "@/lib/agent/planner";
// ジョブを作る道具(createJob)と、検索ジョブを実際に走らせる道具(runSearchJob)を読み込む
import { createJob, runSearchJob } from "@/lib/agent/runner";
// 「短時間に叩かれすぎていないか（乱用防止）」を判定する道具を読み込む
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（POST /v1/search）は、外部プログラム向けに公開された検索用の窓口です。
 * 認証はログインではなく「APIキー」で行います（HTTPヘッダーの Bearer トークン＝
 * "Bearer 鍵文字列" 形式で送る合言葉）。
 * 受け取るもの: 指示文(prompt)・（任意で）対象市場(market)・取得上限件数(max_results)。
 * 返すもの: 作成したジョブのID(job_id)と状態(status)。
 */
// ─────────────────────────────────────────────
// POST /v1/search：外部プログラムが検索ジョブを作って実行させるための処理
//   受け取る本文の例： { prompt（指示文）, market?（対象市場・任意）, max_results?（取得上限・任意） }
//   （差別化ポイント：競合の origami には、このような公開APIが無い）
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  // リクエストのヘッダーからBearerトークン（合言葉）を取り出し、有効なAPIキーか照合する
  const key = resolveApiKey(bearerFrom(req));
  // 有効なキーでなければ「401（合言葉が正しくない）」を返して中断する
  if (!key) return NextResponse.json({ error: "invalid api key" }, { status: 401 });

  // 同じAPIキーからの呼び出しは「1分（＝60000ミリ秒）あたり20回まで」に制限する
  // 上限を超えたら「429（回数オーバー）」を返す（叩きすぎ・サーバー負荷攻撃・費用の暴走を防ぐ）
  if (!rateLimit(`v1search:${key.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // このAPIキーに紐づくワークスペース（作業場所）を取り出す
  const ws = getWorkspace(key.workspaceId);
  // ワークスペースが見つからなければ「404（見つからない）」を返して中断する
  if (!ws) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  // このキーの「最後に使われた日時」を今の時刻(Date.now())に更新して保存する（誰がいつ使ったかの記録用）
  key.lastUsedAt = Date.now();
  saveApiKey(key);

  // リクエストの本文（送られてきたデータ）をJSONとして読み取る
  // ★中身が壊れていても落ちないよう、失敗時は空っぽ({})として扱う
  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string; // 指示文
    market?: "JP" | "GLOBAL"; // 対象市場（日本／全世界）
    max_results?: number; // 取得したい上限件数
  };
  // 指示文が空（未入力や空白だけ）なら「400（不正）」を返して中断する
  if (!body.prompt?.trim())
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  // 指示文が長すぎる（2000文字超）場合も「400」を返す（巨大入力による処理暴走を防ぐ）
  if (body.prompt.length > 2000)
    return NextResponse.json({ error: "prompt too long" }, { status: 400 });
  // ★対象市場は "JP"（日本）か "GLOBAL"（全世界）のどちらかだけを認める
  //   それ以外の見慣れない値が来たら、ワークスペースの設定(ws.market)を使う（送られてきた型の申告を鵜呑みにせず実際に中身を確認する）
  const market = body.market === "JP" || body.market === "GLOBAL" ? body.market : ws.market;

  // 今このワークスペースで動いているジョブ数が、料金プランで決められた「同時実行の上限」に達していないか確認する。
  // ★ここで「予約」まで同期的に行う（tryReserveJob）。プラン作成(await)の前に枠を確保することで、
  //   複数リクエストが同時にチェックをすり抜けて過剰実行・過剰課金するのを防ぐ。
  if (!tryReserveJob(ws.id, PLAN_INFO[ws.plan].concurrency)) {
    return NextResponse.json({ error: "too_many_running_jobs" }, { status: 429 });
  }

  // 予約したので、以降どの経路で抜けても必ず枠を解放するよう try/finally で包む。
  let released = false; // 予約枠を解放済みか（ジョブ作成後は実ジョブ数で数えるので予約は解放する）
  const release = () => { if (!released) { released = true; releaseJob(ws.id); } };
  try {
    // クレジット（利用ポイント）の財布(ウォレット)を取り出して残高を確認する
    // 財布が無い、または残高が0以下なら「402（支払い／残高が必要）」を返す
    const wallet = getWallet(ws.id);
    if (!wallet || wallet.balance <= 0)
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

    // 取得件数を 1〜250 の範囲におさめる（未指定なら100件）。小数は切り捨てて整数にする。
    const maxResults = Math.max(1, Math.min(Math.floor(Number(body.max_results)) || 100, 250));
    // 指示文をもとに検索プラン（何をどう検索するかの計画）を作る（"api" は、API経由の印）
    const plan = await createPlanSmart(ws.id, "api", body.prompt, market, maxResults);
    // 作った検索プランから、実際に走らせる「ジョブ」を作成する
    const job = createJob(plan);
    // ★ジョブが queued として登録され countActiveJobs に数えられるようになったので、予約枠は解放する。
    //   （解放しないと「予約1＋実行中ジョブ1」で二重に枠を消費し、実効の同時実行数が半減する）
    release();
    // 監査ログ（後から確認できる記録）に残す
    addAudit({ actor: `apikey:${key.id}`, action: "search.api", target: ws.id, meta: { jobId: job.id } });
    // API経由は完了まで待つ（同期実行）。通知は不要なので空関数を渡す。
    await runSearchJob(job.id, () => {});

    // ジョブのIDと最終状態を返す（取れなくても "queued" を仮に返す）
    const finished = getJob(job.id);
    return NextResponse.json({ job_id: job.id, status: finished?.status ?? "queued" });
  } finally {
    release(); // まだ解放していなければ（プラン作成前の離脱など）ここで解放
  }
}

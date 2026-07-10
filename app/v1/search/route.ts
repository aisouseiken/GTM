import { NextResponse } from "next/server";
import { bearerFrom, resolveApiKey } from "@/lib/auth/apikey";
import { getWorkspace, getWallet, saveApiKey, getJob, countActiveJobs, addAudit } from "@/lib/data/store";
import { PLAN_INFO } from "@/lib/domain/types";
import { createPlan } from "@/lib/agent/planner";
import { createJob, runSearchJob } from "@/lib/agent/runner";
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（POST /v1/search）は、外部プログラム向けに公開された検索用の窓口です。
 * 認証はログインではなく「APIキー」で行います（HTTPヘッダーの Bearer トークン＝
 * "Bearer 鍵文字列" 形式で送る合言葉）。
 * 受け取るもの: 指示文(prompt)・（任意で）対象市場(market)・取得上限件数(max_results)。
 * 返すもの: 作成したジョブのID(job_id)と状態(status)。
 */
// 公開REST API：検索ジョブを作成して実行（差別化ポイント：origamiには公開APIが無い）
// POST /v1/search  { prompt, market?, max_results? }
export async function POST(req: Request) {
  // 認証：ヘッダーのBearerトークンからAPIキーを解決。無効なら 401（認証が必要）
  const key = resolveApiKey(bearerFrom(req));
  if (!key) return NextResponse.json({ error: "invalid api key" }, { status: 401 });

  // レート制限：1つのAPIキーで1分あたり20回まで（叩きすぎ・DoS・コスト暴走を防ぐ）
  if (!rateLimit(`v1search:${key.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // APIキーに紐づくワークスペースを取得する
  const ws = getWorkspace(key.workspaceId);
  if (!ws) return NextResponse.json({ error: "workspace not found" }, { status: 404 });

  // このキーの「最終利用日時」を更新して保存する（利用状況の記録用）
  key.lastUsedAt = Date.now();
  saveApiKey(key);

  // リクエスト本文(JSON)を読み取る。壊れていても落ちないよう、失敗時は空オブジェクト扱いにする
  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    market?: "JP" | "GLOBAL";
    max_results?: number;
  };
  // 入力チェック：指示文が空なら 400、長すぎ（2000文字超）も 400
  if (!body.prompt?.trim())
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (body.prompt.length > 2000)
    return NextResponse.json({ error: "prompt too long" }, { status: 400 });
  // ★market は "JP" / "GLOBAL" のみ許可（未知値は既定へ）。型アサーション頼みをやめ実行時検証する
  const market = body.market === "JP" || body.market === "GLOBAL" ? body.market : ws.market;

  // 同時実行の上限：プランごとの concurrency を超えていたら 429
  if (countActiveJobs(ws.id) >= PLAN_INFO[ws.plan].concurrency) {
    return NextResponse.json({ error: "too_many_running_jobs" }, { status: 429 });
  }

  // クレジット残高チェック：ウォレットが無い or 残高0以下なら 402（すり抜け防止で「!wallet ||」）
  const wallet = getWallet(ws.id);
  if (!wallet || wallet.balance <= 0)
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });

  // 取得件数は 1〜40 の範囲に整える（負数・0・巨大値・数値でない値を弾く＝件数計算の破綻防止）
  const maxResults = Math.max(1, Math.min(Number(body.max_results) || 24, 40));
  // 指示文から検索プランを作成する
  const plan = createPlan(ws.id, "api", body.prompt, market, maxResults);
  // プランからジョブを作成する
  const job = createJob(plan);
  // 監査ログ：どのAPIキーで検索が実行されたかを記録
  addAudit({ actor: `apikey:${key.id}`, action: "search.api", target: ws.id, meta: { jobId: job.id } });
  // API 経由は同期実行（完了まで待つ）
  // ※画面向けのSSEと違い、進捗通知は使わないので送信関数は空にしている
  await runSearchJob(job.id, () => {});

  // 作成したジョブのIDと「実際の状態」を返す（done/partial/failed を正しく伝える）
  const finished = getJob(job.id);
  return NextResponse.json({ job_id: job.id, status: finished?.status ?? "queued" });
}

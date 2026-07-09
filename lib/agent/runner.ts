// ジョブ実行エンジン：検索プラン → コネクタ並列 → 名寄せ → 検証 → 保存
// 各ステージで JobEvent を発火（SSE で配信）。MOCK_MODE で決定的に動作。
//
// このファイルの役割：作られた検索プランを実際に「実行」する司令塔です。
// 情報源からリード候補を集め → 重複をまとめ → 連絡先を検証し → 保存する、という一連の流れを進めます。
// 名寄せ＝同じ会社が複数見つかったときに1件にまとめること。
// SSE（Server-Sent Events）＝サーバーから画面へ、進捗をリアルタイムに少しずつ送り届ける仕組み。
// JobEvent を「発火」＝進捗の出来事を1つ作って画面側に通知すること。

import type { Job, JobEvent, Lead, SearchPlan } from "@/lib/domain/types";
import {
  getSearchPlan,
  getWallet,
  id,
  saveJob,
  saveLead,
  spendCredits,
} from "@/lib/data/store";
import { getConnectors } from "@/lib/connectors/registry";
import type { LeadCandidate } from "@/lib/connectors/types";
import { resolveCandidates } from "@/lib/agent/resolve";
import { signatureOf, getFreshCandidates, setCandidates, cacheAgeMinutes } from "@/lib/agent/freshness";
import { verifyLead } from "@/lib/agent/verify";

// 指定したミリ秒だけ待つ小さな関数（処理の間に「間（ま）」を作り、進捗を見せるために使う）。
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 検索プランから新しいジョブ（実行記録）を作って保存し、返す。
export function createJob(plan: SearchPlan): Job {
  const job: Job = {
    id: id("job"),
    workspaceId: plan.workspaceId,
    searchPlanId: plan.id,
    status: "queued", // 最初は実行待ち
    resultCount: 0,
    creditsSpent: 0,
    costInternal: 0,
    events: [],
    startedAt: Date.now(),
  };
  saveJob(job);
  return job;
}

// 進捗イベントを1件作り、ジョブに記録し、画面側（onEvent）にも通知するための共通関数。
// Omit<JobEvent, "at"> ＝ JobEvent から時刻(at)を除いた形。時刻はここで自動で付ける。
function emit(job: Job, ev: Omit<JobEvent, "at">, onEvent: (e: JobEvent) => void) {
  const full: JobEvent = { ...ev, at: Date.now() }; // 現在時刻を付けて完成させる
  job.events.push(full); // ジョブの履歴に追加
  saveJob(job); // 保存
  onEvent(full); // 画面側へ通知（SSEで配信される）
}

// メイン実行。onEvent は SSE へ流す。
// jobId のジョブを実際に走らせ、各段階の進捗を onEvent 経由で通知していく。
export async function runSearchJob(
  jobId: string,
  onEvent: (e: JobEvent) => void
): Promise<void> {
  const { getJob } = await import("@/lib/data/store"); // 必要になった時点で読み込む（動的インポート）
  const job = getJob(jobId);
  if (!job) return; // ジョブが見つからなければ何もしない
  // ★二重課金防止：まだ実行前(queued)のジョブだけを走らせる。
  //   SSEはGETなので再読込・再接続で何度も叩かれうる。すでに実行中/完了/失敗なら即終了する。
  if (job.status !== "queued") return;
  job.status = "running"; // すぐに実行中へ移し、後続の再入を弾く
  saveJob(job);
  const plan = getSearchPlan(job.searchPlanId);
  if (!plan) { // もとになる検索プランが無ければ失敗として終了
    job.status = "failed";
    saveJob(job);
    emit(job, { type: "failed", message: "検索プランが見つかりません" }, onEvent);
    return;
  }

  try {
    job.status = "running"; // 実行中にする
    saveJob(job);
    emit(job, { type: "queued", message: "ジョブを開始しました" }, onEvent);

    // 1) リスト抽出：コネクタ層から候補を集める（最新化キャッシュを活用）
    const target = Math.min(plan.estimatedLeads, 40); // 目標件数（多くても40件まで）
    const market = plan.icp.market;
    const sig = signatureOf(job.workspaceId, plan.icp, target); // 検索条件の署名（利用者ごとに分離）

    let candidates: LeadCandidate[]; // 各コネクタが見つけた候補（重複を含む）
    const cached = getFreshCandidates(sig); // 新鮮なキャッシュがあるか？

    if (cached) {
      // 最新化：同条件かつ新鮮なので、取り直さずキャッシュを再利用（速い・原価節約）
      candidates = cached;
      const age = cacheAgeMinutes(sig);
      await sleep(180);
      emit(
        job,
        {
          type: "source_done",
          message: `最新化：新鮮なキャッシュを再利用（${age ?? 0}分前に取得・${candidates.length}件の候補）`,
          payload: { cached: true, count: candidates.length },
        },
        onEvent
      );
    } else {
      // キャッシュが無い/古い → 各コネクタで実際に抽出し、候補を積み上げる
      candidates = [];
      const connectors = getConnectors(market);
      for (const c of connectors) {
        await sleep(260); // 検索している雰囲気を出すため少し待つ
        const found = await c.search({ icp: plan.icp, count: target, planId: plan.id });
        candidates.push(...found);
        emit(
          job,
          {
            type: "source_done",
            message: `${c.label} を検索 … ${found.length}件（累計候補 ${candidates.length}件）`,
            payload: { connectorId: c.id, count: found.length },
          },
          onEvent
        );
      }
      setCandidates(sig, candidates); // 次回の最新化のためキャッシュに保存
    }

    // 2) リスト元の最適化：名寄せ・重複排除・出典マージで1社に統合する
    await sleep(220);
    const merged = resolveCandidates(candidates, job.workspaceId, job.id).slice(0, target);
    emit(
      job,
      {
        type: "dedupe",
        message: `名寄せ・重複排除 … 候補${candidates.length}件 → ${merged.length}社に統合`,
        payload: { rawCount: candidates.length, count: merged.length },
      },
      onEvent
    );

    // 3) 検証・エンリッチ（1件ずつ、信頼度スコア付与、成功分のみ課金）
    // エンリッチ＝集めた情報に不足分を補って充実させること
    job.status = "verifying"; // 検証中に切り替え
    saveJob(job);
    emit(job, { type: "verifying", message: "連絡先を検証中 …" }, onEvent);

    const wallet = getWallet(job.workspaceId); // クレジット残高の財布を取得
    let creditsSpent = 0; // このジョブで消費した合計クレジット
    const saved: Lead[] = []; // 保存できたリード

    for (const lead of merged) { // リードを1件ずつ検証・保存
      // クレジット不足なら部分完了で打ち切り。
      // ★以前は「wallet.balance - creditsSpent」と二重に引いて判定していたバグを修正。
      //   spendCredits が残高を直接減らすので wallet.balance は常に最新。ここは現在残高だけを見る。
      if (wallet && wallet.balance <= 0) {
        job.status = "partial"; // 残高が尽きたら途中まで（部分完了）で終了
        break;
      }
      const { lead: verified, creditsUsed } = verifyLead(lead); // 検証して信頼度を確定
      // 検証成功分を課金（発見1 + 検証分）
      const cost = 1 + creditsUsed; // 発見コスト1 ＋ 検証で成功した分
      const ok = spendCredits( // クレジットを実際に消費（残高から引く）
        job.workspaceId,
        cost,
        "verify",
        `${verified.companyName} を取得・検証`,
        job.id
      );
      if (!ok) { // 消費に失敗（残高不足など）なら部分完了で終了
        job.status = "partial";
        break;
      }
      creditsSpent += cost; // 消費合計を加算
      saveLead(verified); // リードを保存
      saved.push(verified);
      job.resultCount = saved.length; // 取得件数を更新
      job.creditsSpent = creditsSpent; // 消費クレジットを更新
      job.costInternal = Number((creditsSpent * 0.6).toFixed(2)); // 原価モデル（消費の6割を原価とみなす）
      saveJob(job);
      emit(
        job,
        {
          type: "lead",
          message: verified.companyName,
          payload: { leadId: verified.id },
        },
        onEvent
      );
      await sleep(90); // 1件ずつ表示される演出のため少し待つ
    }

    // 途中打ち切り（partial）でなければ、正常に完了（done）とする
    if (job.status !== "partial") job.status = "done";
    job.finishedAt = Date.now(); // 終了時刻を記録
    saveJob(job);
    emit(
      job,
      {
        type: "completed",
        message: `完了：${saved.length}件のリードを取得（消費 ${creditsSpent} クレジット）`,
        payload: { count: saved.length, credits: creditsSpent, status: job.status },
      },
      onEvent
    );
  } catch (e) {
    // 途中で予期せぬエラーが起きた場合は、失敗として記録し通知する
    job.status = "failed";
    job.finishedAt = Date.now();
    saveJob(job);
    emit(
      job,
      { type: "failed", message: `エラー: ${(e as Error).message}` },
      onEvent
    );
  }
}

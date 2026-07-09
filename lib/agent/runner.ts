// ジョブ実行エンジン：検索プラン → コネクタ並列 → 名寄せ → 検証 → 保存
// 各ステージで JobEvent を発火（SSE で配信）。MOCK_MODE で決定的に動作。

import type { Job, JobEvent, Lead, SearchPlan } from "@/lib/domain/types";
import {
  getSearchPlan,
  getWallet,
  id,
  saveJob,
  saveLead,
  spendCredits,
} from "@/lib/data/store";
import { generateLeads } from "@/lib/mock/leadgen";
import { verifyLead } from "@/lib/agent/verify";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createJob(plan: SearchPlan): Job {
  const job: Job = {
    id: id("job"),
    workspaceId: plan.workspaceId,
    searchPlanId: plan.id,
    status: "queued",
    resultCount: 0,
    creditsSpent: 0,
    costInternal: 0,
    events: [],
    startedAt: Date.now(),
  };
  saveJob(job);
  return job;
}

function emit(job: Job, ev: Omit<JobEvent, "at">, onEvent: (e: JobEvent) => void) {
  const full: JobEvent = { ...ev, at: Date.now() };
  job.events.push(full);
  saveJob(job);
  onEvent(full);
}

// メイン実行。onEvent は SSE へ流す。
export async function runSearchJob(
  jobId: string,
  onEvent: (e: JobEvent) => void
): Promise<void> {
  const { getJob } = await import("@/lib/data/store");
  const job = getJob(jobId);
  if (!job) return;
  const plan = getSearchPlan(job.searchPlanId);
  if (!plan) {
    job.status = "failed";
    saveJob(job);
    emit(job, { type: "failed", message: "検索プランが見つかりません" }, onEvent);
    return;
  }

  try {
    job.status = "running";
    saveJob(job);
    emit(job, { type: "queued", message: "ジョブを開始しました" }, onEvent);

    // 1) コネクタ並列検索（モック：件数を按分して生成）
    const target = Math.min(plan.estimatedLeads, 40);
    const raw = generateLeads(plan.icp, job.workspaceId, job.id, target, plan.id);

    let discovered = 0;
    for (const c of plan.connectors) {
      await sleep(280);
      const share = Math.round(target / plan.connectors.length);
      discovered = Math.min(target, discovered + share);
      emit(
        job,
        {
          type: "source_done",
          message: `${c.label} を検索 … ${discovered}件の候補`,
          payload: { connectorId: c.connectorId, count: discovered },
        },
        onEvent
      );
    }

    // 2) 名寄せ・重複排除（モック：ドメインでユニーク）
    await sleep(220);
    const seen = new Set<string>();
    const deduped = raw.filter((l) => {
      if (seen.has(l.domain)) return false;
      seen.add(l.domain);
      return true;
    });
    emit(
      job,
      {
        type: "dedupe",
        message: `名寄せ・重複排除 … ${deduped.length}社に統合`,
        payload: { count: deduped.length },
      },
      onEvent
    );

    // 3) 検証・エンリッチ（1件ずつ、信頼度スコア付与、成功分のみ課金）
    job.status = "verifying";
    saveJob(job);
    emit(job, { type: "verifying", message: "連絡先を検証中 …" }, onEvent);

    const wallet = getWallet(job.workspaceId);
    let creditsSpent = 0;
    const saved: Lead[] = [];

    for (const lead of deduped) {
      // クレジット不足なら部分完了で打ち切り
      if (wallet && wallet.balance - creditsSpent <= 0) {
        job.status = "partial";
        break;
      }
      const { lead: verified, creditsUsed } = verifyLead(lead);
      // 検証成功分を課金（発見1 + 検証分）
      const cost = 1 + creditsUsed;
      const ok = spendCredits(
        job.workspaceId,
        cost,
        "verify",
        `${verified.companyName} を取得・検証`,
        job.id
      );
      if (!ok) {
        job.status = "partial";
        break;
      }
      creditsSpent += cost;
      saveLead(verified);
      saved.push(verified);
      job.resultCount = saved.length;
      job.creditsSpent = creditsSpent;
      job.costInternal = Number((creditsSpent * 0.6).toFixed(2)); // 原価モデル
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
      await sleep(90);
    }

    if (job.status !== "partial") job.status = "done";
    job.finishedAt = Date.now();
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

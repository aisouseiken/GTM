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
  isSuppressed,
  isDomainSuppressed,
} from "@/lib/data/store";
import { getConnectors } from "@/lib/connectors/registry";
import type { LeadCandidate } from "@/lib/connectors/types";
import { resolveCandidates } from "@/lib/agent/resolve";
import { signatureOf, getFreshCandidates, setCandidates, cacheAgeMinutes } from "@/lib/agent/freshness";
import { verifyLead } from "@/lib/agent/verify";
import { crawlContact, crawlEnabled } from "@/lib/agent/crawl";

// 指定したミリ秒だけ待つ小さな関数（処理の間に「間（ま）」を作り、進捗を見せるために使う）。
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 検索プランから新しいジョブ（実行記録）を作って保存し、返す。
export function createJob(plan: SearchPlan): Job {
  const job: Job = {
    id: id("job"), // ジョブを識別する新しいID
    workspaceId: plan.workspaceId, // 所有する利用者（ワークスペース）
    searchPlanId: plan.id, // 元になった検索プランのID
    status: "queued", // 最初は実行待ち（queued）
    resultCount: 0, // 取得できた件数（最初は0）
    creditsSpent: 0, // 消費クレジット（最初は0）
    costInternal: 0, // 内部原価（最初は0）
    events: [], // 進捗イベントの履歴（最初は空）
    startedAt: Date.now(), // 開始時刻（今）
  };
  saveJob(job); // 作ったジョブを保存
  return job; // 呼び出し元に返す
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
  onEvent: (e: JobEvent) => void,
  signal?: AbortSignal // クライアントが接続を切ったら中断するための合図
): Promise<void> {
  const { getJob } = await import("@/lib/data/store"); // 必要になった時点で読み込む（動的インポート）
  const job = getJob(jobId); // IDから対象のジョブを取り出す
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

    // 1) リスト抽出：コネクタ層（データ取得先）から候補を集める（最新化キャッシュを活用）
    const target = Math.min(plan.estimatedLeads, 250); // 目標件数（多くても250件までに制限。以前は40件と少なすぎた）
    const market = plan.icp.market; // 対象市場（日本 or グローバル）
    const sig = signatureOf(job.workspaceId, plan.icp, target); // 検索条件の署名（利用者ごとに分離）

    let candidates: LeadCandidate[]; // 各コネクタが見つけた候補（重複を含む）
    const cached = getFreshCandidates(sig); // 新鮮なキャッシュ（前回の結果の一時保存）があるか？

    if (cached) {
      // 最新化：同条件かつ新鮮なので、取り直さずキャッシュを再利用（速い・原価節約）
      candidates = cached; // キャッシュの候補をそのまま使う
      const age = cacheAgeMinutes(sig); // 何分前に取得したものかを画面表示用に取得
      await sleep(180); // 進捗が見えるように少しだけ待つ
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
      candidates = []; // 候補をためる空の箱から開始
      const connectors = getConnectors(market); // 市場に対応するコネクタ一覧を取得
      for (const c of connectors) { // コネクタを1つずつ順番に実行
        await sleep(260); // 検索している雰囲気を出すため少し待つ
        const found = await c.search({ icp: plan.icp, count: target, planId: plan.id }); // このコネクタで検索（あとで結果が返る＝非同期）
        candidates.push(...found); // 見つかった候補を全体の箱に足し込む
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
      setCandidates(sig, candidates); // 次回同じ条件で来たときに再利用できるようキャッシュに保存
    }

    // 2) リスト元の最適化：名寄せ・重複排除・出典マージで1社に統合する
    //    ★オプトアウト抑制：除外申請のあったメール/ドメインはリードから取り除く（法令・プライバシー対応）
    await sleep(220); // 進捗が見えるように少し待つ
    const merged = resolveCandidates(candidates, job.workspaceId, job.id) // 名寄せ（同じ会社をまとめる）
      // 除外申請のあったメール、またはドメインのリードを取り除く（メール未取得でもドメインで弾く）
      .filter((l) => !isSuppressed(l.email) && !isDomainSuppressed(l.domain))
      .slice(0, target); // 目標件数までに絞り込む
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

    const wallet = getWallet(job.workspaceId); // クレジット残高の財布（利用者の残高情報）を取得
    let creditsSpent = 0; // このジョブで消費した合計クレジット（0から数え始める）
    const saved: Lead[] = []; // 保存できたリードをためる箱
    const useCrawl = crawlEnabled(); // 自社サイト巡回でメール補完するか（環境変数で有効化）
    let crawled = 0; // クロールした件数（負荷を抑えるため上限を設ける）

    for (const lead of merged) { // まとめたリードを1件ずつ検証・保存していく
      // ★クライアントが接続を切ったら中断（これ以上クレジットを消費しない）
      if (signal?.aborted) {
        job.status = "partial";
        break;
      }
      // クレジット不足なら部分完了で打ち切り。
      // ★以前は「wallet.balance - creditsSpent」と二重に引いて判定していたバグを修正。
      //   spendCredits が残高を直接減らすので wallet.balance は常に最新。ここは現在残高だけを見る。
      if (wallet && wallet.balance <= 0) {
        job.status = "partial"; // 残高が尽きたら途中まで（部分完了）で終了
        break;
      }
      // ★クロール（任意・PoC）：CRAWL_ENABLED のとき、実在ドメインのリードは自社サイトを
      //   1ページ巡回して公開メール/電話を補完する。偽ドメインは crawlContact 側で即スキップ。
      //   サイト負荷とジョブ遅延を抑えるため、1ジョブあたり最大25件までに制限する。
      if (useCrawl && crawled < 25) {
        crawled++;
        const found = await crawlContact(lead.domain);
        if (found?.email) lead.email = found.email; // 見つかった公開メールで上書き
        if (found?.phone) lead.phone = found.phone; // 見つかった公開電話で上書き
        // ★クロールで新たに得たメールが抑制対象なら、このリードは飛ばす（課金・保存の前に）。
        //   抑制フィルタは名寄せ直後に1回かけたが、上書きで抑制済みメールが混入し得るため再チェック。
        if (isSuppressed(lead.email)) continue;
      }
      const { lead: verified, creditsUsed } = verifyLead(lead); // 検証して信頼度を確定（成功した検証の数も受け取る）
      // 検証成功分を課金（発見1 + 検証分）
      const cost = 1 + creditsUsed; // 発見コスト1 ＋ 検証で成功した分の合計が、このリードの請求額
      const ok = spendCredits( // クレジットを実際に消費（残高から引く）
        job.workspaceId, // どの利用者の残高から引くか
        cost, // 引く金額
        "verify", // 用途の種別（検証）
        `${verified.companyName} を取得・検証`, // 明細に残す説明文
        job.id // どのジョブによる消費か
      );
      if (!ok) { // 消費に失敗（残高不足など）なら部分完了で終了
        job.status = "partial"; // 途中まで（部分完了）に設定
        break; // ループを抜ける
      }
      creditsSpent += cost; // 消費合計に今回分を加算
      saveLead(verified); // 検証済みリードを保存
      saved.push(verified); // 保存できた一覧にも追加
      job.resultCount = saved.length; // 取得件数を更新
      job.creditsSpent = creditsSpent; // 消費クレジットを更新
      job.costInternal = Number((creditsSpent * 0.6).toFixed(2)); // 原価モデル（消費の6割を原価とみなす。小数2桁に整える）
      saveJob(job); // ここまでの進捗を保存
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
    if (job.status !== "partial") job.status = "done"; // 部分完了でなければ「完了」に
    job.finishedAt = Date.now(); // 終了時刻を記録
    saveJob(job); // 最終状態を保存
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

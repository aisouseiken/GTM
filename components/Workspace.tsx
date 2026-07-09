"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lead, Market, SearchPlan } from "@/lib/domain/types";
import { FitBar, CompanyAvatar } from "./FitBar";
import { LeadDrawer } from "./LeadDrawer";

type Phase = "idle" | "planning" | "plan_ready" | "running" | "done";

interface ProgressLine {
  id: number;
  text: string;
  kind: "info" | "ok";
}

const SUGGESTIONS = [
  "東京の歯科医院で、スタッフを採用中の医院を探して",
  "フロリダで技術者を採用中、かつGoogle広告を出しているHVAC企業",
  "資金調達したばかりの国内SaaSスタートアップ",
  "大阪の飲食店で新規オープンした店舗",
];

export function Workspace({
  workspaceId,
  market,
  initialBalance,
}: {
  workspaceId: string;
  market: Market;
  initialBalance: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [plan, setPlan] = useState<SearchPlan | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [progress, setProgress] = useState<ProgressLine[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [balance, setBalance] = useState(initialBalance);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [saved, setSaved] = useState(false);
  const progressCounter = useRef(0);
  const router = useRouter();

  const pushProgress = (text: string, kind: "info" | "ok" = "info") => {
    progressCounter.current += 1;
    setProgress((p) => [...p, { id: progressCounter.current, text, kind }]);
  };

  const submitPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      setUserPrompt(prompt);
      setInput("");
      setPhase("planning");
      setPlan(null);
      setLeads([]);
      setProgress([]);
      setSaved(false);
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, prompt, sessionId }),
      });
      if (!res.ok) {
        pushProgress("プランの作成に失敗しました");
        setPhase("idle");
        return;
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setPlan(data.plan);
      setPhase("plan_ready");
    },
    [workspaceId, sessionId]
  );

  const runPlan = useCallback(async () => {
    if (!plan) return;
    setPhase("running");
    setLeads([]);
    setProgress([]);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      pushProgress(e.error === "insufficient_credits" ? "クレジットが不足しています" : "実行に失敗しました");
      setPhase("plan_ready");
      return;
    }
    const { jobId: jid } = await res.json();
    setJobId(jid);

    const ev = new EventSource(`/api/jobs/${jid}/stream`);
    ev.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "lead") {
        // リード1件を取得して追加（逐次表示）
        const r = await fetch(`/api/leads?jobId=${jid}`);
        const { leads: fresh, job } = await r.json();
        setLeads(fresh);
        if (job) setBalance(initialBalanceAfter(initialBalance, job.creditsSpent));
      } else if (data.type === "completed") {
        pushProgress(data.message, "ok");
        const r = await fetch(`/api/leads?jobId=${jid}`);
        const { leads: fresh, job } = await r.json();
        setLeads(fresh);
        if (job) setBalance(initialBalanceAfter(initialBalance, job.creditsSpent));
        setPhase("done");
        router.refresh(); // サーバー描画のヘッダー残高も同期
      } else {
        pushProgress(data.message, "info");
      }
    };
    ev.addEventListener("end", () => ev.close());
    ev.onerror = () => ev.close();
  }, [plan, initialBalance, router]);

  const activeLeads = leads.filter((l) => l.status !== "excluded");

  const toggleStatus = async (lead: Lead, status: Lead["status"]) => {
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, status }),
    });
  };

  const saveList = async () => {
    const name = `${plan?.icp.industry ?? "リード"} · ${new Date().toLocaleDateString("ja-JP")}`;
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, leadIds: activeLeads.map((l) => l.id) }),
    });
    setSaved(true);
  };

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[360px_1fr]">
      {/* Chat pane */}
      <div className="flex min-h-0 flex-col border-r border-line bg-cream-100/30">
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
          {phase === "idle" && (
            <div className="pt-6">
              <h2 className="font-serif-display text-2xl text-ink">何をお探しですか？</h2>
              <p className="mt-2 text-sm text-ink-soft">
                理想の顧客像を自然な言葉で入力してください。GTM の AI が検索プランを作ります。
              </p>
              <div className="mt-5 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submitPrompt(s)}
                    className="block w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-left text-sm text-ink-soft transition-colors hover:border-brand/50 hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {userPrompt && (
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-paper px-3.5 py-2.5 text-sm text-ink shadow-sm">
              {userPrompt}
            </div>
          )}

          {phase === "planning" && (
            <div className="text-sm text-muted animate-pulse-soft">検索プランを作成中…</div>
          )}

          {plan && (phase === "plan_ready" || phase === "running" || phase === "done") && (
            <PlanCard plan={plan} onRun={runPlan} running={phase !== "plan_ready"} />
          )}

          {progress.length > 0 && (
            <div className="space-y-1.5 rounded-2xl bg-brand-soft/40 p-3 text-sm">
              {progress.map((p, i) => (
                <div key={`${p.id}-${i}`} className="flex items-start gap-2 text-ink-soft">
                  <span>{p.kind === "ok" ? "✅" : "🔍"}</span>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* input */}
        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitPrompt(input);
                }
              }}
              rows={1}
              placeholder={phase === "idle" ? "理想の顧客像を入力…" : "フォローアップを入力…"}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
            />
            <button
              onClick={() => submitPrompt(input)}
              disabled={!input.trim()}
              className="shrink-0 rounded-xl bg-ink px-3 py-2 text-white disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M4 12l16-8-8 16-1.5-6.5L4 12Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Results pane */}
      <div className="flex min-h-0 flex-col bg-cream">
        <ResultsHeader
          plan={plan}
          count={activeLeads.length}
          jobId={jobId}
          onSave={saveList}
          saved={saved}
          canExport={activeLeads.length > 0}
        />
        <div className="scroll-thin min-h-0 flex-1 overflow-auto p-4">
          {activeLeads.length === 0 ? (
            <EmptyState phase={phase} />
          ) : (
            <ResultsTable
              leads={activeLeads}
              onSelect={setSelected}
              onToggle={toggleStatus}
            />
          )}
        </div>
      </div>

      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} onToggle={toggleStatus} />
      )}
    </div>
  );
}

function initialBalanceAfter(before: number, spent: number) {
  return Math.max(0, before - spent);
}

function PlanCard({
  plan,
  onRun,
  running,
}: {
  plan: SearchPlan;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 shadow-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-brand">検索プラン</div>
      <dl className="space-y-1.5 text-sm">
        <Row label="業種" value={plan.icp.industry} />
        <Row label="地域" value={plan.icp.location} />
        <Row label="市場" value={plan.icp.market} />
        {plan.icp.signals.length > 0 && <Row label="シグナル" value={plan.icp.signals.join(" / ")} />}
        <Row label="検索ソース" value={plan.connectors.map((c) => c.label).join(", ")} />
        <Row label="想定件数" value={`〜${plan.estimatedLeads}件`} />
        <Row label="見積り" value={`約 ${plan.estimatedCredits} クレジット`} />
      </dl>
      <button
        onClick={onRun}
        disabled={running}
        className="mt-3 w-full rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {running ? "実行中…" : "この内容で実行する"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function ResultsHeader({
  plan,
  count,
  jobId,
  onSave,
  saved,
  canExport,
}: {
  plan: SearchPlan | null;
  count: number;
  jobId: string | null;
  onSave: () => void;
  saved: boolean;
  canExport: boolean;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
      <div>
        <div className="font-serif-display text-base text-ink">
          {plan ? `${plan.icp.location} · ${plan.icp.industry}` : "リード"}
        </div>
        <div className="text-xs text-muted">{count} 件</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!canExport}
          className="rounded-full border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        >
          {saved ? "保存済み ✓" : "リストに保存"}
        </button>
        <a
          href={jobId ? `/api/export?jobId=${jobId}` : "#"}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            canExport ? "bg-ink text-white" : "pointer-events-none bg-line text-muted"
          }`}
        >
          CSV
        </a>
      </div>
    </div>
  );
}

function EmptyState({ phase }: { phase: Phase }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        {phase === "running" ? (
          <>
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
            <p className="text-sm text-ink-soft">ウェブを探索し、連絡先を検証しています…</p>
          </>
        ) : (
          <>
            <div className="font-serif-display text-lg text-ink">まだリードはありません</div>
            <p className="mt-2 text-sm text-muted">
              左のチャットで理想の顧客像を入力し、検索プランを実行してください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ConfBadge({ score }: { score: number }) {
  const tier = score >= 80 ? "high" : score >= 50 ? "mid" : "low";
  const cls =
    tier === "high"
      ? "bg-[#e3f5df] text-[#3f7a43]"
      : tier === "mid"
        ? "bg-[#fdf3d6] text-[#8a6d1f]"
        : "bg-[#fbe3e3] text-[#9a3b3b]";
  const dot = tier === "high" ? "🟢" : tier === "mid" ? "🟡" : "🔴";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${cls}`}>
      {dot} {score}
    </span>
  );
}

function ResultsTable({
  leads,
  onSelect,
  onToggle,
}: {
  leads: Lead[];
  onSelect: (l: Lead) => void;
  onToggle: (l: Lead, s: Lead["status"]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-cream-100/70 text-[11px] uppercase tracking-wide text-muted backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Fit</th>
            <th className="px-3 py-2 font-medium">会社</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">業種</th>
            <th className="hidden px-3 py-2 font-medium xl:table-cell">従業員</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">メール</th>
            <th className="px-3 py-2 font-medium">信頼度</th>
            <th className="px-3 py-2 font-medium">シグナル</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr
              key={l.id}
              onClick={() => onSelect(l)}
              className="animate-row-in cursor-pointer border-t border-line/70 hover:bg-cream-100/40"
            >
              <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
              <td className="px-3 py-2">
                <FitBar score={l.fitScore} />
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <CompanyAvatar name={l.companyName} />
                  <span className="text-ink">{l.companyName}</span>
                </span>
              </td>
              <td className="hidden px-3 py-2 text-ink-soft lg:table-cell">{l.category}</td>
              <td className="hidden px-3 py-2 text-ink-soft xl:table-cell">{l.headcount}</td>
              <td className="hidden px-3 py-2 text-ink-soft lg:table-cell">
                {l.email ? (
                  <span className="font-mono text-[12px]">{l.email}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <ConfBadge score={l.confidence} />
              </td>
              <td className="px-3 py-2 text-ink-soft">{l.buyingSignal}</td>
              <td className="px-3 py-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(l, l.status === "favorite" ? "new" : "favorite");
                  }}
                  className={l.status === "favorite" ? "text-brand" : "text-line-strong hover:text-muted"}
                  title="お気に入り"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M12 17.3 6.2 21l1.5-6.5L2.5 9.7l6.7-.6L12 3l2.8 6.1 6.7.6-5.2 4.8 1.5 6.5z" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import type { Lead } from "@/lib/domain/types";
import { CompanyAvatar } from "./FitBar";

function tierColor(score: number) {
  return score >= 80 ? "#3f7a43" : score >= 50 ? "#8a6d1f" : "#9a3b3b";
}

export function LeadDrawer({
  lead,
  onClose,
  onToggle,
}: {
  lead: Lead;
  onClose: () => void;
  onToggle: (l: Lead, s: Lead["status"]) => void;
}) {
  const emailScore = Math.max(0, ...lead.verifications.filter((v) => v.field === "email").map((v) => v.score));
  const phoneScore = Math.max(0, ...lead.verifications.filter((v) => v.field === "phone").map((v) => v.score));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20" />
      <div
        className="scroll-thin relative h-full w-full max-w-md overflow-y-auto border-l border-line bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CompanyAvatar name={lead.companyName} />
            <div>
              <h3 className="font-serif-display text-xl text-ink">{lead.companyName}</h3>
              <a href={`https://${lead.domain}`} className="text-xs text-brand hover:underline">
                {lead.domain}
              </a>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z" />
            </svg>
          </button>
        </div>

        {/* scores */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ScoreCard label="Fit Score" value={lead.fitScore} color="#3f7a43" />
          <ScoreCard label="総合信頼度" value={lead.confidence} color={tierColor(lead.confidence)} />
        </div>

        {/* contact */}
        <Section title="連絡先">
          <ContactRow label="メール" value={lead.email} score={emailScore} />
          <ContactRow label="電話" value={lead.phone} score={phoneScore} />
          <ContactRow label="所在地" value={lead.location} />
        </Section>

        {/* signals & enrichment */}
        <Section title="シグナル・属性">
          <InfoRow label="購買シグナル" value={lead.buyingSignal ?? "—"} />
          <InfoRow label="従業員規模" value={lead.size ?? "—"} />
          <InfoRow label="資金" value={lead.funding ?? "—"} />
          {Object.entries(lead.enrichment).map(([k, v]) => (
            <InfoRow key={k} label={k} value={v} />
          ))}
        </Section>

        {/* verification detail (差別化：検証根拠の透明化) */}
        <Section title="検証の根拠">
          <div className="space-y-1.5">
            {lead.verifications.length === 0 && <p className="text-sm text-muted">検証情報なし</p>}
            {lead.verifications.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  {v.field === "email" ? "メール" : "電話"} · {v.provider}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">{v.result}</span>
                  <span className="tabular-nums font-medium" style={{ color: tierColor(v.score) }}>
                    {v.score}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* sources (出典) */}
        <Section title="出典">
          <div className="space-y-1.5">
            {lead.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                className="block rounded-lg border border-line px-3 py-2 text-sm hover:border-brand/50"
              >
                <span className="font-medium text-ink">{s.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{s.snippet}</span>
              </a>
            ))}
          </div>
        </Section>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => onToggle(lead, lead.status === "favorite" ? "new" : "favorite")}
            className="flex-1 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm"
          >
            {lead.status === "favorite" ? "お気に入り解除" : "お気に入り"}
          </button>
          <button
            onClick={() => {
              onToggle(lead, "excluded");
              onClose();
            }}
            className="flex-1 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm text-ink-soft"
          >
            除外
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted">
          CRM連携（HubSpot / Salesforce）は最終フェーズで有効化されます
        </p>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-line bg-cream-100/40 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  );
}

function ContactRow({ label, value, score }: { label: string; value?: string; score?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-ink">{value || "—"}</span>
        {value && score != null && score > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: "#f2efe9", color: tierColor(score) }}
          >
            {score}
          </span>
        )}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

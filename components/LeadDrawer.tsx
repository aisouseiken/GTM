"use client";

/**
 * LeadDrawer（リード詳細パネル）
 * この部品は、一覧で選んだリード（見込み客）の詳しい情報を、画面右側からスライドして表示する
 * パネルです。会社名・連絡先・スコア・検証の根拠・出典などをまとめて確認でき、
 * お気に入り登録や除外の操作もここから行えます。
 */

import { useEffect } from "react";
import type { Lead } from "@/lib/domain/types";
import { CompanyAvatar } from "./FitBar";

// スコアの高さに応じて文字色を決める関数。80以上=緑 / 50以上=黄土色 / それ未満=赤。
function tierColor(score: number) {
  return score >= 80 ? "#3f7a43" : score >= 50 ? "#8a6d1f" : "#9a3b3b";
}

// lead=表示するリード / onClose=閉じる操作 / onToggle=状態（お気に入り・除外など）を切り替える操作
export function LeadDrawer({
  lead,
  onClose,
  onToggle,
}: {
  lead: Lead;
  onClose: () => void;
  onToggle: (l: Lead, s: Lead["status"]) => void;
}) {
  // メールの検証結果の中で最も高いスコアを取り出す（検証が無ければ0）
  const emailScore = Math.max(0, ...lead.verifications.filter((v) => v.field === "email").map((v) => v.score));
  // 電話の検証結果の中で最も高いスコアを取り出す（検証が無ければ0）
  const phoneScore = Math.max(0, ...lead.verifications.filter((v) => v.field === "phone").map((v) => v.score));

  // ★アクセシビリティ：Esc キーでパネルを閉じられるようにする（キーボード利用者向け）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // 画面全体を覆う黒い半透明の背景。ここをクリックするとパネルを閉じる。
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20" />
      {/* 右側のパネル本体。role=dialog / aria-modal でスクリーンリーダーに「モーダル」と伝える */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.companyName} の詳細`}
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
          {/* 右上の×ボタン。押すとパネルを閉じる */}
          <button onClick={onClose} className="text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z" />
            </svg>
          </button>
        </div>

        {/* scores（適合度・信頼度のスコアカード） */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ScoreCard label="Fit Score" value={lead.fitScore} color="#3f7a43" />
          <ScoreCard label="総合信頼度" value={lead.confidence} color={tierColor(lead.confidence)} />
        </div>

        {/* contact（連絡先の情報） */}
        <Section title="連絡先">
          <ContactRow label="メール" value={lead.email} score={emailScore} />
          <ContactRow label="電話" value={lead.phone} score={phoneScore} />
          <ContactRow label="所在地" value={lead.location} />
        </Section>

        {/* signals & enrichment（購買の兆しや会社の属性。enrichment=追加で収集した補足情報） */}
        <Section title="シグナル・属性">
          <InfoRow label="購買シグナル" value={lead.buyingSignal ?? "—"} />
          <InfoRow label="従業員規模" value={lead.size ?? "—"} />
          <InfoRow label="資金" value={lead.funding ?? "—"} />
          {/* enrichment は「項目名: 値」の集まり。1件ずつ行にして並べる（?? "—" は値が無いとき「—」を表示） */}
          {Object.entries(lead.enrichment).map(([k, v]) => (
            <InfoRow key={k} label={k} value={v} />
          ))}
        </Section>

        {/* verification detail (差別化：検証根拠の透明化) */}
        {/* 連絡先が本物かをどう確かめたか、その検証の根拠を一覧で見せる部分 */}
        <Section title="検証の根拠">
          <div className="space-y-1.5">
            {/* 検証情報が1件も無ければ、その旨を表示 */}
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
        {/* この情報をどこから得たかの出典リンク集。クリックすると元のページを開ける */}
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

        {/* 下部の操作ボタン: お気に入りの切り替えと、除外 */}
        <div className="mt-6 flex gap-2">
          {/* 押すたびに、お気に入り⇔通常（new）を切り替える */}
          <button
            onClick={() => onToggle(lead, lead.status === "favorite" ? "new" : "favorite")}
            className="flex-1 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm"
          >
            {lead.status === "favorite" ? "お気に入り解除" : "お気に入り"}
          </button>
          {/* このリードを除外し、パネルを閉じる */}
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

// ScoreCard: スコアを大きな数字で見せる小さなカード部品（label=見出し / value=点数 / color=文字色）
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

// Section: 見出し付きのまとまり（枠）を作る部品。title=見出し / children=その中身
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      {children}
    </div>
  );
}

// ContactRow: 連絡先の1行（メール・電話など）を表示。値があれば信頼度スコアのバッジも添える。
function ContactRow({ label, value, score }: { label: string; value?: string; score?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        {/* 値が無いときは「—」を表示 */}
        <span className="text-ink">{value || "—"}</span>
        {/* 値があり、かつスコアが1以上のときだけ、色付きのスコアバッジを表示 */}
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

// InfoRow: 「項目名 … 値」の1行を表示するシンプルな部品（属性や補足情報の表示に使う）
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

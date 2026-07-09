import Link from "next/link";
import { Logo } from "./Logo";
import { logoutAction } from "@/app/actions/auth";
import type { Workspace } from "@/lib/domain/types";

const RAIL = [
  { href: "", label: "検索", icon: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" },
  { href: "/leads", label: "リスト", icon: "M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h10v2H4v-2Z" },
  { href: "/api-keys", label: "API", icon: "M7 14a5 5 0 1 1 4.9-6H21v4h-2v3h-3v-3h-1.1A5 5 0 0 1 7 14Zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  { href: "/billing", label: "課金", icon: "M3 6h18v12H3V6Zm2 2v2h14V8H5Zm0 4v4h14v-4H5Z" },
];

export function AppShell({
  workspace,
  balance,
  active = "",
  children,
}: {
  workspace: Workspace;
  balance: number;
  active?: string;
  children: React.ReactNode;
}) {
  const base = `/app/w/${workspace.id}`;
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      {/* left rail */}
      <aside className="flex w-14 flex-col items-center gap-1 border-r border-line bg-cream-100/60 py-3">
        <div className="mb-2">
          <Link href="/app" className="inline-flex h-8 w-8 items-center justify-center">
            <svg viewBox="0 0 32 32" className="h-7 w-7">
              <path d="M16 3 L29 16 L16 12 Z" fill="#ff2e93" />
              <path d="M16 3 L3 16 L16 12 Z" fill="#ff77b8" />
              <path d="M16 12 L29 16 L16 29 Z" fill="#ff2e93" opacity="0.85" />
              <path d="M16 12 L3 16 L16 29 Z" fill="#ffa6cf" />
            </svg>
          </Link>
        </div>
        {RAIL.map((r) => {
          const isActive = active === (r.href || "search");
          return (
            <Link
              key={r.label}
              href={base + r.href}
              title={r.label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive ? "bg-paper text-ink shadow-sm" : "text-muted hover:bg-paper/60 hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d={r.icon} />
              </svg>
            </Link>
          );
        })}
        <form action={logoutAction} className="mt-auto">
          <button
            title="ログアウト"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-paper/60 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M10 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7V3Zm-.6 5L6 11.4H14v1.2H6L9.4 16 8 17.4 2.6 12 8 6.6 9.4 8Z" />
            </svg>
          </button>
        </form>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-cream/80 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Logo href="/app" />
            <span className="text-muted">/</span>
            <span className="text-sm text-ink">{workspace.name}</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
              {workspace.market}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={base + "/billing"}
              className="flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 text-sm"
            >
              <span className="h-2 w-2 rounded-full bg-brand" />
              <span className="tabular-nums font-medium text-ink">{balance.toLocaleString()}</span>
              <span className="text-muted">クレジット</span>
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

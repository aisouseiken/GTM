"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

const NAV = [
  { label: "Product", href: "#product" },
  { label: "Verticals", href: "#verticals" },
  { label: "Pricing", href: "#pricing" },
  { label: "Partners", href: "#data" },
  { label: "Guide", href: "#features" },
];

export function MarketingNav() {
  const navRef = useRef<HTMLElement>(null);

  // ネイティブのクリック委譲でハッシュ先へスムーススクロール（実ブラウザで確実に動作）
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href")!.slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      history.replaceState(null, "", `#${id}`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // smooth が無効な環境（一部ブラウザ）では確実に即時移動させるフォールバック
      window.setTimeout(() => {
        if (Math.abs(el.getBoundingClientRect().top - 80) > 12) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }, 450);
    };
    nav.addEventListener("click", onClick);
    return () => nav.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav ref={navRef} className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="cursor-pointer text-sm text-ink-soft transition-colors hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}

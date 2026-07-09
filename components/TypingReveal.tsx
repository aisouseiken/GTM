"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * 画面内に入ったら、テキストを1文字ずつ「PCで入力しているように」表示する。
 * 1回だけ再生（ループしない）。reduced motion では全文を静的表示。
 */
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

const PUNCT = /[、。，．,.！？!?]/;

export function TypingReveal({
  text,
  className = "",
  startDelay = 0,
  speed = 30,
}: {
  text: string;
  className?: string;
  startDelay?: number;
  speed?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [inView, setInView] = useState(false);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [inView]);

  const enabled = inView && !reduced;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = 0;
    const step = () => {
      if (cancelled) return;
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        return;
      }
      const ch = text[i - 1];
      const t = setTimeout(step, PUNCT.test(ch) ? 120 : speed + Math.random() * 18);
      timers.push(t);
    };
    const t0 = setTimeout(step, startDelay);
    timers.push(t0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [enabled, text, speed, startDelay]);

  const visible = reduced ? text : shown;

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {visible}
        {enabled && !done && (
          <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-caret bg-ink-soft align-baseline" />
        )}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

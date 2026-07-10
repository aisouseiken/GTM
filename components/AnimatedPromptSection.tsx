"use client";

// React の機能を読み込みます。
// useEffect: 表示後に処理を動かす / useRef: 要素や値を保持する箱 / useState: 状態を覚える / useSyncExternalStore: OS設定などの外部状態を購読する
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * AnimatedPromptSection（トップページの入力デモ欄）
 * この部品は、AIへの指示欄に文字が「1文字ずつ打たれる → 少し止まる → 消える → 次の文」を
 * 延々と繰り返して見せる、タイピング演出のセクションです。実際の入力はできない見本です。
 *
 * トップページのデモ専用セクション。
 * AIプロンプト入力欄の中で「指示文が1文字ずつ入力→停止→末尾から削除→次の文」を
 * 無限ループするタイピングアニメーションを表示し、GTM の利用体験を視覚的に伝える。
 *
 * - 外部ライブラリ不使用（React state + useEffect + setTimeout）
 * - 画面内に入ってから開始（Intersection Observer）
 * - prefers-reduced-motion では静的表示
 */

// アニメーションさせる指示文（GTM = 営業リード発掘サービスに最適化した具体的な内容）
const PROMPTS = [
  "東京の歯科医院で、スタッフを採用中の医院を探し、担当者情報を整理して営業リストを作成して",
  "既存顧客に似ている企業を抽出し、それぞれの決裁者の検証済みメールまで整理して",
  "資金調達したばかりの国内SaaS企業を探し、優先度順に並べて連絡先を添えてリスト化して",
  "Google広告を出している地域の工務店を収集し、採用シグナルがある企業だけ通知して",
];

// タイミング設定（ms = ミリ秒。1000ミリ秒 = 1秒）。演出の速さや間の長さをここで調整する。
// 「MIN + ランダムなJITTER（ゆらぎ）」で、機械的すぎない自然なリズムにしている。
const TYPE_MIN = 35;
const TYPE_JITTER = 20; // 35〜55ms/文字
const PUNCT_MIN = 100;
const PUNCT_JITTER = 80; // 句読点後 100〜180ms
const DONE_MIN = 1500;
const DONE_JITTER = 700; // 入力完了後 1500〜2200ms 停止
const DEL_MIN = 18;
const DEL_JITTER = 12; // 削除 18〜30ms/文字
const EMPTY_MIN = 250;
const EMPTY_JITTER = 250; // 全削除後 250〜500ms 停止
const START_DELAY = 450; // 画面内に入ってから最初の入力までの待機

// 句読点などの記号を判定するパターン。記号のあとは少し長めに間を取るために使う。
const PUNCT = /[、。，．,.！？!?]/;

/** 画面内に入ったか（1回だけ true）を返す */
// 対象の要素がスクロールで画面に入ってきたかを検知する部品。入ったら演出を始める合図に使う。
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null); // 監視したい要素をつなぐ参照
  const [inView, setInView] = useState(false); // 画面内に入ったか
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return; // 要素が無い/検知済みなら何もしない
    // IntersectionObserver = 要素が見えているかを監視するブラウザの仕組み
    const ob = new IntersectionObserver(
      (entries) => {
        // 要素が一定割合（35%）見えたら画面内と判断し、監視を止める
        if (entries[0]?.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    ob.observe(el);
    return () => ob.disconnect(); // クリーンアップ（後始末）: 部品が消えるとき監視をやめる
  }, [inView]);
  return { ref, inView };
}

/** OS/ブラウザの「アニメーションを減らす」設定を検知（effect内setStateを避け useSyncExternalStore で購読） */
// 利用者が「動きを減らす」設定にしているかを調べる部品。true ならアニメを止める配慮に使う。
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false // サーバー側スナップショット
  );
}

/**
 * タイピングアニメーションのカスタムフック。
 * enabled=false のときは最初の文章を静的に表示する。
 * 単一の setTimeout チェーンで進行し、アンマウント/再実行時に必ず解除する
 * （React Strict Mode の二重起動でも cancelled フラグで多重ループを防ぐ）。
 */
function useTypingAnimation(prompts: string[], enabled: boolean) {
  const [displayed, setDisplayed] = useState(""); // 今この瞬間に画面へ出している文字列

  useEffect(() => {
    if (!enabled) return; // reduced motion / 画面外：静的表示は下の導出で行う

    let cancelled = false; // 部品が消えたら true にして演出を止める目印
    let timer: ReturnType<typeof setTimeout>; // 次の一手を予約するタイマー
    let promptIndex = 0; // 今どの文（PROMPTSの何番目）を演出しているか
    let charIndex = 0; // その文の何文字目まで表示しているか
    // 今の動作モード。typing=入力中 / pausing=入力後の停止 / deleting=削除中 / empty=空になった後の停止
    let mode: "typing" | "pausing" | "deleting" | "empty" = "typing";

    // 待ち時間を「最小値 + ランダムなゆらぎ」で計算する小さな道具
    const j = (min: number, jitter: number) => min + Math.random() * jitter;

    // tick = 演出の1コマを進める関数。少し待ってはこの関数自身を呼び直し、状態を1歩ずつ進めていく。
    const tick = () => {
      if (cancelled) return;
      const full = prompts[promptIndex]; // 今扱っている文の全文

      if (mode === "typing") {
        // 入力中: 表示する文字数を1つ増やす
        charIndex += 1;
        setDisplayed(full.slice(0, charIndex)); // 先頭からcharIndex文字目までを表示
        if (charIndex >= full.length) {
          // 全部打ち終わったら「停止」モードに移り、少し長めに待つ
          mode = "pausing";
          timer = setTimeout(tick, j(DONE_MIN, DONE_JITTER));
        } else {
          // まだ途中なら、直前に打った文字が記号かどうかで次までの間隔を変える
          const justTyped = full[charIndex - 1];
          const delay = PUNCT.test(justTyped)
            ? j(PUNCT_MIN, PUNCT_JITTER) // 記号のあとは長め
            : j(TYPE_MIN, TYPE_JITTER); // 通常文字は短め
          timer = setTimeout(tick, delay);
        }
      } else if (mode === "pausing") {
        // 停止のあとは削除モードへ切り替える
        mode = "deleting";
        timer = setTimeout(tick, j(DEL_MIN, DEL_JITTER));
      } else if (mode === "deleting") {
        // 削除中: 表示文字数を1つ減らす（末尾から消していく）
        charIndex -= 1;
        setDisplayed(full.slice(0, Math.max(0, charIndex)));
        if (charIndex <= 0) {
          // 全部消えたら「空」モードへ
          mode = "empty";
          timer = setTimeout(tick, j(EMPTY_MIN, EMPTY_JITTER));
        } else {
          timer = setTimeout(tick, j(DEL_MIN, DEL_JITTER));
        }
      } else {
        // empty → 次の文章へ
        // 次の文へ進む（最後の文まで行ったら % で最初の文に戻る）
        promptIndex = (promptIndex + 1) % prompts.length;
        charIndex = 0;
        mode = "typing";
        timer = setTimeout(tick, 120);
      }
    };

    // 初期 state が "" なので空から開始。最初の入力までは待機。
    timer = setTimeout(tick, START_DELAY);

    // クリーンアップ（後始末）: 部品が消えるときに演出を止め、予約中のタイマーを解除する
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, prompts]);

  // reduced motion / 画面外では最初の1文を静的表示（state は書かず導出）
  const shown = enabled ? displayed : prompts[0];
  // 入力が完了した文章か（送信ボタンをわずかに強調する判定に使う）
  const isComplete = enabled && prompts.includes(displayed);
  return { displayed: shown, isComplete };
}

// compact=true のときは見出しや背景なしで入力欄だけを表示する（他の場所に埋め込む用）
export function AnimatedPromptSection({ compact = false }: { compact?: boolean } = {}) {
  const { ref, inView } = useInView<HTMLElement>(); // この欄が画面に入ったか
  const reduced = useReducedMotion(); // 「動きを減らす」設定がオンか
  const enabled = inView && !reduced; // 画面内かつ動きを減らす設定でなければ演出を有効化
  const { displayed, isComplete } = useTypingAnimation(PROMPTS, enabled); // 表示中の文字と、入力完了かどうか

  // 登場アニメーション（inView で1回だけ）
  // 画面に入ったとき、または動きを減らす設定のときに「表示済み」の見た目にする
  const revealed = inView || reduced;
  // 各パーツを少しずつ時間差で出すための「遅らせる時間」を指定する小さな道具（ミリ秒）。
  const revealStyle = (delayMs: number) => ({
    transitionDelay: `${delayMs}ms`,
  });
  // 表示済みなら「出現後」の見た目クラス、まだなら「出現前」のクラスを付ける。
  const revealCls = revealed ? "reveal-init reveal-in" : "reveal-init";

  // プロンプト入力欄本体（compact / 通常 で共有）
  const promptBox = (
    <>
      {/* 上部の装飾チップ（参考画像に合わせる・操作不可） */}
      <div
        aria-hidden
        className="mb-3 flex flex-wrap items-center justify-center gap-2 text-sm"
      >
        {/* 1つ目のチップ：吹き出しアイコン＋「顧客プロフィールを入力」の文言 */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 font-medium text-ink shadow-sm">
          {/* svg = 絵記号。この path はチャット吹き出しの形を描いている */}
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-ink-soft">
            <path d="M4 4h16v11H7l-3 3V4Zm3 4v2h10V8H7Zm0 3v2h7v-2H7Z" />
          </svg>
          顧客プロフィールを入力
        </span>
        {/* 2つ目のチップ：地球アイコン＋「ドメインを使う」＋Autoバッジ */}
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ink-soft">
          {/* この path は地球儀（グローバル）の形を描いている */}
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.7 0 3.3 1.9 4 4.7H8C8.7 5.9 10.3 4 12 4Zm-5.7 4.7H4.6A8 8 0 0 1 9 4.6a11 11 0 0 0-2.7 4.1Zm-2 2h2.2c-.1.7-.2 1.5-.2 2.3s.1 1.6.2 2.3H4.3a8 8 0 0 1 0-4.6Zm2.3 6.6h1.7a11 11 0 0 0 2.7 4.1 8 8 0 0 1-4.4-4.1Zm5.4 4.1c-1.7 0-3.3-1.9-4-4.1h8c-.7 2.2-2.3 4.1-4 4.1Zm4.6-6.4H8.4c-.1-.7-.2-1.4-.2-2.3s.1-1.6.2-2.3h7.2c.1.7.2 1.4.2 2.3s-.1 1.6-.2 2.3Zm.5 6.4a11 11 0 0 0 2.7-4.1H20a8 8 0 0 1-4.4 4.1Zm2.9-6.4c.1-.7.2-1.5.2-2.3s-.1-1.6-.2-2.3h2.2a8 8 0 0 1 0 4.6h-2.2Z" />
          </svg>
          ドメインを使う
          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            Auto
          </span>
        </span>
      </div>

      {/* プロンプトボックス本体（本物のフォームではない・編集不可のデモ） */}
      <div
        role="img"
        aria-label="GTM のAIプロンプトのデモ。やりたいことを日本語で入力すると、GTM の AI が条件に合う企業を探して検証済みの営業リストを作成します。"
        className="flex min-h-[150px] flex-col rounded-3xl border border-line bg-paper p-5 text-left shadow-[0_10px_40px_-24px_rgba(0,0,0,0.28)] sm:min-h-[160px] sm:p-6"
      >
        {/* 文字表示領域（左上・左揃え）。スクリーンリーダーには読ませない */}
        <div
          aria-hidden
          className="flex-1 text-[16px] leading-[1.65] text-ink sm:text-[18px]"
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {/* 現在タイピング中の文字列。うしろに点滅するカーソル（縦棒）を表示する */}
          {displayed}
          <span
            className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-ink align-baseline ${
              reduced ? "opacity-70" : "animate-caret"
            }`}
          />
        </div>

        {/* 下部：左＝添付アイコン（装飾）／右＝送信ボタン（装飾） */}
        <div className="mt-4 flex items-end justify-between">
          {/* 左：クリップ（添付）アイコン。見た目だけで押しても何も起きない */}
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted"
          >
            {/* この path はゼムクリップの形を描いている */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M16.5 6.5 8 15a3 3 0 1 0 4.24 4.24l7.07-7.07a5 5 0 1 0-7.07-7.07L4.9 12.37a.75.75 0 0 0 1.06 1.06l7.34-7.33a3.5 3.5 0 1 1 4.95 4.95l-7.07 7.07a1.5 1.5 0 1 1-2.12-2.12l8.5-8.51-1.06-1.06Z" />
            </svg>
          </span>
          {/* 右：送信ボタン（上向き矢印）。入力が完了した瞬間だけ少し拡大し黒く強調する演出 */}
          <span
            aria-hidden
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
              isComplete
                ? "scale-[1.04] bg-ink text-white"
                : "bg-cream-100 text-ink-soft"
            }`}
          >
            {/* この path は上向きの矢印（送信）を描いている */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 4.5 5.5 11l1.4 1.4 4.1-4.1V19h2V8.3l4.1 4.1L18.5 11 12 4.5Z" />
            </svg>
          </span>
        </div>
      </div>

      {/* スクリーンリーダー向けの静的説明（1文字更新を読み上げさせない） */}
      <p className="sr-only">
        GTM のAIプロンプトのデモです。「{PROMPTS[0]}」のように、やりたいことを日本語で伝えるだけで、
        GTM の AI が条件に合う企業を探して検証済みの営業リストを作成します。
      </p>
    </>
  );

  // compact：Hero 内に置く用（見出し・セクション背景なしで入力欄のみ）
  // compact モードのときは、余計な装飾を省いて入力欄だけを返す
  if (compact) {
    return (
      // compact 版：見出しや背景を付けず、入力欄だけを返す（他の場所に埋め込む用）
      <section ref={ref} aria-label="AIプロンプトのデモ" className="mx-auto w-full max-w-4xl">
        {/* 少し遅れて（120ミリ秒後）ふわっと出す入れ物。中身は上で組み立てた入力欄 */}
        <div
          className={`mx-auto w-[92%] max-w-[900px] ${revealCls}`}
          style={revealStyle(120)}
        >
          {promptBox}
        </div>
      </section>
    );
  }

  // 通常版：見出し・小ラベル・背景の光まで含めたセクション全体を返す
  return (
    <section
      ref={ref}
      aria-labelledby="prompt-demo-heading"
      className="relative overflow-hidden border-t border-line/60 bg-cream-100/30 py-20 sm:py-24"
    >
      {/* 背景：ごく薄い光を2つ配置（可読性を下げない控えめな演出） */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-soft/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-56 w-56 rounded-full bg-brand-soft/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-6">
        {/* 上部：小さなラベル */}
        <p
          className={`text-xs font-medium uppercase tracking-[0.22em] text-brand ${revealCls}`}
          style={revealStyle(0)}
        >
          AIにやりたいことを伝えるだけ
        </p>

        {/* 中央：短い見出し（2行以内） */}
        <h2
          id="prompt-demo-heading"
          className={`mx-auto mt-4 max-w-2xl font-serif-display text-3xl leading-tight text-ink sm:text-4xl ${revealCls}`}
          style={revealStyle(100)}
        >
          やりたいことを、言葉で伝えるだけ。
        </h2>

        {/* 下部：AIプロンプト入力欄（デモ） */}
        <div
          className={`mx-auto mt-9 w-[90%] max-w-[1000px] ${revealCls}`}
          style={revealStyle(220)}
        >
          {/* 上部の装飾チップ（参考画像に合わせる・操作不可） */}
          {promptBox}
        </div>
      </div>
    </section>
  );
}

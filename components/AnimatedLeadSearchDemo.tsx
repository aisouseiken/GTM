"use client";

// React の機能を読み込みます。
// useEffect: 画面表示後などに処理を動かす / useRef: 要素や値を保持する箱 / useState: 状態を覚える / useSyncExternalStore: 外部の状態（OS設定など）を購読する
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CompanyAvatar } from "./FitBar";

/**
 * AnimatedLeadSearchDemo（トップページの動くデモ）
 * これはトップページに置く「操作している様子を自動再生する見本」です。実際には操作しません。
 * 左のチャット欄に文字が1文字ずつ打たれ、AIが返信し、右側にリード一覧が上から順に出てくる、
 * という一連の流れをアニメーションで見せて、プロダクトの雰囲気を伝えます。
 *
 * トップページのメイン UI モック（左チャット＋右結果テーブル）を、
 * 「AIに指示 → AIが結果を返す → 一覧が生成される」流れが伝わる
 * 動くライブデモとして実装したコンポーネント。
 *
 * - 外部ライブラリ不使用（React state + useEffect + setTimeout）
 * - 画面内に入って初めて自動再生（Intersection Observer）
 * - prefers-reduced-motion では完成形を静的表示
 * - 行/ヘッダ/返信は常に DOM に置き opacity/transform のみ変化 → CLS を出さない
 */

const INPUT_TEXT = "東京の歯科医院で、スタッフを採用中の医院を探して"; // タイピング演出で1文字ずつ打たれる入力例
const REPLY_SUFFIX =
  "件の歯科医院を発見しました。採用シグナル・広告出稿で絞り込み済みです。"; // AI返信のうち、数字の後ろに続く固定文
const REPLY_TARGET = 1240; // カウントアップ演出の最終到達値（発見件数）

// 結果テーブルの1行分のデータの形。name=会社名 / cat=業種 / hc=従業員数 / sig=シグナル(購買の兆し) / score=適合度スコア
interface Row {
  name: string;
  cat: string;
  hc: number;
  sig: string;
  score: number;
}

// デモ用に表示する、あらかじめ用意した会社の一覧
const ROWS: Row[] = [
  { name: "株式会社あおば歯科", cat: "歯科・デンタル", hc: 12, sig: "採用強化中（3名）", score: 97 },
  { name: "みらいデンタルクリニック", cat: "歯科・デンタル", hc: 8, sig: "新規開業（今月）", score: 95 },
  { name: "さくら矯正歯科", cat: "歯科・デンタル", hc: 15, sig: "広告出稿中", score: 93 },
  { name: "ヒカリ歯科医院", cat: "歯科・デンタル", hc: 6, sig: "採用強化中", score: 91 },
  { name: "結デンタルオフィス", cat: "歯科・デンタル", hc: 20, sig: "拠点拡大", score: 89 },
  { name: "north woods dental", cat: "歯科・デンタル", hc: 10, sig: "Hiring hygienists", score: 86 },
  { name: "大和ファミリー歯科", cat: "歯科・デンタル", hc: 9, sig: "新規開業", score: 84 },
  { name: "翔デンタルケア", cat: "歯科・デンタル", hc: 5, sig: "広告出稿中", score: 81 },
];

// 句読点などの記号を判定するための正規表現（パターン）。記号のあとは少し長めに間を取るために使う。
const PUNCT = /[、。，．,.！？!?]/;

/** 画面内に入ったか（1回だけ true） */
// この部品（フック）は、対象の要素が画面にスクロールで入ってきたかを検知します。入ったら true にして以後は監視をやめます。
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null); // 監視したい要素をつなぐための参照
  const [inView, setInView] = useState(false); // 画面内に入ったかどうか
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return; // 要素が無い、または既に検知済みなら何もしない
    // IntersectionObserver = 要素が画面に見えているかを監視するブラウザの仕組み
    const ob = new IntersectionObserver(
      (entries) => {
        // 要素が3割以上見えたら「画面内に入った」と判断し、監視を停止する
        if (entries[0]?.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { threshold: 0.3 } // 3割（0.3）見えたら反応する設定
    );
    ob.observe(el);
    // クリーンアップ（後始末）: この部品が消えるときに監視をやめてメモリを解放する
    return () => ob.disconnect();
  }, [inView]);
  return { ref, inView };
}

/** OS/ブラウザの「アニメーションを減らす」設定（effect内setStateを避け useSyncExternalStore で購読） */
// 利用者が「動きを減らす」設定を有効にしているかを調べる部品。true ならアニメを止めて配慮します。
function useReducedMotion() {
  return useSyncExternalStore(
    // 1つ目：設定変更を知らせてもらう「見張り」を仕掛ける
    (cb) => {
      // matchMedia = ブラウザに「今この条件（動きを減らす設定）にあてはまる？」と尋ねる仕組み
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb); // 設定が変わったら再チェックするよう登録
      return () => mq.removeEventListener("change", cb); // 後始末：見張りを解除
    },
    // 2つ目：今この瞬間の設定値（動きを減らす設定なら true）
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false // サーバー側スナップショット（ブラウザが無い場所での初期値。動かす扱い）
  );
}

export function AnimatedLeadSearchDemo() {
  const { ref, inView } = useInView<HTMLDivElement>(); // このデモが画面に入ったか
  const reduced = useReducedMotion(); // 「動きを減らす」設定がオンか
  const enabled = inView && !reduced; // 画面内に入っていて、かつ動きを減らす設定でなければアニメを動かす

  // ---- アニメーションの各段階を表す状態 ----
  const [typed, setTyped] = useState(""); // 左：入力中の文字列
  const [showReply, setShowReply] = useState(false); // 左：AI返信吹き出し
  const [count, setCount] = useState(0); // AI返信内のカウントアップ
  const [showHeader, setShowHeader] = useState(false); // 右：見出し＋チップ
  const [visibleRows, setVisibleRows] = useState(0); // 右：表示済み行数
  const [activate, setActivate] = useState(false); // 「+ さらに取得」活性化

  // アニメーション全体の進行を管理する処理。enabled が true のときだけ動き、ずっと繰り返します。
  useEffect(() => {
    // reduced motion / 画面外：アニメーションは動かさない（完成形は描画側で導出）
    if (!enabled) return;

    let cancelled = false; // この部品が消えたら true にして、途中の演出を止めるための目印
    const timers: ReturnType<typeof setTimeout>[] = []; // 使ったタイマーを後で全部止められるよう控えておく
    // 指定ミリ秒だけ待つための小さな道具。await wait(500) のように「少し待つ」目的で使う。
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = setTimeout(res, ms);
        timers.push(t);
      });

    // 演出の本体。上から順に「入力→返信→ヘッダ→行表示→…」と進み、最後にリセットして繰り返す。
    const run = async () => {
      // Strict Mode の二重起動は cancelled フラグで無効化される
      while (!cancelled) {
        // --- 初期状態へ ---
        setTyped("");
        setShowReply(false);
        setCount(0);
        setShowHeader(false);
        setVisibleRows(0);
        setActivate(false);
        await wait(500);
        if (cancelled) return;

        // --- ステップ3：1文字ずつ入力 ---
        // 文字列を先頭からi文字目まで切り出して表示することを繰り返し、人が入力しているように見せる
        for (let i = 1; i <= INPUT_TEXT.length; i++) {
          if (cancelled) return;
          setTyped(INPUT_TEXT.slice(0, i));
          const ch = INPUT_TEXT[i - 1];
          // 記号のあとは長め(140ms)、通常文字は短め(約40〜55ms)待って自然なリズムにする
          await wait(PUNCT.test(ch) ? 140 : 40 + Math.random() * 15);
        }
        await wait(950);
        if (cancelled) return;

        // --- ステップ4：AI返信＋カウントアップ ---
        setShowReply(true); // AIの返信吹き出しを表示
        await wait(220);
        const steps = 22; // 件数を0から目標値まで、22回に分けて少しずつ増やす
        for (let s = 1; s <= steps; s++) {
          if (cancelled) return;
          setCount(Math.round((REPLY_TARGET / steps) * s)); // 途中の数字を計算して表示
          await wait(34);
        }
        setCount(REPLY_TARGET); // 最後にちょうど目標値に合わせる
        await wait(320);
        if (cancelled) return;

        // --- ステップ5：右ヘッダ＋チップ ---
        setShowHeader(true);
        await wait(520);
        if (cancelled) return;

        // --- ステップ6〜8：行を上から順に表示（FITバーはCSSで伸長） ---
        // 表示する行数を1つずつ増やし、リードが1件ずつ現れていくように見せる
        for (let r = 1; r <= ROWS.length; r++) {
          if (cancelled) return;
          setVisibleRows(r);
          await wait(95);
        }
        await wait(420);
        if (cancelled) return;

        // --- ステップ9：ボタン活性化 ---
        setActivate(true); // 「+ さらに取得」ボタンを目立たせる（有効化の見た目に）

        // --- 完了後の静止 ---
        await wait(3200);
        if (cancelled) return;

        // --- ループ：一覧→返信をフェードで戻し、入力は末尾から削除 ---
        setActivate(false);
        setVisibleRows(0); // 行はまとめてフェードアウト（DOMは維持）
        await wait(320);
        setShowReply(false);
        setCount(0);
        setShowHeader(false);
        await wait(260);
        for (let i = INPUT_TEXT.length; i >= 0; i--) {
          if (cancelled) return;
          setTyped(INPUT_TEXT.slice(0, i));
          await wait(22);
        }
        await wait(320);
      }
    };

    run(); // 演出を開始する
    // クリーンアップ（後始末）: 部品が消えるとき、演出を止めて全タイマーを解除する
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [enabled]);

  // アニメーションしない場合（reduced motion / 画面外）は完成形を描画時に導出
  // 以下の d〜 は「実際に画面へ表示する値」。演出オフのときは最初から完成形を表示する。
  const showStatic = !enabled;
  const dTyped = showStatic ? INPUT_TEXT : typed;
  const dShowReply = showStatic || showReply;
  const dCount = showStatic ? REPLY_TARGET : count;
  const dShowHeader = showStatic || showHeader;
  const dVisibleRows = showStatic ? ROWS.length : visibleRows;
  const dActivate = showStatic || activate;

  // 全体をふわっと出すための表示クラス。画面内に入ったか動きを減らす設定なら「表示済み」の見た目にする。
  const revealCls = inView || reduced ? "reveal-init reveal-in" : "reveal-init";

  // ここから実際の見た目（JSX）。ref をつけた外枠が「画面内に入ったか」の監視対象になる。
  return (
    <div ref={ref} className={revealCls}>
      {/* スクリーンリーダー向けの静的説明（1文字更新は読み上げさせない） */}
      <p className="sr-only">
        GTM のプロダクトデモ。「{INPUT_TEXT}」のように指示すると、GTM の AI が条件に合う
        歯科医院を抽出し、FitScore 付きの営業リストを生成します。
      </p>

      <div
        aria-hidden
        className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)]"
      >
        {/* 全体を2カラムに分ける：左320px＝チャット、右＝結果テーブル（画面が狭いと縦積み） */}
        <div className="grid md:grid-cols-[320px_1fr]">
          {/* ==== 左：チャット ==== */}
          <div className="flex min-h-[300px] flex-col border-b border-line bg-cream-100/40 p-4 md:min-h-[440px] md:border-b-0 md:border-r">
            {/* チャットの見出し（プロジェクト名のような小さなラベル） */}
            <div className="mb-3 text-xs text-muted">歯科クリニック開拓 · JP</div>

            {/* 入力吹き出し（タイピング）：ユーザーが打っている風の文字と点滅カーソルを表示 */}
            <div className="rounded-xl bg-paper p-3 text-sm leading-relaxed text-ink shadow-sm">
              {/* 現在タイピング中（または完成形）の文字列。改行や折り返しを保つ設定付き */}
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {dTyped}
              </span>
              {/* 点滅するカーソル（縦棒）。動きを減らす設定なら非表示にする */}
              <span
                className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-ink align-baseline ${
                  reduced ? "hidden" : "animate-caret"
                }`}
              />
            </div>

            {/* AI返信吹き出し（フェード＋カウントアップ） */}
            <div
              className="mt-3 rounded-xl bg-brand-soft/60 p-3 text-sm leading-relaxed text-ink-soft transition-all duration-500"
              style={{
                opacity: dShowReply ? 1 : 0,
                transform: dShowReply ? "translateY(0)" : "translateY(10px)",
              }}
            >
              {/* 発見件数（カウントアップ中の数字）。toLocaleString で3桁ごとにカンマを付ける（例：1,240） */}
              <span className="font-medium text-ink">{dCount.toLocaleString()}</span>
              {/* 数字のうしろに続く固定の説明文 */}
              {REPLY_SUFFIX}
            </div>

            {/* フォローアップ入力欄（従属要素・静止） */}
            <div
              className="mt-auto rounded-xl border border-line bg-paper p-2.5 transition-opacity duration-500"
              style={{ opacity: dActivate ? 1 : 0.55 }}
            >
              <span className="text-xs text-muted">フォローアップを入力…</span>
            </div>
          </div>

          {/* ==== 右：結果テーブル ==== */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div
                className="transition-all duration-500"
                style={{
                  opacity: dShowHeader ? 1 : 0,
                  transform: dShowHeader ? "translateY(0)" : "translateY(6px)",
                }}
              >
                <div className="font-serif-display text-base text-ink">
                  東京 · 歯科 · 採用中
                </div>
                <div className="mt-1 flex gap-2 text-[11px]">
                  {["採用中", "広告出稿"].map((c, i) => (
                    <span
                      key={c}
                      className="rounded-full border border-line px-2 py-0.5 text-ink-soft transition-all duration-300"
                      style={{
                        opacity: dShowHeader ? 1 : 0,
                        transform: dShowHeader ? "scale(1)" : "scale(0.98)",
                        transitionDelay: `${120 + i * 100}ms`,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                className="rounded-full border border-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink transition-all duration-300"
                style={{
                  opacity: dActivate ? 1 : 0.5,
                  transform: dActivate ? "scale(1.02)" : "scale(1)",
                  background: dActivate ? "var(--color-cream-100)" : undefined,
                }}
              >
                + さらに取得
              </button>
            </div>

            {/* テーブル：行は常に DOM に存在し opacity/transform のみで出現（CLS回避） */}
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-cream-100/60 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fit</th>
                    <th className="px-3 py-2 font-medium">会社</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">業種</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">従業員</th>
                    <th className="px-3 py-2 font-medium">シグナル</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 全行を最初からDOMに置いておき、shown（表示対象か）で見え方だけ切り替える → レイアウトのガタつきを防ぐ */}
                  {ROWS.map((row, i) => {
                    const shown = i < dVisibleRows; // この行を今表示すべきかどうか
                    return (
                      <tr
                        key={row.name}
                        className="border-t border-line/70 transition-all duration-300"
                        style={{
                          opacity: shown ? 1 : 0,
                          transform: shown ? "translateY(0)" : "translateY(8px)",
                        }}
                      >
                        {/* FIT列：適合度を表す横バー。行が出るとき幅0からスコアに応じた幅へ伸びる */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {/* バーの入れ物（はみ出しは隠す） */}
                            <span className="inline-block h-3 overflow-hidden rounded-sm">
                              {/* 実際の色付きバー。幅はスコア×0.34（最低12px）、色はスコアで3段階に変える */}
                              <span
                                className="block h-3 rounded-sm transition-[width] duration-700 ease-out"
                                style={{
                                  width: shown ? `${Math.max(12, row.score * 0.34)}px` : "0px",
                                  background:
                                    row.score >= 88
                                      ? "#7bc47f" // 高スコア＝濃い緑
                                      : row.score >= 74
                                        ? "#a7cf7d" // 中スコア＝黄緑
                                        : "#cfe08a", // 低スコア＝薄い黄緑
                                }}
                              />
                            </span>
                            <span
                              className="tabular-nums text-ink-soft transition-opacity duration-300"
                              style={{ opacity: shown ? 1 : 0 }}
                            >
                              {row.score}
                            </span>
                          </div>
                        </td>
                        {/* 会社列：会社ロゴ代わりのアイコン＋会社名 */}
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <CompanyAvatar name={row.name} />
                            <span className="text-ink">{row.name}</span>
                          </span>
                        </td>
                        {/* 業種列（画面が狭いと隠す） */}
                        <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">
                          {row.cat}
                        </td>
                        {/* 従業員数列（画面がさらに広いときだけ表示） */}
                        <td className="hidden px-3 py-2 text-ink-soft md:table-cell">
                          {row.hc}
                        </td>
                        {/* シグナル列：購買の兆し（採用強化中・広告出稿中など） */}
                        <td className="px-3 py-2 text-ink-soft">{row.sig}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Workspace（ワークスペース）画面
 * この画面は「リード（見込み客）探し」のメイン作業スペースです。
 * 左側のチャット欄に理想の顧客像を文章で入力すると、AIが検索プランを作り、
 * 実行すると見つかった会社を右側の一覧に1件ずつ表示していきます。
 * （リード = 営業のターゲットになる見込み客の会社や人のこと）
 */

// React の基本的な機能を読み込みます。
// useState: 画面が覚えておく値（状態）を管理する / useRef: 再描画をまたいで値を保持する箱 / useCallback: 関数を作り直さず使い回す
import { useCallback, useRef, useState } from "react";
// useRouter = 画面の移動や再読み込みを行う Next.js の道具
import { useRouter } from "next/navigation";
// Lead（見込み客1件）と SearchPlan（検索プラン）の「データの形」の定義を読み込む
import type { Lead, SearchPlan } from "@/lib/domain/types";
// FitBar=適合度バー、CompanyAvatar=会社アイコン の表示部品
import { FitBar, CompanyAvatar } from "./FitBar";
// LeadDrawer = リードをクリックしたとき右から出てくる詳細パネル
import { LeadDrawer } from "./LeadDrawer";

// 画面の進行状態を表す種類。idle=待機中 / planning=プラン作成中 / plan_ready=プラン完成 / running=検索実行中 / done=完了
type Phase = "idle" | "planning" | "plan_ready" | "running" | "done";

// 進行状況として画面に流す1行分のログの形。id=行の番号 / text=表示文 / kind=情報かOK(完了)か
interface ProgressLine {
  id: number;
  text: string;
  kind: "info" | "ok";
}

// 入力欄が空のときに例として提示する、検索の入力例（サジェスト）の一覧
const SUGGESTIONS = [
  "東京の歯科医院で、スタッフを採用中の医院を探して",
  "フロリダで技術者を採用中、かつGoogle広告を出しているHVAC企業",
  "資金調達したばかりの国内SaaSスタートアップ",
  "大阪の飲食店で新規オープンした店舗",
];

export function Workspace({
  workspaceId,
}: {
  workspaceId: string;
}) {
  // ここから画面が覚えておく値（state）の定義です。値が変わると画面が自動で描き直されます。
  const [phase, setPhase] = useState<Phase>("idle"); // 今どの進行状態か（待機/作成中/実行中など）
  const [input, setInput] = useState(""); // 入力欄に打ち込んでいる途中の文字
  const [userPrompt, setUserPrompt] = useState(""); // 送信済みのユーザーの指示文（チャットの吹き出しに表示）
  const [plan, setPlan] = useState<SearchPlan | null>(null); // AIが作った検索プラン（まだ無ければ null）
  const [sessionId, setSessionId] = useState<string | undefined>(); // 会話の続きを覚えておくための識別子
  const [progress, setProgress] = useState<ProgressLine[]>([]); // 進行状況ログの一覧
  const [leads, setLeads] = useState<Lead[]>([]); // 見つかったリード（見込み客）の一覧
  const [jobId, setJobId] = useState<string | null>(null); // 実行中の検索ジョブ（処理）のID
  const [selected, setSelected] = useState<Lead | null>(null); // 詳細パネルを開くために選んだリード
  const [saved, setSaved] = useState(false); // 結果をリストに保存済みかどうか
  const progressCounter = useRef(0); // ログ行に一意の番号を振るためのカウンター（画面を描き直しても値が消えない箱）
  const router = useRouter(); // Next.js の画面遷移・再読み込みを行う道具

  // 進行状況ログを1行追加する関数。番号を1つ増やして、既存の一覧の末尾に新しい行を足します。
  const pushProgress = (text: string, kind: "info" | "ok" = "info") => {
    progressCounter.current += 1;
    setProgress((p) => [...p, { id: progressCounter.current, text, kind }]);
  };

  // ユーザーの指示文をサーバーに送り、検索プランを作ってもらう関数。
  // 送信すると画面をリセットして「プラン作成中」の状態にし、返ってきたプランを画面に反映します。
  const submitPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return; // 空文字や空白だけのときは何もしない
      setUserPrompt(prompt);
      setInput("");
      setPhase("planning");
      setPlan(null);
      setLeads([]);
      setProgress([]);
      setSaved(false);
      setJobId(null); // ★前回ジョブのIDを消す（消さないとCSVリンクが前回結果を指したまま残る不具合になる）
      // サーバーの /api/plan にユーザーの指示を送り、AIに検索プランを作らせる（await = 返事が来るまで待つ）
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, prompt, sessionId }),
      });
      // 通信に失敗したときはエラーを表示して待機状態に戻す
      if (!res.ok) {
        pushProgress("プランの作成に失敗しました");
        setPhase("idle");
        return;
      }
      const data = await res.json(); // 返ってきたデータを JSON として読み取る
      setSessionId(data.sessionId);
      setPlan(data.plan);
      setPhase("plan_ready");
    },
    [workspaceId, sessionId]
  );

  // 作成済みの検索プランを実際に実行する関数。
  // サーバーに検索ジョブ（処理）を開始させ、進捗と結果をリアルタイムで受け取ります。
  const runPlan = useCallback(async () => {
    if (!plan) return; // プランがまだ無ければ何もしない
    setPhase("running"); // 状態を「実行中」に
    setLeads([]); // 前回の結果をクリア
    setProgress([]); // 前回のログをクリア
    // 検索ジョブの開始をサーバーに依頼する
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });
    // 開始に失敗したとき（クレジット不足など）はエラーを出してプラン完成の状態に戻す
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      pushProgress(e.error === "insufficient_credits" ? "クレジットが不足しています" : "実行に失敗しました");
      setPhase("plan_ready");
      return;
    }
    const { jobId: jid } = await res.json(); // 開始できたジョブのIDを受け取る
    setJobId(jid);

    // EventSource（SSE）= サーバーから小さな更新を1件ずつ送ってもらう仕組み。
    // これにより、検索の進捗やリードを「見つかった順」に逐次受け取って画面へ反映できます。
    const ev = new EventSource(`/api/jobs/${jid}/stream`);
    let finished = false; // 正常に終了(end/completed/failed)したかどうか（onerrorと区別するため）
    // サーバーからメッセージが届くたびに呼ばれる処理
    ev.onmessage = async (e) => {
      const data = JSON.parse(e.data); // 届いた文字列を JSON として解釈
      if (data.type === "lead") {
        // リード1件を取得して追加（逐次表示）
        const r = await fetch(`/api/leads?jobId=${jid}`).catch(() => null); // 途中の取得失敗でも落ちないように
        if (r) { const { leads: fresh } = await r.json(); setLeads(fresh); }
      } else if (data.type === "completed") {
        // 検索が完了したとき。payload.status が "partial" なら「一部完了（残高不足等で中断）」を明示する。
        finished = true;
        const partial = data.payload?.status === "partial";
        pushProgress(data.message, partial ? "info" : "ok");
        if (partial) pushProgress("※ 残高不足などのため、一部の取得で終了しました（未完）", "info");
        const r = await fetch(`/api/leads?jobId=${jid}`).catch(() => null);
        if (r) { const { leads: fresh } = await r.json(); setLeads(fresh); }
        setPhase("done"); // 表示上は完了（部分完了はログで明示）
        router.refresh(); // サーバー描画のヘッダー残高（クレジット）を最新化
      } else if (data.type === "failed") {
        // ★検索が失敗したとき：エラーを表示し、状態を戻す（＝無限にスピナーが回るのを防ぐ）
        finished = true;
        pushProgress(`エラー：${data.message}`, "info");
        setPhase(plan ? "plan_ready" : "idle"); // 再実行できる状態に戻す
        router.refresh();
      } else {
        // それ以外は途中経過のお知らせとしてログに追加
        pushProgress(data.message, "info");
      }
    };
    // サーバーから「終了」の合図が来たら接続を閉じる（クリーンアップ = 後始末）
    ev.addEventListener("end", () => { finished = true; ev.close(); });
    // ★通信エラー時：正常終了していない＝途中で切れた場合は、エラー表示して状態を戻す
    //   （これをしないと画面が「実行中…」のまま永久にスピナーが回り続ける）
    ev.onerror = () => {
      ev.close();
      if (!finished) {
        pushProgress("通信が途切れました。もう一度お試しください。", "info");
        setPhase((p) => (p === "running" ? (plan ? "plan_ready" : "idle") : p));
      }
    };
  }, [plan, router]);

  // 「除外」されていないリードだけを表示対象として絞り込む
  const activeLeads = leads.filter((l) => l.status !== "excluded");

  // リードの状態（お気に入り/新規/除外など）を切り替え、その変更をサーバーにも保存する関数
  const toggleStatus = async (lead: Lead, status: Lead["status"]) => {
    const prev = lead.status; // 失敗したとき元に戻すために、変更前の状態を覚えておく
    // まず画面上のリストをすぐに更新（該当リードの状態だけ差し替え）して、操作をすぐ反映
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    // 続いてサーバーにも変更を保存する（PATCH = 一部だけ更新する通信）
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, status }),
      });
      // ★保存に失敗したら、画面を元の状態へ戻す（見た目と実データのズレを防ぐ）
      if (!res.ok) throw new Error("failed");
    } catch {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
    }
  };

  // 現在表示しているリードをひとつのリストとして保存する関数
  const saveList = async () => {
    // 保存名を「業種 · 今日の日付」の形で自動生成（industry が無ければ「リード」）
    const name = `${plan?.icp.industry ?? "リード"} · ${new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
    // サーバーの /api/lists に、名前と対象リードのID一覧を送って保存する
    await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, leadIds: activeLeads.map((l) => l.id) }),
    });
    setSaved(true); // ボタンを「保存済み」表示に切り替える
  };

  // ここからが実際に画面へ表示する見た目（JSX）です。左が入力チャット、右が結果一覧の2カラム構成。
  return (
    // スマホ(既定)：縦積み。上=結果一覧、下=チャット＋入力欄（＝入力が画面下＝フッターの直上に来る）。
    // PC(md以上)：左右2カラム(左=チャット360px＋右=結果)。
    <div className="flex h-full flex-col md:grid md:grid-cols-[360px_1fr]">
      {/* Chat pane（PCでは左側／スマホでは下側：チャット＋入力ペイン） */}
      {/* order でスマホ時だけ下に回す。スマホは上線(border-t)で区切り＋高さ45vhに制限、PCは右線(border-r) */}
      <div className="order-2 flex max-h-[45vh] min-h-0 flex-col border-t border-line bg-cream-100/30 md:order-none md:max-h-none md:border-t-0 md:border-r">
        <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
          {/* 待機状態のときだけ、案内文と入力例のボタンを表示 */}
          {phase === "idle" && (
            <div className="pt-6">
              <h2 className="font-serif-display text-2xl text-ink">何をお探しですか？</h2>
              <p className="mt-2 text-sm text-ink-soft">
                理想の顧客像を自然な言葉で入力してください。GTM の AI が検索プランを作ります。
              </p>
              <div className="mt-5 space-y-2">
                {/* 入力例を一覧で並べ、押すとその文でそのまま検索を開始する */}
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

          {/* 送信済みのユーザーの指示文を、右寄せの吹き出しとして表示 */}
          {userPrompt && (
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-paper px-3.5 py-2.5 text-sm text-ink shadow-sm">
              {userPrompt}
            </div>
          )}

          {/* プラン作成中はゆっくり点滅する案内を表示 */}
          {phase === "planning" && (
            <div className="text-sm text-muted animate-pulse-soft">検索プランを作成中…</div>
          )}

          {/* プランが出来たら、その内容カードと「実行」ボタンを表示（実行中は running=true） */}
          {plan && (phase === "plan_ready" || phase === "running" || phase === "done") && (
            <PlanCard plan={plan} onRun={runPlan} running={phase !== "plan_ready"} />
          )}

          {/* 進行状況ログが1件以上あれば、まとめて表示 */}
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

        {/* input（画面下部の文字入力欄）。ChatGPTスマホ版のような丸い入力欄＋右下の丸い送信ボタン */}
        <div className="border-t border-line bg-cream/60 p-3">
          <div className="flex items-end gap-2 rounded-3xl border border-line-strong bg-paper py-2 pl-4 pr-2 shadow-sm">
            {/* 文字入力欄。value=今の入力内容、onChange=打つたびに state を更新 */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // ★日本語入力（IME）で変換を確定するための Enter は送信に使わない。
                //   isComposing = ローマ字→かな漢字の「変換中」フラグ。keyCode 229 も変換中を表す保険。
                //   これを見ないと「で」などの変換確定 Enter で途中送信されてしまう（不具合の原因）。
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                // Enter キー（Shift無し・かつ変換中でない）で送信、Shift+Enter は改行にする
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitPrompt(input);
                }
              }}
              rows={1}
              placeholder={phase === "idle" ? "理想の顧客像を入力…" : "フォローアップを入力…"}
              className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[15px] outline-none"
            />
            {/* 送信ボタン。右下に置く丸いボタン（ChatGPT風）。空欄のときは薄いグレーで押せない。 */}
            <button
              onClick={() => submitPrompt(input)}
              disabled={!input.trim()}
              aria-label="送信"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors disabled:bg-line disabled:text-muted"
            >
              {/* 上向き矢印アイコン（ChatGPTの送信ボタンに合わせた形） */}
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M12 4l-7 7 1.4 1.4L11 8.8V20h2V8.8l4.6 4.6L19 11z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Results pane（PCでは右側／スマホでは上側：検索結果の一覧ペイン） */}
      {/* order-1 でスマホ時は上に表示し、残りの高さいっぱい(flex-1)に広げる */}
      <div className="order-1 flex min-h-0 flex-1 flex-col bg-cream md:order-none md:flex-none">
        {/* 結果一覧の上部バー（件数・保存ボタン・CSV書き出し） */}
        <ResultsHeader
          plan={plan}
          count={activeLeads.length}
          jobId={jobId}
          onSave={saveList}
          saved={saved}
          canExport={activeLeads.length > 0}
        />
        {/* 縦だけスクロール・横は固定（overflow-x-hidden）＝横スクロールを無くす。スマホは余白も詰める */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          {/* リードが0件なら空状態の案内、1件以上あれば結果の表を表示 */}
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

      {/* リードが選択されているときだけ、右からスライドする詳細パネル（ドロワー）を表示 */}
      {selected && (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} onToggle={toggleStatus} />
      )}
    </div>
  );
}

// PlanCard: AIが作った検索プランの中身（業種・地域・見積りなど）を表示し、実行ボタンを置くカード部品
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
      {/* カードの見出しラベル */}
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-brand">検索プラン</div>
      {/* プランの各項目を「ラベル：値」の一覧で表示 */}
      <dl className="space-y-1.5 text-sm">
        <Row label="業種" value={plan.icp.industry} />
        <Row label="地域" value={plan.icp.location} />
        <Row label="市場" value={plan.icp.market} />
        {/* シグナル（購買の兆し）が指定されているときだけ表示。複数あれば「/」でつなぐ */}
        {plan.icp.signals.length > 0 && <Row label="シグナル" value={plan.icp.signals.join(" / ")} />}
        {/* どのデータ元から探すか（コネクタの名前をカンマ区切りで並べる） */}
        <Row label="検索ソース" value={plan.connectors.map((c) => c.label).join(", ")} />
        <Row label="想定件数" value={`〜${plan.estimatedLeads}件`} />
        {/* この検索でおよそ何クレジット消費する見込みか */}
        <Row label="見積り" value={`約 ${plan.estimatedCredits} クレジット`} />
      </dl>
      {/* 実行ボタン。実行中は押せなくして文言を「実行中…」に変える */}
      <button
        onClick={onRun}
        disabled={running}
        className="mt-3 w-full rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {running ? "実行中…" : `この内容で実行（最大 約${plan.estimatedCredits} クレジット消費）`}
      </button>
    </div>
  );
}

// Row: 「ラベル：値」の1行を表示する小さな部品（プランカードの各項目に使う）
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// ResultsHeader: 結果一覧の上部バー。プラン名と件数を左に、保存ボタンとCSV書き出しを右に表示する
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
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-3 sm:px-5">
      {/* 左側：プランがあれば「地域 · 業種」、無ければ「リード」。下に件数 */}
      {/* min-w-0＋truncate＝長い見出しでも横に広がらず「…」で省略（横あふれ防止） */}
      <div className="min-w-0">
        <div className="truncate font-serif-display text-base text-ink">
          {plan ? `${plan.icp.location} · ${plan.icp.industry}` : "リード"}
        </div>
        <div className="text-xs text-muted">{count} 件</div>
      </div>
      {/* 右側：保存ボタンとCSV書き出しボタン（shrink-0＝縮まない。左の見出しが代わりに省略される） */}
      <div className="flex shrink-0 items-center gap-2">
        {/* リストに保存ボタン。書き出せる件数が無ければ押せない。保存後は「保存済み ✓」に */}
        <button
          onClick={onSave}
          disabled={!canExport}
          className="rounded-full border border-line-strong bg-paper px-3 py-1.5 text-sm text-ink disabled:opacity-40"
        >
          {saved ? "保存済み ✓" : "リストに保存"}
        </button>
        {/* CSV書き出しリンク。ジョブIDがあればその結果をダウンロード。件数0のときは押せない見た目 */}
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

// EmptyState: リードがまだ無いときの表示。実行中なら回転スピナー、そうでなければ案内文を出す
function EmptyState({ phase }: { phase: Phase }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        {/* 実行中は探索中のスピナー、それ以外は「まだリードはありません」の案内 */}
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

// ConfBadge: 信頼度スコア（0〜100）を色付きバッジで表示する部品
function ConfBadge({ score }: { score: number }) {
  // スコアに応じて3段階（高80以上 / 中50以上 / 低）に振り分ける
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

// ResultsTable: 見つかったリードを表形式で一覧表示する部品。
// 各行をクリックすると詳細パネルが開き、星ボタンでお気に入りの切り替えができる。
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
          {/* リードを1件ずつ行として並べる。i は0から始まる連番なので表示では +1 して見せる */}
          {leads.map((l, i) => (
            <tr
              key={l.id}
              onClick={() => onSelect(l)}
              // キーボード操作対応：行にフォーカスでき、Enter/Space で詳細を開ける（マウスなしでも使える）
              role="button"
              tabIndex={0}
              aria-label={`${l.companyName} の詳細を開く`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(l);
                }
              }}
              className="animate-row-in cursor-pointer border-t border-line/70 hover:bg-cream-100/40 focus:bg-cream-100/60 focus:outline-none"
            >
              {/* #列：通し番号（0始まりなので +1 して1番から見せる） */}
              <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
              {/* Fit列：適合度スコアを横バーで表示 */}
              <td className="px-3 py-2">
                <FitBar score={l.fitScore} />
              </td>
              {/* 会社列：会社アイコン＋会社名（長い社名は…で省略して横あふれを防ぐ） */}
              <td className="max-w-[200px] px-3 py-2">
                <span className="flex items-center gap-2">
                  <CompanyAvatar name={l.companyName} />
                  <span className="truncate text-ink">{l.companyName}</span>
                </span>
              </td>
              {/* 業種列（広い画面でだけ表示） */}
              <td className="hidden px-3 py-2 text-ink-soft lg:table-cell">{l.category}</td>
              {/* 従業員数列（さらに広い画面でだけ表示） */}
              <td className="hidden px-3 py-2 text-ink-soft xl:table-cell">{l.headcount}</td>
              {/* メール列：メールがあれば等幅フォントで表示、無ければ「—」 */}
              <td className="hidden px-3 py-2 text-ink-soft lg:table-cell">
                {l.email ? (
                  <span className="font-mono text-[12px]">{l.email}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              {/* 信頼度列：スコアを色付きバッジで表示 */}
              <td className="px-3 py-2">
                <ConfBadge score={l.confidence} />
              </td>
              {/* シグナル列：購買の兆し */}
              <td className="px-3 py-2 text-ink-soft">{l.buyingSignal}</td>
              <td className="px-3 py-2">
                {/* 星ボタン: 押すとお気に入り⇔通常を切り替え。行クリック（詳細表示）が同時に起きないよう stopPropagation で止める */}
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

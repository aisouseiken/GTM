// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// 「今ログインしているのは誰か（本人確認）」を調べる道具を読み込む
import { getCurrentUser } from "@/lib/auth/session";
// 指示文をもとに「検索プラン（何をどう検索するかの計画）」を組み立てる道具を読み込む
import { createPlan } from "@/lib/agent/planner";
// データ保管庫の道具を読み込む（ワークスペース取得・会話メッセージ追加・会話セッション作成／取得）
import { getWorkspace, addMessage, createSession, getSession } from "@/lib/data/store";
// 検索対象の市場（例：日本／全世界）の「初期設定値」を読み込む
import { MARKET_DEFAULT } from "@/lib/config";

/*
 * このAPI（POST /api/plan）は「検索プラン」を作るための窓口です。
 * 受け取るもの: ワークスペースID・ユーザーが入力した指示文(prompt)・（あれば）会話セッションID。
 * 返すもの: 会話セッションIDと、作成した検索プラン(plan)。
 * ※プランはまだ実行されず、あくまで「これから何を検索するか」の下書きです。
 */
export async function POST(req: Request) {
  // まずログインしている本人を取得する（あとで結果が返るので await で待つ）
  const user = await getCurrentUser();
  // ログインしていなければ「401（ログインが必要）」を返して中断する
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // リクエストの本文（送られてきたデータ）をJSONとして読み取る
  // ★中身が空だったり壊れていたりしても落ちないよう、失敗時は null 扱いにする
  const body = await req.json().catch(() => null);
  // 読み取れなかった場合は「400（リクエストが不正）」を返して中断する
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  // 本文から「どのワークスペースで」「どんな指示文で」検索プランを作るかを取り出す
  const { workspaceId, prompt } = body as { workspaceId: string; prompt: string; sessionId?: string };
  // 会話セッションID（＝会話のまとまりを表す番号）を取り出す。無い場合もあるので let で受ける
  let sessionId = body.sessionId as string | undefined;

  // 指定されたワークスペース（作業場所）を保管庫から取り出す
  const ws = getWorkspace(workspaceId);
  // ワークスペースが無い、または持ち主がログイン本人でないなら「404（見つからない扱い）」を返す
  if (!ws || ws.ownerId !== user.id)
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  // 指示文が空（未入力や空白だけ）なら「400（不正）」を返して中断する
  if (!prompt?.trim())
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  // 指示文が長すぎる（2000文字超）場合も「400」を返す（巨大な入力で処理が暴走・高コスト化するのを防ぐ）
  if (prompt.length > 2000)
    return NextResponse.json({ error: "prompt too long" }, { status: 400 });

  // ★会話セッションIDが指定されている場合は、その会話が本当にこのワークスペースのものかを確認する
  //   他人の会話に勝手にメッセージを書き込む不正を防ぐためのチェック
  if (sessionId) {
    const s = getSession(sessionId); // そのセッションを取り出す
    // 見つからない、または別のワークスペースのものなら「400（不正なセッション）」を返す
    if (!s || s.workspaceId !== workspaceId)
      return NextResponse.json({ error: "invalid session" }, { status: 400 });
  }

  // 会話セッションIDが無い場合＝これは新しい会話のスタート
  if (!sessionId) {
    // 指示文の先頭40文字をタイトルにして、新しい会話セッションを作る
    const s = createSession(workspaceId, prompt.slice(0, 40));
    // 作られたセッションのIDを、以後使うため sessionId に入れておく
    sessionId = s.id;
  }

  // ユーザーが入力した指示文を、会話履歴に「利用者の発言(role: user)」として記録する
  addMessage({ sessionId, role: "user", content: prompt, kind: "text" });
  // 指示文をもとに検索プランを作成する
  // 検索対象の市場は、ワークスペースの設定(ws.market)を使う。設定が無ければ初期設定値を使う（?? は「無ければこちら」の意味）
  const plan = createPlan(workspaceId, sessionId, prompt, ws.market ?? MARKET_DEFAULT);
  // AI側からの返事（プランを作った旨の案内）を、会話履歴に「アシスタントの発言(role: assistant)」として記録する
  addMessage({
    sessionId,
    role: "assistant",
    content: "検索プランを作成しました。内容を確認して実行してください。",
    kind: "plan", // このメッセージの種類は「プラン」であることを示す
    data: { planId: plan.id }, // どのプランに対する案内かが分かるよう、プランIDを添える
  });

  // 会話セッションIDと、作成した検索プランをまとめて返す
  return NextResponse.json({ sessionId, plan });
}

// ============================================================================
// このAPI（GET /api/export?jobId=...）は、あるジョブ（検索の実行タスク）で見つかった
// リード（見込み客＝営業のターゲット候補）を、CSVファイルとしてダウンロードさせる窓口です。
//   CSVファイル = カンマ区切りの表形式テキスト。Excelやスプレッドシートで開けます。
// 受け取るもの: ジョブID。 返すもの: ダウンロード用のCSVデータ。
// ============================================================================

// getCurrentUser = 今アクセスしている人が誰か（ログイン済みの本人）を取得する
import { getCurrentUser } from "@/lib/auth/session";
// ジョブ取得・ジョブに紐づくリード一覧取得・ワークスペース取得・監査ログ記録などの部品
import { getJob, listLeadsByJob, getWorkspace, addAudit } from "@/lib/data/store";

// CSVの1マス（セル）分を、安全な文字列に整える補助関数。
// 値の中にカンマ・改行・二重引用符が入っていると表の列がずれて崩れるため、ルールに沿って整えます。
function csvCell(v: unknown): string {
  // 中身が空(null/undefined)なら空文字に、それ以外は文字列に変換する
  let s = v == null ? "" : String(v);
  // ★数式インジェクション（表計算ソフトの悪用）対策：
  //   ExcelやGoogleスプレッドシートは、セルが = + - @ タブ 復帰 で始まると「計算式」とみなして実行してしまう。
  //   会社名や住所などの実データがそのまま計算式として動くと危険なので、先頭に ' を付けて“ただの文字”に変える。
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // カンマ・改行・二重引用符を含む場合は、全体を "" で囲み、中の " は "" に置き換えてエスケープ（無効化）する
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  // 特別な文字が無ければ、そのまま返す
  return s;
}

// 【CSV書き出し】ジョブのリードをCSVでエクスポート（書き出し）する。GET /api/export?jobId=...
export async function GET(req: Request) {
  // ログイン確認：ログインしていなければ 401（＝認証（本人確認）が必要）を返して中止
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  // URLの ?jobId=... から、どのジョブの結果を出力するかを特定する
  const jobId = new URL(req.url).searchParams.get("jobId");
  // ジョブIDが無ければ 400（＝リクエストが不正）を返す
  if (!jobId) return new Response("jobId required", { status: 400 });
  // そのIDのジョブを探す
  const job = getJob(jobId);
  // 見つからなければ 404（＝対象が存在しない）を返す
  if (!job) return new Response("not found", { status: 404 });
  // 所有者確認：そのジョブが属するワークスペースの持ち主が本人かを確認する
  const ws = getWorkspace(job.workspaceId);
  // 存在しない、または本人のものでなければ 403（＝権限が無く禁止）を返す
  if (!ws || ws.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  // このジョブのリード一覧を取得し、除外(excluded)扱いにしたものは取り除く（出力しない）
  const leads = listLeadsByJob(jobId).filter((l) => l.status !== "excluded");
  // CSVの見出し行（各列の項目名）を用意する

  const headers = [
    "会社名", "ドメイン", "メール", "電話", "所在地", "業種",
    "従業員", "資金", "シグナル", "FitScore", "信頼度", "出典",
  ];
  // 各リードを、CSVの1行分の文字列に変換する。並び順は上の見出しの順番と必ず対応させる。
  const rows = leads.map((l) =>
    [
      // 会社名・ドメイン。メールや電話は空の場合があるので ?? "" で「無ければ空文字」にする
      l.companyName, l.domain, l.email ?? "", l.phone ?? "", l.location,
      // 業種・従業員数・資金・購買シグナル（買う気配）。無い項目は空文字にする
      l.category, l.headcount ?? "", l.funding ?? "", l.buyingSignal ?? "",
      // FitScore（相性の点数）・信頼度・出典（sources のラベルを「 / 」でつないだ文字列）
      l.fitScore, l.confidence, l.sources.map((s) => s.label).join(" / "),
    ]
      .map(csvCell) // 各マスを csvCell で安全な形に整える
      .join(",")    // カンマでつないで1行の文字列にする
  );
  // 見出し行＋各データ行を改行でつないでCSV全体を完成させる。
  // 先頭の "﻿" はBOM（文字コードの目印）で、これがあるとExcelで開いたときの日本語の文字化けを防げる。
  const csv = "﻿" + [headers.join(","), ...rows].join("\n"); // BOM 付きで Excel 対応

  // 監査ログ：誰が・どのジョブの結果を・何件書き出したかを記録する
  addAudit({ actor: `user:${user.id}`, action: "export", target: job.workspaceId, meta: { jobId, count: leads.length } });

  // 出来上がったCSVを、ブラウザに「ファイルとして保存」させるための設定を付けて返す
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8", // 中身はCSV（文字コードUTF-8）だと相手に伝える
      "Content-Disposition": `attachment; filename="gtm-leads-${jobId}.csv"`, // 画面表示ではなく添付ファイルとして保存させ、ファイル名を指定
    },
  });
}

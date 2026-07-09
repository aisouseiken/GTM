import { getCurrentUser } from "@/lib/auth/session";
import { getJob, listLeadsByJob, getWorkspace } from "@/lib/data/store";

/*
 * このAPI（GET /api/export?jobId=...）は、ジョブで見つかったリード（見込み客）を
 * CSVファイル（Excelなどで開ける表形式のテキスト）としてダウンロードさせる窓口です。
 * 受け取るもの: ジョブID。返すもの: ダウンロード用のCSVデータ。
 */

// CSVの1マス分を安全な文字列に整える補助関数。
// 値の中にカンマ・改行・二重引用符が含まれると表が崩れるため、"" で囲んでエスケープする
function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // ★数式インジェクション対策：Excel/Sheetsは = + - @ タブ 復帰 で始まるセルを「数式」と解釈し実行する。
  //   実データの社名・住所などが悪用されないよう、先頭に ' を付けて“ただの文字”にする。
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ジョブのリードを CSV でエクスポート（無料）
export async function GET(req: Request) {
  // ログイン確認：未ログインなら 401（認証が必要）
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  // URLの ?jobId=... から対象ジョブを特定する
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return new Response("jobId required", { status: 400 });
  const job = getJob(jobId);
  if (!job) return new Response("not found", { status: 404 });
  // 所有者確認：そのジョブが本人のワークスペースのものかを確認する
  const ws = getWorkspace(job.workspaceId);
  if (!ws || ws.ownerId !== user.id) return new Response("forbidden", { status: 403 });

  // 除外(excluded)にしたリードを取り除いた一覧を用意する
  const leads = listLeadsByJob(jobId).filter((l) => l.status !== "excluded");
  // CSVの見出し行（各列の項目名）

  const headers = [
    "会社名", "ドメイン", "メール", "電話", "所在地", "業種",
    "従業員", "資金", "シグナル", "FitScore", "信頼度", "出典",
  ];
  // 各リードを1行分の文字列に変換する（列の順番は見出しと対応させる）
  const rows = leads.map((l) =>
    [
      l.companyName, l.domain, l.email ?? "", l.phone ?? "", l.location,
      l.category, l.headcount ?? "", l.funding ?? "", l.buyingSignal ?? "",
      l.fitScore, l.confidence, l.sources.map((s) => s.label).join(" / "),
    ]
      .map(csvCell)
      .join(",")
  );
  // 見出し行＋データ行を改行でつないで完成。先頭のBOM（文字コードの目印）でExcelの文字化けを防ぐ
  const csv = "﻿" + [headers.join(","), ...rows].join("\n"); // BOM 付きで Excel 対応

  // CSVファイルとして「ダウンロード」させるためのヘッダーを付けて返す
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8", // 中身はCSV（UTF-8）だと伝える
      "Content-Disposition": `attachment; filename="gtm-leads-${jobId}.csv"`, // 添付ファイルとして保存させる
    },
  });
}

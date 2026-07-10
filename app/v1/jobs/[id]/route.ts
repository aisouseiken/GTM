// 「応答（サーバーからの返事）」を作るための道具を読み込む
import { NextResponse } from "next/server";
// APIキー（合言葉）関連の道具を読み込む（bearerFrom＝ヘッダーから合言葉を取り出す／resolveApiKey＝その合言葉が有効か照合する）
import { bearerFrom, resolveApiKey } from "@/lib/auth/apikey";
// データ保管庫の道具を読み込む（ジョブ取得・ジョブに紐づくリード一覧取得）
import { getJob, listLeadsByJob } from "@/lib/data/store";
// 「短時間に叩かれすぎていないか（乱用防止）」を判定する道具を読み込む
import { rateLimit } from "@/lib/ratelimit";

/*
 * このAPI（GET /v1/jobs/{id}）は、外部プログラム向けに公開された「ジョブ結果の取得」窓口です。
 * 認証はAPIキー（ヘッダーの Bearer トークン＝合言葉）で行います。
 * 受け取るもの: URL内のジョブID。
 * 返すもの: ジョブの状態・件数・消費クレジット・見つかったリード一覧。
 */
// ─────────────────────────────────────────────
// GET /v1/jobs/{id}：外部プログラムがジョブの結果を受け取るための処理
//   ({ params } には、URLの {id} 部分＝ジョブIDが入ってくる)
// ─────────────────────────────────────────────
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // リクエストのヘッダーからBearerトークン（合言葉）を取り出し、それが有効なAPIキーか照合する
  const key = resolveApiKey(bearerFrom(req));
  // 有効なキーでなければ「401（合言葉が正しくない）」を返して中断する
  if (!key) return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  // 同じAPIキーからの呼び出しは「1分（＝60000ミリ秒）あたり60回まで」に制限する
  // 上限を超えたら「429（回数オーバー）」を返す（大量に情報を吸い出す行為を抑える）
  if (!rateLimit(`v1jobs:${key.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  // URLの一部として渡されたジョブIDを取り出す（あとで結果が返るので await で待つ）
  const { id } = await params;
  // そのIDのジョブを保管庫から取り出す
  const job = getJob(id);
  // ジョブが無い、またはこのAPIキーとは別のワークスペースのものなら「404（見つからない）」を返す
  // （他人のジョブ結果を覗けないようにする）
  if (!job || job.workspaceId !== key.workspaceId)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  // このジョブに紐づくリード一覧を取り出し、社内用の項目名を「外部に公開しても分かりやすい名前」に付け替える
  // （.map(...) ＝ 一件ずつ順番に、下の形に作り直すという意味）
  const leads = listLeadsByJob(id).map((l) => ({
    company: l.companyName, // 会社名
    domain: l.domain, // ホームページ等のドメイン（例：example.com）
    email: l.email, // メールアドレス
    phone: l.phone, // 電話番号
    location: l.location, // 所在地
    industry: l.category, // 業種
    headcount: l.headcount, // 従業員数
    funding: l.funding, // 資金調達の状況
    buying_signal: l.buyingSignal, // 購買シグナル（買いそうな兆し）
    fit_score: l.fitScore, // フィットスコア（自社にどれだけ合うかの点数）
    confidence: l.confidence, // 情報の確からしさ（信頼度）
    // 情報の出どころ（ソース）も、表示名(label)とURLだけに絞って付ける
    sources: l.sources.map((s) => ({ label: s.label, url: s.url })),
  }));

  // ジョブの概要と、整えたリード一覧をまとめて返す（外部プログラム向けの分かりやすいキー名で）
  return NextResponse.json({
    job_id: job.id, // ジョブの識別番号
    status: job.status, // ジョブの状態（完了・一部完了・失敗 など）
    result_count: job.resultCount, // 見つかった件数
    credits_spent: job.creditsSpent, // このジョブで使ったクレジット（利用ポイント）数
    leads, // 上で整えたリード一覧
  });
}

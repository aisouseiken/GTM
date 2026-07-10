// 名寄せ（エンティティ・レゾリューション）＝重複した候補を1社にまとめる処理。
//
// このファイルの役割：
//   複数のコネクタが返した「候補」には、同じ会社がダブって含まれる。
//   それらを1社に統合し、各項目は“最も良い値”を採用、出典は全部まとめて残す。
//   ＝「リスト元の最適化」。取りこぼしを減らしつつ、重複を除いてキレイな1件にする。

import { id } from "@/lib/data/store";
import type { Lead, LeadSource } from "@/lib/domain/types";
import type { LeadCandidate } from "@/lib/connectors/types";

// ---- 正規化（表記ゆれを吸収して同一判定しやすくする）----
// ドメインを小文字化し www. や先頭のプロトコルを除去
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase() // 大文字小文字の違いをなくす（Example.com → example.com）
    .replace(/^https?:\/\//, "") // 先頭の http:// や https:// を取り除く
    .replace(/^www\./, "") // 先頭の www. を取り除く
    .replace(/\/.*$/, "") // 最初の「/」以降（ページのパス）を切り落とす
    .trim(); // 前後の余分な空白を除く
}
// 電話番号は数字だけにして比較（ハイフンや+の違いを吸収）
export function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined; // 電話番号が無ければ「なし」を返す
  const digits = phone.replace(/[^0-9]/g, ""); // 数字以外（ハイフン・かっこ・+など）を全部取り除く
  return digits.length >= 8 ? digits : undefined; // 8桁以上あれば有効な番号とみなす。短すぎれば「なし」
}

// 候補の集合を、同一ドメインごとに1社へ統合する。
export function resolveCandidates(
  candidates: LeadCandidate[],
  workspaceId: string,
  jobId: string
): Lead[] {
  // ドメイン（会社のウェブサイトのアドレス）を揃えたものをキーにして、同じ会社どうしをグループ化する
  const groups = new Map<string, LeadCandidate[]>();
  for (const c of candidates) {
    const key = normalizeDomain(c.domain); // 表記ゆれを吸収した「揃えたドメイン」を作る
    const arr = groups.get(key) ?? []; // すでに同じ会社のグループがあれば取り出し、無ければ空の配列
    arr.push(c); // その会社のグループに今の候補を追加
    groups.set(key, arr); // 更新したグループを入れ直す
  }

  const leads: Lead[] = []; // 統合後のリード（1社1件）をためる箱
  for (const [, group] of groups) {
    // 同じ会社の候補たちを、fitScore（適合度＝どれだけ条件に合うか）の高い順に並べ替える
    group.sort((a, b) => b.fitScore - a.fitScore);
    const primary = group[0]; // 一番適合度の高い候補を「主（土台）」として採用

    // 各項目は「最初に見つかった空でない値」を採用（＝最良値の採用）
    // getter＝候補から特定の項目を取り出す小さな関数。それを使ってグループ内を順に探す。
    const firstDefined = <T>(getter: (c: LeadCandidate) => T | undefined): T | undefined => {
      for (const c of group) { // グループ内を（適合度の高い順に）1件ずつ確認
        const v = getter(c); // その候補から目的の項目を取り出す
        if (v !== undefined && v !== "" && v !== null) return v; // 中身が空でなければ、それを採用して返す
      }
      return undefined; // どの候補にも値が無ければ「なし」
    };

    // 出典（どのデータ取得先から来たか）は全コネクタ分をまとめる（同じコネクタは1つに）
    const sources: LeadSource[] = []; // まとめた出典の一覧
    const seenSrc = new Set<string>(); // すでに登録済みのコネクタIDを覚えておく（重複防止）
    for (const c of group) {
      if (!seenSrc.has(c.source.connectorId)) { // まだ登録していない出典なら
        seenSrc.add(c.source.connectorId); // 登録済みとして記録し
        sources.push(c.source); // 出典一覧に追加する
      }
    }

    // シグナルは全候補の和集合（重複除去）＝どの候補で見つかったシグナルも取りこぼさず1つにまとめる
    const signalSet = new Set<string>(); // Set は自動で重複を除いてくれる入れ物
    group.forEach((c) => c.signals.forEach((s) => signalSet.add(s))); // 各候補の各シグナルを全部入れる

    // enrichment（補強情報＝補って充実させた追加データ）は全候補をマージ（統合）する
    const enrichment: Record<string, string> = {}; // 統合先の空の入れ物
    group.forEach((c) => Object.assign(enrichment, c.enrichment)); // 各候補の補強情報を上書き合成していく

    // 統合結果を1社1件のリードとして組み立て、一覧に追加する
    leads.push({
      id: id("lead"), // このリードを識別する新しいID
      workspaceId, // 所有する利用者（ワークスペース）
      jobId, // どのジョブ（実行）で作られたか
      companyName: primary.companyName, // 会社名は主候補のものを採用
      domain: normalizeDomain(primary.domain), // ドメインは表記を揃えて保存
      email: firstDefined((c) => c.email), // メールは最初に見つかった有効な値
      phone: firstDefined((c) => c.phone), // 電話も最初に見つかった有効な値
      address: firstDefined((c) => c.address), // 住所も同様に最良値を採用
      location: primary.location, // 地域は主候補のもの
      industry: primary.industry, // 業種は主候補のもの
      category: primary.category, // カテゴリは主候補のもの
      size: firstDefined((c) => c.size), // 企業規模は最初に見つかった値
      headcount: firstDefined((c) => c.headcount), // 従業員数は最初に見つかった値
      funding: firstDefined((c) => c.funding), // 資金調達情報は最初に見つかった値
      signals: [...signalSet], // まとめたシグナル一覧（Setを配列に戻す）
      buyingSignal: firstDefined((c) => c.buyingSignal), // 買い手シグナルは最初に見つかった値
      enrichment, // 統合した補強情報
      // 複数ソースで裏取りできた会社は少しだけ加点（最大+4）＝出典が多いほど確度UP
      // 主候補の適合度に「出典の数-1（最大4まで）」を足し、上限99で頭打ちにする
      fitScore: Math.min(99, primary.fitScore + Math.min(4, sources.length - 1)),
      confidence: 0, // 総合信頼度は検証後に確定するので、いったん0
      verifications: [], // 検証結果もこの時点では空
      sources, // まとめた出典一覧
      status: "new", // 状態は「新規」
      fetchedAt: Math.max(...group.map((c) => c.fetchedAt)), // 取得時刻はグループ内で最も新しいものを採用
      createdAt: Date.now(), // 作成時刻（今）
    });
  }

  // 最後に、適合度（fitScore）の高い順に並べて返す
  return leads.sort((a, b) => b.fitScore - a.fitScore);
}

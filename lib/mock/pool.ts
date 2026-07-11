// モックの「企業プール」生成器。
//
// このファイルの役割：
//   検索プランに対して、決定的（同じ条件なら毎回同じ）に“真の企業一覧”を作ります。
//   各コネクタは、このプールから自分が見つけられる企業だけを部分的に返します。
//   → 複数コネクタで重複が生まれ、後段の「名寄せ（統合）」の効果が分かるようになります。
//   実データ源に差し替える前の代役（MOCK）です。

// 構造化ICP（整理された理想の顧客像）の「データの形（型）」を借りる。
import type { StructuredICP } from "@/lib/domain/types";

// プール内の1企業（“真の”フル情報）。
export interface PoolCompany {
  idx: number; // プール内での通し番号
  companyName: string; // 会社名
  domain: string; // ドメイン（会社の目印）
  city: string; // 所在地（市区名）
  headcount: number; // 従業員数
  size: string; // 企業規模の目安（例: "20-100"）
  email: string; // メールアドレス
  phone: string; // 電話番号
  funding: string; // 資金調達状況
  buyingSignal: string; // 買い手シグナル（購入意欲のサイン）
  techStack: string; // 使っている技術・ツール
  fitScore: number; // ICP適合スコア（理想顧客像との合い具合）
}

// ---- 決定的乱数（seed から。毎回同じ結果にするため Math.random は使わない）----
// 決定的乱数＝見た目はバラバラだが、同じ種(seed)を与えれば毎回同じ並びになる“再現できる乱数”。
// 文字列から「種」となる数値を作る（同じ文字列なら必ず同じ数値になる）。
function seedFrom(str: string): number {
  let h = 2166136261; // 計算の出発点となる決まった数
  for (let i = 0; i < str.length; i++) { // 文字を1つずつ取り込んで数値をかき混ぜる
    h ^= str.charCodeAt(i); // 文字コードを混ぜ込む
    h = Math.imul(h, 16777619); // 決まった数を掛けてさらにかき混ぜる
  }
  return h >>> 0; // 結果を0以上の整数にそろえて返す
}
// 種(a)を渡すと、呼ぶたびに0〜1の乱数を返す関数を作る（同じ種なら同じ並びになる）。
function mulberry32(a: number) {
  return function () { // この内側の関数を繰り返し呼ぶと次々に乱数が出る
    a |= 0; // 内部状態を整数に整える
    a = (a + 0x6d2b79f5) | 0; // 状態を一定量進める
    let t = Math.imul(a ^ (a >>> 15), 1 | a); // ビットをかき混ぜて予測しづらくする（以下同様）
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 最終的に0〜1の小数にして返す
  };
}
// 乱数(rng)を使って、配列(arr)の中から1つを選んで返す。
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]; // 0〜要素数の範囲でどれか1つを指す
}

// 以下は、それらしい会社名や都市名を組み立てるための「単語の部品リスト」（日本向け・海外向け）。
const JP_PREFIX = ["株式会社", "有限会社", "合同会社", "", "", ""]; // 日本の会社名の頭（空文字は付けない場合）
// 日本の会社名の中心となる言葉（同名重複を減らすため語数を増やしてある）。ローマ字はドメイン生成に使う。
const JP_CORE: [string, string][] = [
  ["サンライズ", "sunrise"], ["みらい", "mirai"], ["つなぐ", "tsunagu"], ["青葉", "aoba"], ["大和", "yamato"],
  ["こだま", "kodama"], ["光和", "kowa"], ["アオゾラ", "aozora"], ["ヒカリ", "hikari"], ["結", "yui"],
  ["山本", "yamamoto"], ["田中", "tanaka"], ["さくら", "sakura"], ["宮本", "miyamoto"], ["北斗", "hokuto"],
  ["陽和", "yowa"], ["翔", "sho"], ["しらかば", "shirakaba"], ["森本", "morimoto"], ["松風", "matsukaze"],
  ["福田", "fukuda"], ["東洋", "toyo"], ["三光", "sanko"], ["中央", "chuo"], ["富士", "fuji"],
  ["朝日", "asahi"], ["緑川", "midorikawa"], ["白樺", "shirakaba2"], ["大川", "okawa"], ["星野", "hoshino"],
  ["清水", "shimizu"], ["長谷川", "hasegawa"], ["新井", "arai"], ["加藤", "kato"], ["斉藤", "saito"],
];
const JP_SUFFIX = ["工業", "商事", "製作所", "システムズ", "クリニック", "歯科", "デンタル", "建設", "サービス", "テック", "メディカル", "興業", "物流", "食品"]; // 日本の会社名の末尾（業種）
const JP_CITY = ["東京都渋谷区", "東京都新宿区", "大阪市北区", "名古屋市中区", "福岡市博多区", "横浜市西区", "札幌市中央区", "京都市下京区", "神戸市中央区", "仙台市青葉区"]; // 日本の所在地の候補
const GLOBAL_CORE = ["Northwind", "Brightline", "Cedar", "Vertex", "Harbor", "Lumen", "Quill", "Summit", "Meridian", "Atlas", "Ironwood", "Beacon", "Copper", "Delta", "Everest", "Foundry", "Granite", "Halcyon", "Juniper", "Kestrel", "Aspen", "Birch", "Cobalt", "Dawn", "Ember", "Frost", "Gale", "Haven", "Indigo", "Jade", "Larkspur", "Onyx", "Pine", "Rowan", "Slate"]; // 海外の会社名の中心となる言葉
const GLOBAL_SUFFIX = ["Labs", "Health", "Systems", "Dental", "Group", "Works", "Tech", "Digital", "Partners", "HVAC", "Clinic", "Logistics", "Foods", "Solutions"]; // 海外の会社名の末尾（業種）
const GLOBAL_CITY = ["Austin, TX", "Miami, FL", "Denver, CO", "Seattle, WA", "Chicago, IL", "Boston, MA", "Atlanta, GA", "Phoenix, AZ", "Portland, OR", "Nashville, TN"]; // 海外の所在地の候補
// 資金調達状況：市場ごとに通貨を分ける（日本は円、海外はドル）。
const FUNDING_JP = ["—", "Seed", "シリーズA 5億円", "シリーズB 30億円", "Bootstrapped", "シリーズC 80億円", "—"];
const FUNDING_GLOBAL = ["—", "Seed", "Series A $8M", "Series B $30M", "Bootstrapped", "Series C $80M", "—"];

// 主要都市の市外局番（実在する番号にするため所在地から引く）。見つからなければ東京(03)。
const AREA_CODES: [string, string][] = [
  ["東京", "03"], ["大阪", "06"], ["名古屋", "052"], ["横浜", "045"], ["札幌", "011"],
  ["福岡", "092"], ["京都", "075"], ["神戸", "078"], ["仙台", "022"], ["池袋", "03"],
];
function areaCodeFor(city: string): string {
  for (const [k, v] of AREA_CODES) if (city.includes(k)) return v; // 所在地に含まれる都市名から市外局番を決める
  return "03"; // 不明なら東京
}

// 会社名の「末尾（業種を表す語）」の候補を、検索された業種から作る。
// ★これまでは業種を無視した固定リスト（工業・食品など）だったため、「美容室」を探しても
//   「〇〇クリニック」等が出ていた。ここで業種ラベル・キーワードを末尾に使い、名前を業種に合わせる。
function suffixPoolFor(icp: StructuredICP, jp: boolean): string[] {
  // 業種ラベルと、その言い換えキーワードを末尾候補にする（例: 美容室 → 「美容室」「ヘアサロン」「美容院」）。
  let fromIndustry = [icp.industry, ...icp.industryKeywords]
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 8 && s !== "企業全般"); // 長すぎる語・汎用ラベルは除外
  // ★海外市場では、日本語の業種語（例「矯正歯科」）を英語社名に混ぜない。ASCIIの語だけ採用する。
  //   （英語コア＋日本語末尾の「Summit 矯正歯科」のような不自然な社名を防ぐ）
  if (!jp) fromIndustry = fromIndustry.filter((s) => /^[\x20-\x7e]+$/.test(s));
  // 業種がはっきりしている（2種類以上の末尾語が作れる）ならそれを使う。
  if (fromIndustry.length >= 2) return fromIndustry;
  // 業種を絞れないとき（「企業全般」等）は従来の汎用リストにフォールバックする。
  return jp ? JP_SUFFIX : GLOBAL_SUFFIX;
}

// 会社名から、それらしいドメインを作る（例: sunrise-1a2b.example.jp）。
// ★ドメインを「番号(i)」ではなく「社名」から決めることで、(1)社名と対応が取れ、
//   (2)同じ社名は同じドメイン＝名寄せで1社に統合され、リストに同名が大量に並ぶ不具合を防ぐ。
// slug: 社名のローマ字化ヒント（日本語社名は英数字が無いのでコアのローマ字を渡す）。
function domainFrom(name: string, slug: string): string {
  const ascii = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 14); // 英字社名（海外）はそのまま使う
  const base = ascii.length >= 3 ? ascii : (slug || "gtm"); // 日本語社名はローマ字ヒント(slug)を土台にする
  const tag = (seedFrom(name) % 46656).toString(36); // 社名から決まる短い識別子（同名なら必ず同じ＝統合される）
  return `${base}-${tag}.example.jp`; // 土台＋社名由来タグ＋テスト用ドメイン
}

// この企業の代表的な「買い手シグナル（購入意欲のサイン）」を1つ組み立てる。
function buyingSignalFor(icp: StructuredICP, rng: () => number): string {
  const jp = icp.market === "JP"; // 日本市場かどうか
  const pool = icp.signals.length // 検索条件でシグナルが指定されていればそれを使う
    ? icp.signals
    : jp // 指定が無ければ、市場に応じた既定のシグナル候補を使う
      ? ["採用強化中", "新規開業", "広告出稿中"]
      : ["Hiring SDRs", "Recently funded", "Running ads"];
  const s = pick(rng, pool); // 候補から1つ選ぶ
  const extra = jp ? ["（今月）", "（3名募集）", "（拠点拡大）", ""] : [" (this month)", " (3 roles)", " (new location)", ""]; // 補足の言い回し候補
  return `${s}${pick(rng, extra)}`; // シグナル＋補足を組み合わせて返す
}

// 所在地を決める。検索で具体的な地域が指定されていれば、その地域の企業を返す。
// ★以前は地域を無視して全国の都市からランダムに選んでいたため、「東京」で探しても
//   仙台・福岡等が混ざっていた（クライアント指摘のイレギュラー）。ここで地域を反映する。
function cityFor(icp: StructuredICP, jp: boolean, rng: () => number): string {
  const loc = (icp.location || "").trim();
  // 「日本全国」「全国」「United States」等の広域・未指定は、全国の都市からばらつかせる。
  const generic = !loc || /全国|全域|全地域|^日本$|日本全国|nationwide|united states|global/i.test(loc);
  if (jp && !generic) return loc; // 具体地域（東京・大阪・池袋など）ならその地域を所在地にする
  return jp ? pick(rng, JP_CITY) : pick(rng, GLOBAL_CITY); // 広域・未指定は従来どおり全国から選ぶ
}

// 検索プランに対する“真の企業プール”を決定的に生成する。
export function generateCompanyPool(icp: StructuredICP, planId: string, size: number): PoolCompany[] {
  const jp = icp.market === "JP"; // 日本市場かどうか
  // プランID・業種・地域・件数を混ぜて「種」を作り、そこから乱数を用意する（同条件なら毎回同じ企業一覧になる）。
  const rng = mulberry32(seedFrom(planId + icp.industry + icp.location + size));
  const suffixPool = suffixPoolFor(icp, jp); // 業種に合わせた「会社名の末尾」候補（例: 美容室・ヘアサロン）
  const out: PoolCompany[] = []; // 生成した企業を貯める入れ物
  for (let i = 0; i < size; i++) { // 指定件数(size)だけ企業を作る
    const jpCore = pick(rng, JP_CORE); // [語, ローマ字] の組（日本の会社名の中心）
    const name = jp // 会社名を組み立てる（日本は頭＋中心＋業種末尾、海外は中心＋業種末尾）
      ? `${pick(rng, JP_PREFIX)}${jpCore[0]}${pick(rng, suffixPool)}`
      : `${pick(rng, GLOBAL_CORE)} ${pick(rng, suffixPool)}`;
    const domain = domainFrom(name, jpCore[1]); // 会社名からドメインを作る（ローマ字ヒント付き）
    const city = cityFor(icp, jp, rng); // 所在地を決める（検索地域が具体的ならその地域にそろえる）
    const headcount = 5 + Math.floor(rng() * 480); // 従業員数を5〜484人の範囲でランダムに
    const base = 98 - Math.floor((i / Math.max(size, 1)) * 42); // 上位ほど高いスコアの土台（先頭が高く、後ろほど下がる）
    const fitScore = Math.max(52, Math.min(99, base + Math.floor(rng() * 6 - 3))); // 少しの揺らぎを足し、52〜99の範囲に収める
    const emailUser = jp ? "info" : pick(rng, ["hello", "info", "sales", "contact"]); // メールの@より前の部分
    const phone = jp // 電話番号を市場に応じた形式で作る
      ? `${areaCodeFor(city)}-${1000 + Math.floor(rng() * 8999)}-${1000 + Math.floor(rng() * 8999)}` // 日本形式（所在地の実在市外局番、例: 03-1234-5678）
      : `+1 ${200 + Math.floor(rng() * 799)}-${100 + Math.floor(rng() * 899)}-${1000 + Math.floor(rng() * 8999)}`; // 北米形式（例: +1 234-567-8901）
    out.push({ // 1社分の情報をまとめて追加する
      idx: i, // 通し番号
      companyName: name,
      domain,
      city,
      headcount,
      size: headcount < 20 ? "1-20" : headcount < 100 ? "20-100" : "100-500", // 従業員数から規模帯を決める
      email: `${emailUser}@${domain}`, // メールアドレス（ユーザー名＠ドメイン）
      phone,
      funding: pick(rng, jp ? FUNDING_JP : FUNDING_GLOBAL), // 資金調達状況（市場に合った通貨で選ぶ）
      buyingSignal: buyingSignalFor(icp, rng), // 買い手シグナルを作る
      techStack: jp ? pick(rng, ["予約システム", "ECカート", "MAツール", "—"]) : pick(rng, ["Shopify", "HubSpot", "Segment", "—"]), // 使っている技術を選ぶ
      fitScore,
    });
  }
  return out.sort((a, b) => b.fitScore - a.fitScore); // 適合スコアの高い順に並べて返す
}

// 会社名やドメインから安定した0..1の値を作る（コネクタごとの担当割り振りに使う）
// 「安定した」＝同じ文字列なら毎回同じ値になる、という意味。
export function stableFraction(key: string): number {
  return seedFrom(key) / 4294967296; // 種となる数値を最大値で割って0〜1の範囲にそろえる
}

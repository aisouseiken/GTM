// 自社サイト巡回でメール・電話を補完する簡易クローラ（PoC＝お試し実装）。
//
// このファイルの役割：
//   企業の「自社サイト」を1ページ取得し、公開されているメールアドレス・電話番号を抜き出します。
//   ＝規約で守られたプラットフォーム（Google/LinkedIn等）を抜くのではなく、
//     企業が自分で公開しているページから公開連絡先を拾う、正当性を主張しやすいやり方です。
//
//   ・環境変数 CRAWL_ENABLED=true のときだけ有効（既定は無効＝デモに影響しない）。
//   ・偽ドメイン(example.com等)やアクセス不可・抽出できない場合は null を返して安全に無視。
//   ・SSRF（サーバーに内部アドレスを踏ませる攻撃）対策として、内部・プライベートアドレスは拒否。
//   ・巡回はサイトに負荷をかけないよう、1社1ページ・タイムアウト・サイズ上限を設ける。

// クロール機能が有効か（環境変数で切り替え）。
export function crawlEnabled(): boolean {
  return process.env.CRAWL_ENABLED === "true";
}

// 巡回して良いURLか（SSRF対策）。http/https のみ、内部・プライベート宛ては拒否。
function isCrawlableUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null; // URLとして壊れている
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null; // http/https以外は不可
  const host = u.hostname.toLowerCase();
  // IPv6リテラル（[::1] や [::ffff:127.0.0.1] 等）は内部到達の恐れがあるため一律拒否。
  //   実在の企業サイトはドメイン名でアクセスするため、IPv6直書きを弾いても実害は無い。
  if (host.includes(":")) return null;
  // クラウドのメタデータ名や社内DNS名（内部IPに解決されがち）を拒否。
  if (host === "metadata" || host === "metadata.google.internal" || host.endsWith(".internal")) {
    return null;
  }
  // localhost や社内・プライベートIP(v4)宛ては拒否（内部システムを踏ませない）
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    /^127\./.test(host) || // ループバック
    /^10\./.test(host) || // プライベートA
    /^192\.168\./.test(host) || // プライベートC
    /^169\.254\./.test(host) || // リンクローカル（クラウドメタデータ 169.254.169.254 を含む）
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) // プライベートB
  ) {
    return null;
  }
  return u;
}

// 偽ドメイン（モックのテスト用）かどうか。これらは巡回しない。
function isFakeDomain(domain: string): boolean {
  return /example\.(com|jp|org|net)$/i.test(domain) || domain.startsWith("houjin-");
}

// メール抽出：mailto: を優先し、無ければ本文からメールらしき文字列を探す。
function extractEmail(html: string): string | undefined {
  const mailto = html.match(/mailto:([^"'?>\s]+@[^"'?>\s]+)/i);
  if (mailto) return mailto[1];
  const m = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  // 画像・CSS等に紛れる拡張子っぽい誤検出を避ける簡易チェック
  if (m && !/\.(png|jpg|jpeg|gif|svg|css|js|webp)$/i.test(m[0])) return m[0];
  return undefined;
}

// 電話抽出：tel: を優先し、無ければ日本の電話番号らしいパターンを探す。
// ★末尾を必ず4桁に限定して誤検出（00-00-000 のような桁不足）を弾く。市外局番0始まり・区切りハイフン。
function extractPhone(html: string): string | undefined {
  const tel = html.match(/tel:(0\d{1,3}[-\s]?\d{2,4}[-\s]?\d{4})/i);
  if (tel) return tel[1].replace(/\s/g, "");
  const m = html.match(/0\d{1,3}-\d{2,4}-\d{4}(?!\d)/); // 例: 03-1234-5678 / 06-123-4567
  return m?.[0];
}

// 指定ドメインの自社サイトを1ページ取得し、公開メール・電話を返す。取得不可なら null。
export async function crawlContact(
  domain: string
): Promise<{ email?: string; phone?: string } | null> {
  if (!domain || isFakeDomain(domain)) return null; // 偽ドメインはスキップ
  const url = isCrawlableUrl(domain.startsWith("http") ? domain : `https://${domain}`);
  if (!url) return null; // 巡回不可なURL（内部宛て等）はスキップ

  try {
    // ★リダイレクトは自動追跡せず手動で追う（redirect: "manual"）。各転送先を isCrawlableUrl で
    //   再検証することで、「公開サイト → 302 → 内部アドレス」というSSRF回避の抜け道を塞ぐ。
    let current = url.toString();
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(current, {
        headers: { "User-Agent": "GTM-bot/0.1 (contact discovery)" },
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      });
      // 3xx（リダイレクト）なら転送先を取り出し、内部宛てでないか検証してから追う。
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null; // 転送先不明なら中止
        const next = isCrawlableUrl(new URL(loc, current).toString()); // 相対URL解決＋再検証
        if (!next) return null; // 転送先が内部/プライベート等なら中止
        current = next.toString();
        continue;
      }
      break; // 3xx以外＝最終応答
    }
    if (!res || !res.ok) return null; // エラー応答は無視
    // 巨大ページ対策：先頭300KBだけ読む（連絡先はたいてい上部やフッターにある）。
    const html = (await res.text()).slice(0, 300_000);
    const email = extractEmail(html);
    const phone = extractPhone(html);
    const out: { email?: string; phone?: string } = {};
    if (email) out.email = email;
    if (phone) out.phone = phone;
    return out.email || out.phone ? out : null; // 何も取れなければ null
  } catch {
    return null; // 通信エラー・タイムアウト等は無視（安全にフォールバック）
  }
}

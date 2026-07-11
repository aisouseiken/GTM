import type { NextConfig } from "next";

// 全ページ・全レスポンスに付けるセキュリティヘッダ。
// クリックジャッキング(X-Frame-Options/frame-ancestors)、MIMEスニッフィング(X-Content-Type-Options)、
// 通信の常時HTTPS化(HSTS)、リファラ抑制、権限制限、CSP を付与する。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // 他サイトへの埋め込み禁止（クリックジャッキング対策）
  { key: "X-Content-Type-Options", value: "nosniff" }, // MIME推測禁止
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // リファラの過剰送信を抑制
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // 不要な権限を無効化
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }, // 常時HTTPS
  {
    key: "Content-Security-Policy",
    // frame-ancestors 'none' で埋め込み禁止、object-src 'none'、base-uri 'self'。
    // Next.js の動作に必要な inline を許容しつつ、外部読み込みは自サイト中心に絞る。
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // 使用フレームワークを外部に知らせる X-Powered-By ヘッダーを消す（不要な情報開示を減らす）
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

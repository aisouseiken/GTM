# GTM — AIリード発掘プラットフォーム

理想の顧客像を自然言語で伝えると、AIエージェントがウェブを探索し、検証済みの営業リードを発掘するプラットフォーム（origami.chat のクローン＋精度強化）。

## 起動（追加設定なしで動きます）

```bash
npm install
npm run dev      # http://localhost:3000 前後
```

外部APIキー・決済・DBの接続情報が無くても、**モック（本物そっくりの代役）**で全機能が動作します。実キー・本番DB・Stripe鍵は最終フェーズで設定します。

## ドキュメント

詳しい設計・仕様・コード解説は [`docs/`](./docs) にあります。まずは以下を参照してください。

- [`docs/00_概要とインデックス.md`](./docs/00_概要とインデックス.md) — 全体像・地図
- [`docs/09_コード解説.md`](./docs/09_コード解説.md) — コードを平易な日本語で解説
- [`docs/10_DBとStripe設定手順.md`](./docs/10_DBとStripe設定手順.md) — 最終フェーズの接続手順

## 技術スタック

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- データ層：現在はインメモリ（開発用）。Prisma + PostgreSQL のスキーマ/マイグレーションを `prisma/` に用意済み（`DATABASE_URL` で接続）
- 認証：署名付きセッション（モック）。本格認証は最終フェーズ
- 決済：Stripe（Checkout / Portal / Webhook 実装済み、鍵は最終フェーズ）

## 主なスクリプト

```bash
npm run dev          # 開発サーバー
npm run build        # 本番ビルド
npm run lint         # Lint
npm run db:deploy    # 開発DBへマイグレーション適用（DATABASE_URL設定後）
```

# 10. DB と Stripe の設定手順（最終フェーズ）

クライアントが最後に「開発DBの接続情報」と「Stripeの鍵」を用意して設定する前提で、
コードとスキーマ・マイグレーションは実装済み。本番環境・本番データには触れない。

---

## A. データベース（Prisma / PostgreSQL）

### 現状
- スキーマ：`prisma/schema.prisma`（設計書05準拠、Git管理）
- 初期マイグレーション：`prisma/migrations/0001_init/migration.sql`（Git管理）
- 接続口：`lib/db/prisma.ts`（`DATABASE_URL` で開発DBに接続）
- **`DATABASE_URL` 未設定の間はインメモリ store で稼働継続**（アプリは止まらない）

### クライアントから受け取るもの
- `DATABASE_URL`（例：`postgresql://user:pass@host:5432/dbname?schema=public`）
- （任意）`DIRECT_URL`（マイグレーション用の直結URL）

### 接続後の手順（開発環境に対して実行）
```bash
# .env に DATABASE_URL を設定した上で
npm run db:generate     # Prisma Client 生成
npm run db:deploy       # 既存マイグレーションを開発DBへ適用（本番には実行しない）
# 以降スキーマを変更したら
npm run db:migrate      # 新しいマイグレーションを作成（Git にコミット）
```
> ⚠️ 本番DBには `db:deploy` を実行しない。適用先は必ず「開発環境」。

---

## B. Stripe（決済）

### 現状（実装済み・鍵は空欄）
- クライアント：`lib/stripe/client.ts`
- Checkout：`app/api/stripe/checkout/route.ts`
- Billing Portal：`app/api/stripe/portal/route.ts`
- Webhook：`app/api/stripe/webhook/route.ts`（署名検証・サブスク/クレジット同期）
- 画面：`components/BillingActions.tsx`（プラン変更・支払い管理ボタン）
- **鍵未設定の間はモック動作**（「変更する」で即時プラン反映、デモ用残高で確認可能）

### クライアントが最後に設定する環境変数
```
STRIPE_SECRET_KEY=sk_live_...        # または sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # Webhook署名検証
STRIPE_PRICE_STARTER=price_...       # 各プランの価格ID（Stripeダッシュボードで作成）
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
```

### 設定後の流れ
1. Stripe ダッシュボードで各プランの Price を作成し、価格IDを上記envに設定
2. Webhook エンドポイントを登録：`https://<本番ドメイン>/api/stripe/webhook`
   - 受信イベント：`checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.paid`
3. 署名シークレット（whsec_...）を `STRIPE_WEBHOOK_SECRET` に設定
4. 鍵が入った瞬間から、モックではなく本番の Checkout / Portal / Webhook が動作

---

## C. 触れないもの（役割分担）
- 本番の Secret Key・本番の認証情報・本番DB・本番データ … **クライアントが管理**
- 開発DBの接続情報・テスト鍵 … クライアントが用意 → こちらで接続
- コード・スキーマ・マイグレーション … **こちらで実装、Git管理**

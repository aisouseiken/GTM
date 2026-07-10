// プライバシーポリシーページ（ひな型・独自文面）。B2B連絡先データの取り扱いに触れる。
export const metadata = { title: "プライバシーポリシー | GTM" };

export default function PrivacyPage() {
  return (
    <article className="text-sm leading-relaxed text-ink-soft">
      <h1 className="font-serif-display text-3xl text-ink">プライバシーポリシー</h1>
      <p className="mt-2 text-xs text-muted">最終更新日：2026年7月10日</p>

      <p className="mt-6">
        GTM（以下「当社」）は、本サービスの提供にあたり取得する情報を、本ポリシーに従って
        適切に取り扱います。当社は、個人情報の保護に関する法律その他の関連法令を遵守します。
      </p>

      <Section n="1. 取得する情報">
        <ul className="mt-1 list-disc pl-5">
          <li>アカウント情報（氏名、メールアドレス、パスワードのハッシュ）</li>
          <li>利用情報（検索内容、生成したリスト、課金・クレジットの利用状況）</li>
          <li>本サービスが公開情報等から収集する事業者の連絡先情報（法人の代表電話・代表メール等のビジネス連絡先）</li>
        </ul>
      </Section>
      <Section n="2. 利用目的">
        取得した情報は、本サービスの提供・改善、本人確認、課金、サポート、不正利用の防止、
        および法令遵守のために利用します。
      </Section>
      <Section n="3. ビジネス連絡先データの取り扱い">
        本サービスが提供する連絡先は、原則として事業者のビジネス連絡先を対象とします。
        当社は、対象者からの求めに応じて、当該連絡先を当社の配信・提供対象から除外（オプトアウト）します。
        オプトアウト・削除のご請求は、<a href="/optout" className="text-brand hover:underline">オプトアウトページ</a>から受け付けます。
      </Section>
      <Section n="4. 第三者提供">
        当社は、法令に基づく場合を除き、あらかじめ本人の同意を得ることなく個人情報を第三者に提供しません。
      </Section>
      <Section n="5. 外部サービスの利用">
        当社は、決済（Stripe）、データ提供事業者、メール・電話の検証事業者等の外部サービスを利用する場合があります。
        これらの事業者には、目的の達成に必要な範囲で情報を提供することがあります。
      </Section>
      <Section n="6. 安全管理">
        当社は、パスワードのハッシュ化、通信の暗号化、アクセス制御、監査ログ等により、
        情報の漏えい・改ざん・不正アクセスの防止に努めます。
      </Section>
      <Section n="7. 保有期間と削除">
        取得した情報は、利用目的の達成に必要な期間保有し、不要となった場合または削除のご請求があった場合には、
        法令に基づき保持が必要な場合を除き、遅滞なく削除します。
      </Section>
      <Section n="8. 開示・訂正・利用停止等の請求">
        ご本人からの開示・訂正・利用停止・削除等のご請求は、下記のお問い合わせ窓口またはオプトアウトページから承ります。
      </Section>
      <Section n="9. お問い合わせ窓口">
        個人情報の取り扱いに関するお問い合わせ先：privacy@example.com（※正式運用前に差し替え）
      </Section>

      <p className="mt-8 text-xs text-muted">
        ※ 本ページはひな型です。正式運用前に、運営者情報・委託先・保有期間等を法務確認のうえ確定してください。
      </p>
    </article>
  );
}

function Section({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-ink">{n}</h2>
      <div className="mt-1">{children}</div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <AuthShell
      title="おかえりなさい"
      subtitle="メールアドレスでログイン（デモではパスワード不要）"
      cta="ログイン"
      alt={{ text: "アカウントがない場合", href: "/signup", label: "無料で登録" }}
      showName={false}
    />
  );
}

export function AuthShell({
  title,
  subtitle,
  cta,
  alt,
  showName,
}: {
  title: string;
  subtitle: string;
  cta: string;
  alt: { text: string; href: string; label: string };
  showName: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">
          <h1 className="font-serif-display text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
          <form action={loginAction} className="mt-8 space-y-4">
            {showName && (
              <div>
                <label className="mb-1 block text-sm text-ink-soft">お名前</label>
                <input
                  name="name"
                  type="text"
                  placeholder="山田 太郎"
                  className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-ink-soft">メールアドレス</label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {cta}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {alt.text}は{" "}
            <Link href={alt.href} className="font-medium text-brand hover:underline">
              {alt.label}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

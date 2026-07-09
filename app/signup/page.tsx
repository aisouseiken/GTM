import { AuthShell } from "@/app/login/page";

export default function SignupPage() {
  return (
    <AuthShell
      title="無料ではじめる"
      subtitle="1,000 クレジット付き。クレジットカード不要。"
      cta="無料で登録"
      alt={{ text: "すでにアカウントがある場合", href: "/login", label: "ログイン" }}
      showName
    />
  );
}

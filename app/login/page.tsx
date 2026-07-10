// ログイン画面。入力フォーム本体は AuthForm（クライアント部品）が担当します。
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  return <AuthForm mode="login" action={loginAction} />;
}

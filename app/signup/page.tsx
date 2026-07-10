// 新規登録画面。入力フォーム本体は AuthForm（クライアント部品）が担当します。
import { AuthForm } from "@/components/AuthForm";
import { signupAction } from "@/app/actions/auth";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signupAction} />;
}

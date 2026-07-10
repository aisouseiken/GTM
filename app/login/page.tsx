// ログイン画面。入力フォーム本体は AuthForm（クライアント部品）が担当します。
// ※フォーム＝入力欄。※クライアント部品＝利用者のブラウザ側で動く部品。
// AuthForm＝ログイン／新規登録で共通して使う入力欄の部品を持ち込む。
import { AuthForm } from "@/components/AuthForm";
// loginAction＝「ログインボタンが押されたときに実行する処理（本人確認の処理）」を持ち込む。
import { loginAction } from "@/app/actions/auth";

// ログインページを組み立てる部品。
export default function LoginPage() {
  // 共通の入力欄部品を、mode="login"（ログイン用の見た目・文言）にして表示。
  // action＝送信時に実行する処理として、上で持ち込んだloginActionを渡す。
  return <AuthForm mode="login" action={loginAction} />;
}

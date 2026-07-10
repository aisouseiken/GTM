// このファイルはアプリ全体の「土台（レイアウト）」です。すべてのページが、この中に差し込まれて表示されます。
// ここでは使うフォントの読み込み、ブラウザのタブに出る題名・説明文、ページ全体の枠組み（html/body）を用意します。
// ※このファイルはサーバー側で動く部品（初期表示を作る係。ユーザー操作には直接反応しない）。

// Metadata = ページの題名・説明文などの「設定の型（決まった形）」を使うための取り込み。
import type { Metadata } from "next";
// Google が無料で配っている2種類の文字デザイン（フォント）を取り込む。
import { Inter, Fraunces } from "next/font/google";
// アプリ全体で共通の見た目（色や余白などのルール）をまとめたファイルを読み込む。
import "./globals.css";

// 本文用のフォント「Inter」を読み込む設定。
const inter = Inter({
  variable: "--font-inter", // このフォントを呼び出すための「あだ名（変数名）」を決める。
  subsets: ["latin"], // 使う文字の範囲。latin＝英数字（データを軽くするための指定）。
  display: "swap", // フォント読み込み中はとりあえず別の字で表示し、後で差し替える（真っ白防止）。
});

// 見出し用の飾りフォント「Fraunces」を読み込む設定。
const fraunces = Fraunces({
  variable: "--font-fraunces", // このフォントを呼び出すための「あだ名」を決める。
  subsets: ["latin"], // 使う文字の範囲（英数字）。
  display: "swap", // 読み込み中は別の字で仮表示（真っ白防止）。
});

// metadata = ブラウザのタブや検索結果に表示される題名・説明文。
export const metadata: Metadata = {
  title: "GTM — Find your perfect customers in one prompt", // ブラウザのタブに出る題名。
  description:
    "理想の顧客像を一言で。GTM の AI エージェントがリアルタイムでウェブを検索し、検証済みの営業リードを発掘します。", // 検索結果などに出る説明文。
};

// アプリ全体の枠を作る部品。children（＝各ページの中身）を受け取り、body の中に差し込む。
export default function RootLayout({
  children, // children = この土台の中に入れ替わりで表示される各ページの中身。
}: Readonly<{
  children: React.ReactNode; // React.ReactNode = 画面に表示できるもの全般（文字やタグなど）の型。
}>) {
  return (
    // <html> = Webページ全体の一番外側の入れ物。
    <html
      lang="ja" // このページの言語は日本語だと宣言（読み上げソフトや検索エンジン向け）。
      className={`${inter.variable} ${fraunces.variable} antialiased`} // 上で用意した2フォントを有効にし、文字を滑らかに表示する設定。
    >
      {/* <body> = 実際に目に見える中身が入る場所。背景色クリーム・文字色を指定し、その中に各ページ（children）を差し込む */}
      <body className="min-h-screen bg-cream text-ink">{children}</body>
    </html>
  );
}

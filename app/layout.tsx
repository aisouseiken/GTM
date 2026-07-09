import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GTM — Find your perfect customers in one prompt",
  description:
    "理想の顧客像を一言で。GTM の AI エージェントがリアルタイムでウェブを検索し、検証済みの営業リードを発掘します。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${fraunces.variable} antialiased`}
    >
      <body className="min-h-screen bg-cream text-ink">{children}</body>
    </html>
  );
}

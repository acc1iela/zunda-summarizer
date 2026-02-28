import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ずんだもん技術記事要約",
  description: "技術記事のURLを入れると、ずんだもんが要約して読み上げるのだ！",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

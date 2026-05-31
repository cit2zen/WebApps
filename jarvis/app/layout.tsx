import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const DESCRIPTION = "JARVIS — 한국어 음성으로 대화하는 AI 비서";

export const metadata: Metadata = {
  metadataBase: new URL("https://jarvis.cityzen.kr"),
  title: "JARVIS",
  description: DESCRIPTION,
  openGraph: {
    title: "JARVIS",
    description: DESCRIPTION,
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#06060b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

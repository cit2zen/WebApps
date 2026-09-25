import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans_KR, Noto_Serif_KR, Space_Mono, Nanum_Pen_Script } from "next/font/google";
// Polaroid Editorial v2 킷 사본(정본 develop_web/design-system, sync_design.py로 동기 — 직접 수정 금지)
import "./design-tokens.css";
import "./typography.css";
import "./polaroid.css";
import "./pol-ui.css";
import "./globals.css";
import { PALETTE } from "@/lib/palette";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["italic"],
  display: "swap",
  preload: true,
});

// 한글: 본문·라벨은 고딕, 디스플레이는 명조(정자). 유니코드 범위 분할 로딩이라 preload 끔.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans-kr",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-serif-kr",
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  preload: false,
});

const nanumPen = Nanum_Pen_Script({
  variable: "--font-nanum-pen",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
});

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
  viewportFit: "cover",
  themeColor: PALETTE.bgBase, // --bg-base
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [fraunces, notoSansKr, notoSerifKr, spaceMono, nanumPen].map((f) => f.variable).join(" ");
  return (
    <html lang="ko" className={fontVars}>
      <body className="pol-body">{children}</body>
    </html>
  );
}

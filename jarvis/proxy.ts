// proxy.ts (Next 16: middleware → proxy)
// 1) 비밀번호 게이트: 유효한 jarvis_session 쿠키 없으면 페이지는 /login으로 302, /api/*는 401 JSON.
//    JARVIS_PASSWORD 미설정 시 production은 API 503(fail closed), dev는 경고 후 통과.
// 2) 익명 클라이언트 식별 httpOnly 쿠키(jv_cid) 발급 — route.ts의 레이트리밋·sessionId 소유권 키.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getPassword, verifySessionToken } from "@/lib/auth";

const CID = "jv_cid";
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/health"]);
let warned = false;

function withCid(req: NextRequest, res: NextResponse): NextResponse {
  if (!req.cookies.get(CID)) {
    res.cookies.set(CID, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
    });
  }
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (PUBLIC_PATHS.has(pathname)) return withCid(req, NextResponse.next());

  const password = getPassword();
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      if (isApi) {
        return NextResponse.json(
          { error: "auth_not_configured", message: "서버 인증이 설정되지 않았어요." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      // 페이지는 로그인 화면으로(로그인 API도 503을 돌려준다)
      return NextResponse.redirect(new URL("/login", req.url), 302);
    }
    if (!warned) {
      console.warn("[jarvis] JARVIS_PASSWORD 미설정 — dev 모드라 인증 없이 통과합니다.");
      warned = true;
    }
    return withCid(req, NextResponse.next());
  }

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, password);
  if (ok) return withCid(req, NextResponse.next());

  if (isApi) {
    return NextResponse.json(
      { error: "unauthorized", message: "로그인이 필요해요." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  // verify_live.py는 200/302만 PASS로 본다 → 307 대신 302.
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url, 302);
}

export const config = {
  // 정적 자산 제외, 페이지·API 진입에 게이트 적용
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|robots.txt).*)"],
};

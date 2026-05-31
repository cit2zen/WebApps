// middleware.ts
// /api/chat가 공개 배포(jarvis.cityzen.kr)되므로 익명 클라이언트를 식별할 httpOnly 쿠키(cid)를
// 발급한다. 이 cid는 route.ts에서 레이트리밋·sessionId 소유권 검증의 키로 쓰인다.
// (Cloudflare Access로 전체를 게이트하면 더 강력하지만, 공개 데모 유지를 위해 코드 레벨 차단을 둔다.)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CID = "jv_cid";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(CID)) {
    const cid = crypto.randomUUID();
    res.cookies.set(CID, cid, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
    });
  }
  return res;
}

export const config = {
  // 정적 자산 제외, 페이지·API 진입에 쿠키 보장
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg).*)"],
};

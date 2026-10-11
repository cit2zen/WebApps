// app/api/login/route.ts — 비밀번호 확인 → 서명 세션 쿠키 발급. IP당 10분 10회.
import { SESSION_COOKIE, SESSION_TTL_SEC, createSessionToken, getPassword, passwordMatches } from "@/lib/auth";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req.headers)}`, 10, 10 * 60_000)) return tooMany();

  const password = getPassword();
  if (!password) {
    return Response.json(
      { error: "auth_not_configured", message: "서버 인증이 설정되지 않았어요." },
      { status: 503, headers: NO_STORE },
    );
  }

  let input = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") input = body.password;
  } catch {
    /* 빈/잘못된 본문 → 실패 처리 */
  }

  if (!input || !(await passwordMatches(input, password))) {
    return Response.json(
      { error: "invalid_password", message: "비밀번호가 맞지 않아요." },
      { status: 401, headers: NO_STORE },
    );
  }

  const res = Response.json({ ok: true }, { headers: NO_STORE });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${await createSessionToken(password)}; Path=/; Max-Age=${SESSION_TTL_SEC}; HttpOnly; SameSite=Lax${secure}`,
  );
  return res;
}

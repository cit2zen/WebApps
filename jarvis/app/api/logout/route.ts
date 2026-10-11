// app/api/logout/route.ts — 세션 쿠키 삭제.
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  return res;
}

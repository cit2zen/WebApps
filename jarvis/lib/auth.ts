// lib/auth.ts
// 비밀번호 게이트: JARVIS_PASSWORD 하나로 로그인 → HMAC-SHA256 서명 세션 쿠키(jarvis_session).
// 서명 키는 비밀번호에서 파생하므로 비밀번호를 바꾸면 기존 세션이 모두 무효화된다.
// Web Crypto만 사용 → proxy.ts·route handler 어디서나 동작.

export const SESSION_COOKIE = "jarvis_session";
export const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30일

const enc = new TextEncoder();

export function getPassword(): string | undefined {
  const p = process.env.JARVIS_PASSWORD;
  return p && p.length > 0 ? p : undefined;
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 길이 노출 외엔 상수 시간 비교.
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

// 비밀번호 비교: 양쪽을 SHA-256으로 고정 길이화한 뒤 상수 시간 비교(길이 노출 방지).
export async function passwordMatches(input: string, password: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(password)),
  ]);
  return safeEqual(b64url(a), b64url(b));
}

async function hmacKey(password: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`jarvis-session-v1:${password}`));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string, password: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(password), enc.encode(payload));
  return b64url(sig);
}

// 토큰 = "<만료 epoch초>.<서명>"
export async function createSessionToken(password: string, nowMs = Date.now()): Promise<string> {
  const exp = String(Math.floor(nowMs / 1000) + SESSION_TTL_SEC);
  return `${exp}.${await sign(exp, password)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  password: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 <= nowMs) return false;
  return safeEqual(sig, await sign(exp, password));
}

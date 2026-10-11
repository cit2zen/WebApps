// tests/auth.test.ts
import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, passwordMatches, SESSION_TTL_SEC } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

describe("session token", () => {
  it("발급한 토큰은 같은 비밀번호로 검증된다", async () => {
    const t = await createSessionToken("pw-a");
    expect(await verifySessionToken(t, "pw-a")).toBe(true);
  });
  it("비밀번호가 바뀌면 무효", async () => {
    const t = await createSessionToken("pw-a");
    expect(await verifySessionToken(t, "pw-b")).toBe(false);
  });
  it("만료·변조·빈 토큰은 무효", async () => {
    const now = Date.now();
    const t = await createSessionToken("pw", now);
    expect(await verifySessionToken(t, "pw", now + (SESSION_TTL_SEC + 1) * 1000)).toBe(false);
    const [exp, sig] = t.split(".");
    expect(await verifySessionToken(`${Number(exp) + 999}.${sig}`, "pw")).toBe(false);
    expect(await verifySessionToken(undefined, "pw")).toBe(false);
    expect(await verifySessionToken("garbage", "pw")).toBe(false);
  });
  it("passwordMatches", async () => {
    expect(await passwordMatches("abc", "abc")).toBe(true);
    expect(await passwordMatches("abd", "abc")).toBe(false);
    expect(await passwordMatches("", "abc")).toBe(false);
  });
});

describe("rateLimit", () => {
  it("창 안에서 max 초과 시 거부, 창 지나면 허용", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t0 + i)).toBe(true);
    expect(rateLimit("k", 3, 1000, t0 + 10)).toBe(false);
    expect(rateLimit("k", 3, 1000, t0 + 2000)).toBe(true);
  });
  it("clientIp: cf-connecting-ip 우선", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

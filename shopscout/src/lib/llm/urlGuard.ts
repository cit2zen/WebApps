import net from 'node:net';
import dns from 'node:dns/promises';

/** 사설/내부/링크로컬 IP 대역인지 (SSRF 방지) */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const o = ip.split('.').map(Number);
    if (o[0] === 127) return true; // loopback
    if (o[0] === 10) return true; // 10/8
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16/12
    if (o[0] === 192 && o[1] === 168) return true; // 192.168/16
    if (o[0] === 169 && o[1] === 254) return true; // link-local / 메타데이터
    if (o[0] === 0) return true; // 0.0.0.0/8
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('::ffff:')) {
      const rest = lower.slice('::ffff:'.length);
      // dotted-decimal 형태: ::ffff:127.0.0.1
      if (net.isIPv4(rest)) return isPrivateIp(rest);
      // hex 세그먼트 형태: ::ffff:7f00:1 → 127.0.0.1
      const parts = rest.split(':');
      if (parts.length === 2) {
        const hi = parseInt(parts[0], 16);
        const lo = parseInt(parts[1], 16);
        if (Number.isFinite(hi) && Number.isFinite(lo)) {
          const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isPrivateIp(v4);
        }
      }
      return true; // 해석 불가한 ::ffff: 형태는 안전하지 않다고 간주
    }
    return false;
  }
  return true; // 알 수 없으면 안전하지 않다고 간주
}

/**
 * 외부 이미지 URL이 안전한지 검사 (SSRF 방지).
 * - https만 허용
 * - 호스트가 IP 리터럴이면 사설 대역 거부
 * - 도메인이면 DNS 해석 결과가 하나라도 사설 대역이면 거부
 * 잔여 위험: DNS 리바인딩(TOCTOU) — fetch는 redirect:'manual'로 추가 완화한다.
 */
export async function isSafeImageUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.replace(/^\[|\]$/g, ''); // IPv6 대괄호 제거
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

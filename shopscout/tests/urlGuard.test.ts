import { describe, it, expect } from 'vitest';
import { isPrivateIp, isSafeImageUrl } from '@/lib/llm/urlGuard';

describe('isPrivateIp', () => {
  it('사설/내부 IPv4 대역을 탐지', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it('공인 IPv4는 false', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });
  it('IPv6 loopback/ULA를 탐지', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
  });
  it('IPv4-mapped IPv6 hex 형식의 사설 주소도 탐지(SSRF 우회 방지)', () => {
    expect(isPrivateIp('::ffff:7f00:1')).toBe(true); // 127.0.0.1
    expect(isPrivateIp('::ffff:a00:1')).toBe(true); // 10.0.0.1
    expect(isPrivateIp('::ffff:0808:0808')).toBe(false); // 8.8.8.8 (공인)
  });
});

describe('isSafeImageUrl', () => {
  it('http(비 https)는 거부', async () => {
    expect(await isSafeImageUrl('http://example.com/a.jpg')).toBe(false);
  });
  it('내부 IP 리터럴은 거부', async () => {
    expect(await isSafeImageUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(await isSafeImageUrl('https://127.0.0.1/a.jpg')).toBe(false);
  });
  it('잘못된 URL은 거부', async () => {
    expect(await isSafeImageUrl('not a url')).toBe(false);
  });
});

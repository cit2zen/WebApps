// 브라우저 → 자체 백엔드(/api/chat) 프록시. 구독(claude CLI/OAuth) 인증은 서버가 처리한다.
// (예전: 브라우저가 Anthropic API 키로 api.anthropic.com 직접 호출 → 폐기)

// 사용자에게 노출할 에러는 코드만 담는다(기술 문자열 노출 방지). 상세는 console.error로.
function err(code) {
  const e = new Error(code);
  e.code = code; // 'network' | 'server'
  return e;
}

export class Claude {
  constructor() {
    this.sessionId = undefined; // 서버 세션 resume용
  }

  reset() { this.sessionId = undefined; }

  async send(userText) {
    let res;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userText, sessionId: this.sessionId }),
      });
    } catch (e) {
      // 네트워크 끊김/오프라인 등 fetch 자체 실패
      console.error('[Aura] chat network error', e);
      throw err('network');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[Aura] chat HTTP', res.status, detail.slice(0, 300));
      throw err('server');
    }
    const data = await res.json();
    if (data.error) {
      console.error('[Aura] chat error payload', data.error);
      throw err('server');
    }
    if (data.sessionId) this.sessionId = data.sessionId;
    return (data.text || '').trim();
  }
}

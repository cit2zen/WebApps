// 브라우저 → 자체 백엔드(/api/chat) 프록시. 구독(claude CLI/OAuth) 인증은 서버가 처리한다.
// (예전: 브라우저가 Anthropic API 키로 api.anthropic.com 직접 호출 → 폐기)
export class Claude {
  constructor() {
    this.sessionId = undefined; // 서버 세션 resume용
  }

  reset() { this.sessionId = undefined; }

  async send(userText) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: userText, sessionId: this.sessionId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error('API_' + res.status + (detail ? ': ' + detail.slice(0, 200) : ''));
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.sessionId) this.sessionId = data.sessionId;
    return (data.text || '').trim();
  }
}

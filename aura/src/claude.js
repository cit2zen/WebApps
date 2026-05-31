import { getKey } from './settings.js';

const SYSTEM = [
  '너는 "Aura"라는 이름의 감성적인 음성 동반자다.',
  '항상 한국어로, 짧고 따뜻하게, 때로 시적으로 대답한다.',
  '한 번의 응답은 1~3문장. 장황한 설명·목록·코드 블록은 피한다.',
  '상대의 감정을 먼저 헤아리고, 부드러운 어조를 유지한다.',
].join(' ');

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export class Claude {
  constructor() {
    this.history = []; // {role, content}
  }

  reset() { this.history = []; }

  async send(userText) {
    const key = getKey();
    if (!key) throw new Error('NO_KEY');
    this.history.push({ role: 'user', content: userText });

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        system: SYSTEM,
        messages: this.history,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error('API_' + res.status + (detail ? ': ' + detail.slice(0, 200) : ''));
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    this.history.push({ role: 'assistant', content: text });
    // 히스토리 무한 성장 방지: 최근 10턴(user/assistant 20개)만 유지.
    if (this.history.length > 20) this.history = this.history.slice(-20);
    return text;
  }
}

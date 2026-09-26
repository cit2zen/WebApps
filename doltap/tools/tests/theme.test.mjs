import test from 'node:test';
import assert from 'node:assert/strict';
import { DOLTAP, SHARED, loadTheme, col, font, heroPx, safeTop, cacheScale, cacheSize,
  hexRgb, mixHex, skyAt, shade } from '../../js/theme.js';

const TOK = {
  '--doltap-sky-dawn': '#f3e3c8', '--doltap-sky-day': '#cfdde0', '--doltap-sky-dusk': '#e8b98a',
  '--doltap-sky-glow': '#b8747a', '--font-mono': "'Space Mono', monospace", '--font-label': "'Noto Sans KR', sans-serif"};
const full = n => TOK[n] ?? ' #123456 ';

test('토큰 목록: 게임 전용 21개 + 공유 22개, --doltap- 접두사', () => {
  assert.equal(DOLTAP.length, 21);
  assert.ok(DOLTAP.every(n => n.startsWith('--doltap-')));
  assert.equal(new Set([...DOLTAP, ...SHARED]).size, 43);
  for (const n of ['--gold-dark', '--font-mono', '--gold-light', '--pol-danger-line']) assert.ok(SHARED.includes(n));
});

test('loadTheme: 값 trim·probe px·safeTop, 빈 토큰 warn은 1회만', () => {
  const warns = [];
  const orig = console.warn;
  console.warn = m => warns.push(m);
  try {
    loadTheme(n => (n === '--doltap-moss' ? '' : full(n)), () => 64, () => 47);
    loadTheme(n => (n === '--doltap-moss' ? '' : full(n)), () => 64, () => 47);
  } finally { console.warn = orig; }
  assert.equal(warns.length, 1);
  assert.match(warns[0], /--doltap-moss/);
  assert.equal(col('--doltap-rock'), '#123456');
  assert.equal(heroPx(), 64);
  assert.equal(safeTop(), 47);
  assert.equal(font('mono', 11), "11px 'Space Mono', monospace");
  assert.equal(font('label', 12.4), "12px 'Noto Sans KR', sans-serif");
});

test('캐시 배율 cs = min(k·min(dpr,2), 2.4), 한 변 ≤ 280', () => {
  assert.equal(cacheScale(1, 1), 1);
  assert.equal(cacheScale(1, 3), 2);
  assert.equal(cacheScale(1.5, 2), 2.4);
  assert.equal(cacheSize(115, 2.4), 280);
  assert.equal(cacheSize(115, cacheScale(1.5, 3)), 280);
});

test('색 보간: mixHex·skyAt 정지점(0/150/300/450cm)과 450 이상 고정', () => {
  assert.deepEqual(hexRgb('#7b766b'), [0x7b, 0x76, 0x6b]);
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  loadTheme(full, () => 48, () => 0);
  assert.equal(skyAt(0), '#f3e3c8');
  assert.equal(skyAt(150), '#cfdde0');
  assert.equal(skyAt(300), '#e8b98a');
  assert.equal(skyAt(450), '#b8747a');
  assert.equal(skyAt(900), '#b8747a');
  assert.equal(skyAt(75), mixHex('#f3e3c8', '#cfdde0', 0.5));
  assert.equal(skyAt(-10), '#f3e3c8');
});

test('shade: HSL 명도만 ±%p', () => {
  assert.equal(shade('#808080', 0), 'hsl(0 0.0% 50.2%)');
  assert.equal(shade('#808080', 8), 'hsl(0 0.0% 58.2%)');
  assert.equal(shade('#ffffff', 8), 'hsl(0 0.0% 100.0%)');
});

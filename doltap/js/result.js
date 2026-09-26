// result.js — S10 결과 · S10a 공유 폴백, 탑 스냅샷(setSnapshot: toDataURL→img), 배지, 등급(B=200) (§4)
// HTML 문자열 삽입 없음. img.src는 이 파일의 setSnapshot 한 곳에서만 넣는다(§6 보안 예외 1곳).
import S from './strings.js';
import { h, setText, fmt } from './dom.js';
import { buildShareText, shareFlow, gridRows } from './share.js';
import { shell, button, openDialog, closeTop, toast } from './dialogs.js';
import { load } from './storage.js';
import { pick } from './content.js';                       // 문구 선택만(로드는 main)
import { ROCK, localOf } from './render.js';               // 규칙 5 바위 꼭짓점 · 무게중심 기준 로컬 꼭짓점
import { toneOf } from './stones.js';                      // Stone.tone → --doltap-stone-* 토큰(정합 #1)

export const GRADE_B = 60;                                // §9 Q2: bot.month 평균을 10cm 단위로 반올림해 교체(구현 7단계)
let cb = {}, cur = null, forced = null;
export function mount(c) { cb = c; }
export const grade = (H, B = GRADE_B) => (H < 0.5 * B ? 0 : H < B ? 1 : H < 1.4 * B ? 2 : H < 1.8 * B ? 3 : 4);
export const shareText = () => (cur ? cur.text : '');
export function forceShare(m) { forced = m || null; return forced; }   // 다음 공유 1회만 그 경로로

export function setSnapshot(img, canvas) {
  const url = canvas.toDataURL('image/png');
  if (!/^data:image\/png;base64,/.test(url)) throw new Error('snapshot: png data URL이 아님');
  img.src = url;
  img.alt = S.result.snapshotAlt;
}

// 탑 스냅샷 270×270: view().bodies(월드 y-up, 무게중심 x·y, 화면 시계 방향 angle)로 돌 다각형을 복원한다.
// bbox(+바위 윗부분) + 여백 20px을 사진 칸에 맞춰 축소, 최대 1배(§4 S10)
function tower(bodies, set) {
  const W = 270, dpr = Math.min(window.devicePixelRatio || 1, 2), cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(W * dpr);
  const ctx = cv.getContext('2d'), cs = getComputedStyle(document.documentElement), tok = v => cs.getPropertyValue(v).trim();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const polys = bodies.map(b => {
    const s = set.stones[b.i - 1], co = Math.cos(b.angle), si = Math.sin(b.angle);
    return { tone: s.tone, pts: localOf(s).map(([x, y]) => [b.x + x * co + y * si, b.y - x * si + y * co]) };
  });
  const all = polys.flatMap(q => q.pts).concat([[95, -30], [295, 0]]);
  const xs = all.map(q => q[0]), ys = all.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(1, W / (x1 - x0 + 40), W / (y1 - y0 + 40)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const poly = (pts, color) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](W / 2 + (x - mx) * k, W / 2 - (y - my) * k));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
  };
  ctx.fillStyle = tok('--doltap-sky-dawn');
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = tok('--ink-warm');
  ctx.lineWidth = 1;
  poly(ROCK, tok('--doltap-rock'));
  for (const q of polys) poly(q.pts, tok(toneOf(q.tone) || '--doltap-stone-gray'));
  return cv;
}

// S/공유 버튼: native → clipboard(토스트 '복사했어요') → S10a
export async function share() {
  if (!cur) return null;
  const how = await shareFlow(cur.text, { force: forced });
  forced = null;
  if (how === 'clipboard') toast(S.result.copied);
  else if (how === 'fallback') openFallback(cur.text);
  return how;
}

// S10a — readonly textarea(7행) + 안내 + 전체 선택 · 닫기. 열리면 자동 select()
export function openFallback(text) {
  const [ov, dl] = shell('dlg-share', S.result.share);
  const ta = h('textarea', { class: 'pol-textarea', readonly: '', 'aria-label': S.result.copyFallback });
  ta.value = text;
  ta.rows = 7;
  const selectAll = () => {
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 복사 미지원 → 선택 상태로 둔다 */ }
  };
  dl.append(ta, h('p', { class: 'copy-hint' }, S.result.copyFallback),
    button('pol-btn-ghost', S.result.selectAll, selectAll), button('pol-btn-ghost', S.lobby.close, () => closeTop()));
  openDialog(ov, document.activeElement);
  ta.focus();
  ta.select();
  return ov;
}

const same = (a, b) => !!a && !!b && a.H === b.H && a.left === b.left && a.perfect === b.perfect;

// sum = game.summary() + {content}: {run, set, mode, tries, streak, best, newBest, beatFriend, bodies, content}
// content = main이 부트에서 받은 content.load() 결과({wishes, trails})
export function show(sum) {
  const { run, set, mode, tries = 0, streak = 1, best = null, newBest = false, beatFriend = false, bodies = [], content = null } = sum;
  const off = mode === 'official', top = off && best ? best : run;   // 공식 판 공유 = 오늘 최고 판(규칙 19)
  cur = { text: buildShareText({ run: top, set, mode, streak, tries }) };
  const day = { m: +set.day.slice(4, 6), d: +set.day.slice(6, 8) };
  const { wish, trail } = pick(content || {}, set);
  let sound = load().sound !== false;
  const snd = button('pol-btn-ghost pol-btn-icon', sound ? '🔊' : '🔇', () => {
    sound = !sound;
    if (cb.onSetting) cb.onSetting('sound', sound);
    setText(snd, sound ? '🔊' : '🔇');
  }, { 'aria-label': S.lobby.sound });
  const bar = h('header', { class: 'pol-appbar' }), end = h('div', { class: 'pol-appbar-end' });
  end.appendChild(snd);
  bar.append(h('span', { class: 'pol-appbar-title' }, off ? fmt(S.result.header, { n: set.n }) : S.result.headerPractice), end);
  const img = h('img', { alt: S.result.snapshotAlt }), ph = h('div', { class: 'pol-photo' }), card = h('div', { class: 'pol-card result-card' });
  ph.appendChild(img);
  const badges = h('div', { class: 'sticker' });           // T4a `#result .sticker`(카드 오른쪽 위, -6°)
  if (newBest) badges.appendChild(h('span', { class: 'pol-chip gold' }, S.result.newBest));
  if (beatFriend) badges.appendChild(h('span', { class: 'pol-chip gold' }, S.result.beatFriend));
  card.append(ph, h('div', { class: 'pol-num' }, `${off ? `#${set.n}` : S.lobby.practiceTitle} · ${fmt(S.lobby.todayDate, day)} · ${trail}`),
    h('div', { class: 'pol-caption' }, wish), badges);
  const score = h('div', { id: 'score' });
  score.append(h('div', { class: 'h' }, `${run.H.toFixed(1)}cm`),
    h('div', { class: 'sub' }, fmt(S.result.sub, { left: run.left, grade: S.grade[grade(run.H)] })),
    h('div', { class: 'sub note' }, S.result.physicsNote));
  const showNote = off && !!best && !same(best, run);     // 방금 판이 오늘 최고가 아니면 안내, 아니면 높이만 유지
  const note = h('p', { class: showNote ? 'share-note' : 'share-note off' }, showNote ? fmt(S.result.shareNote, { H: best.H.toFixed(1) }) : '');
  const row = h('div', { class: 'retry-row' }), r = 3 - tries;             // T4a `.retry-row`(2열)·`.retry-label`(16px)
  row.append(button('pol-btn-ghost', S.result.retry, () => { if (cb.onRetry) cb.onRetry(); }),
    button('pol-btn-ghost', S.result.lobby, () => { if (cb.onLeave) cb.onLeave(); }));
  const label = h('p', { class: 'retry-label' }, off ? (r >= 1 ? fmt(S.result.retryLeft, { r }) : S.result.retryPracticeToday) : S.result.retryPractice);
  document.getElementById('result').replaceChildren(bar, card, score, h('pre', { id: 'grid' }, gridRows(run.grid).join('\n')), note,
    button('pol-btn-primary share-btn', off ? fmt(S.result.shareBest, { H: top.H.toFixed(1) }) : S.result.share, () => share()), row, label);
  setSnapshot(img, tower(bodies, set));
}

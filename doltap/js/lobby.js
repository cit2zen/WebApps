// lobby.js — S0 부트 · S1 오류 · S2 로비 · S3 연습 패널 · S4 기록 패널 (§4)
// 소원·산길·?c=·?d= 값은 dom.h/fmt → textContent로만 넣는다(§6 보안 규칙). 로비 표시 후 0~900ms 탭 무시(규칙 15).
import S from './strings.js';
import { h, setText, fmt } from './dom.js';
import { todayKST, nOf, prevDay, parseParams, daily } from './daily.js';
import { generate } from './stones.js';
import { load, persist, displayStreak } from './storage.js';
import { pick } from './content.js';                       // 문구 선택만(로드는 main). plan A: lobby·result는 pick(c, set)
import { drawStoneThumb, drawRockMini } from './render.js';
import { shell, button, openDialog, openSettings, openHelp, closeTop, toast } from './dialogs.js';

let cb = {}, shownAt = Infinity, onToday = () => {};
export function mount(c) { cb = c; }
const md = day => ({ m: +day.slice(4, 6), d: +day.slice(6, 8) });
const cm = v => (+v || 0).toFixed(1);
const stamp = e => (e && e.timeStamp) || performance.now();
const guard = fn => e => { if (stamp(e) - shownAt >= 900) fn(e); };
const short = () => window.matchMedia('(max-height:740px)').matches;

// 전역 Enter(keys → game.onAction {t:'today'} → 훅 today → 여기). 900ms 가드는 키 입력에도 같다(§4 로비 키보드 접근)
export function activateToday(t = performance.now()) { if (t - shownAt >= 900) onToday(); }

// S0·S1: main v4의 paintBoot·paintError 본문을 그대로 옮긴 것(T4a 훅 .boot-*·.err-title·.err-hint)
export function showBoot() {
  const stones = h('div', { class: 'boot-stones', 'aria-hidden': 'true' });
  for (let i = 0; i < 3; i++) stones.appendChild(h('span', { class: 'boot-stone' }));
  document.getElementById('boot').replaceChildren(h('div', { class: 'pol-brand' }, '돌탑'), stones,
    h('p', { class: 'boot-msg' }, S.boot.loading));
}
export function showError() {
  document.getElementById('error').replaceChildren(h('h1', { class: 'err-title' }, S.error.load),
    h('p', { class: 'err-hint' }, S.error.hint), button('pol-btn-primary', S.error.retry, () => location.reload()));
}

function paint(cv, w, stones, rock) {                    // 사진 칸: 오늘=첫 돌 3개+미니 바위, 연습=돌 5개 더미
  const d = Math.min(window.devicePixelRatio || 1, 2), ctx = cv.getContext('2d');
  cv.width = cv.height = Math.round(w * d);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  if (rock) drawRockMini(ctx, { x: w * 0.12, y: w * 0.74, w: w * 0.76, h: w * 0.2 });
  stones.forEach((s, j) => drawStoneThumb(ctx, s, rock
    ? { x: w * 0.3, y: w * (0.54 - 0.2 * j), w: w * 0.4, h: w * 0.2 }
    : { x: w * (j < 3 ? 0.05 + 0.3 * j : 0.2 + 0.3 * (j - 3)), y: w * (j < 3 ? 0.62 : 0.34), w: w * 0.3, h: w * 0.3 }));
}
function card(id, cls, num, caption, onTap) {
  const b = button(`pol-card ${cls}`, null, guard(onTap), { id });
  const ph = h('div', { class: 'pol-photo' }), cv = h('canvas', { 'aria-hidden': 'true' });
  ph.appendChild(cv);
  b.append(ph, h('div', { class: 'pol-num' }, num), h('div', { class: 'pol-caption' }, caption));
  return [b, ph, cv];
}

// S2 — 표시될 때마다 KST 날짜·?d=/?c=·저장을 다시 읽는다(규칙 16). main의 showLobby·훅 lobby가 부른다
// content = main이 부트에서 받은 content.load() 결과({wishes, trails}, 실패 항목은 null → pick이 폴백)
export function show(content) {
  const today = todayKST(), n = nOf(today), set = daily(today), st = load(), p = parseParams();
  const rec = st.days[today] || { tries: 0, best: null }, k = rec.tries || 0, { m, d } = md(today);
  const F = p.friendH === null ? null : cm(p.friendH), { wish, trail } = pick(content || {}, set);
  onToday = () => {                                        // 공식(잔여>0) / 오늘 시드 연습(잔여 0·출시 전) + 토스트
    const opt = { day: today, friendCm: p.past ? null : p.friendH };
    if (n >= 1 && k < 3) { cb.onStart('official', opt); return; }
    cb.onStart('practice', opt);
    toast(n < 1 ? S.toast.preLaunch : S.toast.noTries);
  };
  let sound = st.sound !== false;
  const snd = button('pol-btn-ghost pol-btn-icon', sound ? '🔊' : '🔇', () => {
    sound = !sound; cb.onSetting('sound', sound); setText(snd, sound ? '🔊' : '🔇');
  }, { 'aria-label': S.lobby.sound });
  const bar = h('header', { class: 'pol-appbar' }), end = h('div', { class: 'pol-appbar-end' });
  end.append(snd, button('pol-btn-ghost pol-btn-icon', '⚙', e => openSettings(e.currentTarget), { 'aria-label': S.pause.settings }),
    button('pol-btn-ghost pol-btn-icon', '?', e => openHelp(e.currentTarget), { 'aria-label': S.pause.help }));
  bar.append(h('span', { class: 'pol-brand' }, '돌탑'), end);
  const sub = h('div', { class: 'sub-row', id: 'lobby-sub' });     // 부제·배지 ①~④(§4 S2), T4a `#lobby .sub-row`
  if (p.past) {
    const pd = md(p.day), txt = F ? fmt(S.lobby.friendPast, { md: `${pd.m}/${pd.d}`, F }) : fmt(S.lobby.pastBadge, pd);
    sub.appendChild(button('pol-chip gold badge', txt, guard(() => cb.onStart('practice', { day: p.day, friendCm: p.friendH }))));
  } else if (F) sub.appendChild(h('span', { class: 'pol-chip gold' }, fmt(S.lobby.friendBadge, { F })));
  else sub.appendChild(h('span', { class: 'lobby-subtitle' },
    n >= 1 ? fmt(S.lobby.subtitle, { n, m, d, trail }) : `${fmt(S.lobby.todayDate, { m, d })} · ${trail}`));
  const num = n >= 1 ? `${fmt(S.lobby.todayTitle, { n })} (${fmt(S.lobby.todayDate, { m, d })})`
    : `${fmt(S.lobby.todayTitle, { n: 1 })} (${fmt(S.lobby.todayDate, { m: 10, d: 1 })})`;
  const chip = n < 1 ? fmt(S.lobby.preLaunch, { dd: 1 - n })
    : k >= 3 ? fmt(S.lobby.todayDoneChip, { H: cm(rec.best ? rec.best.H : 0) }) : fmt(S.lobby.todayChip, { k });
  const [tc, tph, tcv] = card('card-today', 'today', num, wish, () => onToday());
  tph.appendChild(h('span', { class: 'pol-chip today-chip' }, chip));
  const [pc, , pcv] = card('card-practice', 'practice', S.lobby.practiceTitle, S.lobby.practiceCaption,
    e => openPractice(e.currentTarget, today));
  const [rc] = card('card-record', 'record', S.lobby.recordTitle,
    st.bestEver ? fmt(S.lobby.recordCaption, { best: cm(st.bestEver) }) : S.lobby.recordNone, e => openRecord(e.currentTarget, today));
  const [wt, wp] = short() ? [160, 130] : [190, 140];     // 사진 칸 = 카드 폭 − 10(§4 카드 높이 검산)
  paint(tcv, wt, set.stones.slice(0, 3), true);
  paint(pcv, wp, generate(0, today, 0).stones.slice(0, 5), false);
  const group = h('div', { class: 'pol-group', id: 'lobby-cards' });
  group.append(tc, pc, rc);
  const foot = h('footer', { class: 'foot' });             // T4a `#lobby .foot`·`.foot-2`(짧은 화면에서 숨김)
  foot.append(h('p', {}, fmt(S.lobby.footer1, { s: displayStreak(today), best: cm(st.bestEver) })),
    h('p', { class: 'foot-2' }, S.lobby.footer2));
  document.getElementById('lobby').replaceChildren(bar, sub, group, foot);
  shownAt = performance.now();
  void group.offsetWidth;                                  // 접힌 배치를 한 번 계산한 뒤 펼친다(300ms 지연·600ms는 doltap.css)
  group.classList.add('open');
}

// S3 — 오늘 돌 연습 · 지난 7일(D−1이 왼쪽 위, #N≥1만) · 랜덤 · 닫기
function openPractice(opener, today) {
  const [ov, dl] = shell('dlg-practice', S.lobby.practiceTitle), grid = h('div', { class: 'chips7' });
  let day = today;
  for (let i = 0; i < 7; i++) {
    day = prevDay(day);
    const n = nOf(day), { m, d } = md(day), target = day;
    if (n < 1) continue;
    const b = button('pol-chip', null, () => cb.onStart('practice', { day: target }), { 'aria-label': fmt(S.lobby.pastItem, { m, d, n }) });
    b.append(h('span', { class: 'md' }, `${m}/${d}`), h('span', { class: 'nn' }, `#${n}`));
    grid.appendChild(b);
  }
  dl.append(button('pol-btn-ghost', S.lobby.practiceToday, () => cb.onStart('practice', { day: today })), grid,
    button('pol-btn-ghost', S.lobby.practiceRandom, () => cb.onStart('random', {})),
    button('pol-btn-ghost', S.lobby.close, () => closeTop()));
  openDialog(ov, opener);
}

// S4 — 숫자 3개 · 오늘 기록 줄 · 저장 불가 안내 · 닫기
function openRecord(opener, today) {
  const st = load(), rec = st.days[today], [ov, dl] = shell('dlg-record', S.lobby.recordTitle);
  if (!persist()) dl.appendChild(h('p', { class: 'no-store' }, S.record.noStore));
  if (!st.bestEver && !(rec && rec.best)) dl.appendChild(h('p', { class: 'record-empty' }, S.record.empty));
  else {
    const hud = h('div', { class: 'pol-hud record-hud' });
    for (const t of [fmt(S.record.bestLine, { x: cm(st.bestEver) }), fmt(S.record.streakLine, { s: displayStreak(today) }),
      fmt(S.record.maxLine, { s: st.maxStreak || 0 })]) hud.appendChild(h('div', { class: 'pol-hud-value' }, t));
    dl.append(hud, h('p', { class: 'record-today' }, rec && rec.best
      ? fmt(S.record.todayLine, { H: cm(rec.best.H), left: rec.best.left, k: rec.tries }) : S.record.todayNone));
  }
  dl.appendChild(button('pol-btn-ghost', S.lobby.close, () => closeTop()));
  openDialog(ov, opener);
}

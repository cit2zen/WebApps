// wire.js — core 이벤트 구독의 유일한 자리(§6 분할 예비안, 레지스트리 E-1): hud·audio·haptic·저장 +
// game 콜백(카메라·깃발 = onHeight, 흙먼지·금가루 = burst, 결과 = onDone). game.js만 import한다
import * as hud from './hud.js';
import * as audio from './audio.js';
import * as storage from './storage.js';

// g = {set, mode, day, vibe, onAim(), onHeight({Y, H}), burst(kind, slot), onDone()}
// 페이로드는 core(B) 그대로: slot·next는 1-based Stone.i, holdTick {t}, body 없음
export function wire(R, g) {
  R.on('aim', p => {
    g.onAim();
    hud.preview(p.next.map(i => g.set.stones[i - 1]));
  });
  R.on('height', p => { g.onHeight(p); hud.height(p.H); });
  R.on('land', p => {
    const st = g.set.stones[p.slot - 1];
    audio.thud(st ? st.r : 34, p.combo);
    g.burst('dust', p.slot);
    if (g.vibe) audio.buzz(20);
  });
  R.on('fall', p => { hud.candles(p.candles); audio.rumble(); });
  R.on('perfect', p => { hud.combo(p.combo); g.burst('gold', p.slot); });
  R.on('combo0', () => hud.combo(0));
  R.on('milestone', () => audio.arpeggio());
  R.on('skip', () => hud.skipUsed());
  R.on('hold', () => { hud.hold(true); hud.count(3); audio.moktak(false); });
  R.on('holdTick', p => { hud.count(p.t); audio.moktak(false); });
  R.on('done', () => {
    audio.moktak(true);
    hud.count(null); hud.hold(false);
    g.onDone();
  });
  R.on('firstDrop', () => {
    if (g.mode === 'official') storage.bumpTries(g.day);
    hud.ghost(false);
    storage.set('tutDone', true);
  });
}

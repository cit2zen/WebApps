// 진입점 — 화면 전환과 버튼 연결
import { $, $$, showScreen } from './dom.js';
import { store } from './storage.js';
import { unlockAudio, setSoundEnabled, sfx } from './audio.js';
import { startPlay } from './play.js';
import { items, stageOf } from './data.js';
import { renderResult } from './result.js';
import { renderStages } from './stages.js';
import { renderDex } from './dex.js';
import { openHelp } from './explain.js';
import { toast } from './sheet.js';
import { dailySpec } from './daily.js';
import { reviewIds, dailyState } from './meta.js';
import { renderStickers } from './stickerbook.js';
import './lobby.js';
import './mascot.js';
import './music.js';
import './meta.js';

let lastRun = { mode: 'stage', stage: 1 };

function goLobby() { showScreen('lobby'); }

function goStages() {
  renderStages(play);
  showScreen('stages');
}

function goDex() {
  renderDex();
  showScreen('dex');
}

function goStickers() {
  renderStickers();
  showScreen('stickers');
}

/** 열린 가장 높은 단계(1~3) */
const topStage = () => [3, 2, 1].find((n) => store.isUnlocked(n)) || 1;

/** 숫자(1~3 단계, 4 무한) 또는 { mode, stage, ids?, daily? } → 시작할 판 */
function prepare(input) {
  const run = typeof input === 'number' ? { mode: input >= 4 ? 'endless' : 'stage', stage: input } : { ...input };
  if (run.mode === 'review') {
    run.ids = reviewIds(12);
    if (!run.ids.length) { toast('복습할 카드가 없어요. 잘했어요!'); return null; }
    const byId = new Map(items.map((it) => [it.id, it]));
    run.stage = Math.max(1, ...run.ids.map((id) => stageOf(byId.get(id))));
  }
  if (run.mode === 'daily') {
    if (!dailyState().unlocked) { toast(['1단계를 깨면 열려요.', '오늘의 도전은 1단계를 깬 뒤에 할 수 있어요.'], 2200); return null; }
    run.stage = topStage();
    run.daily = dailySpec();
  }
  return run;
}

function play(input) {
  const run = prepare(input);
  if (!run) return;
  lastRun = run;
  const legacy = run.mode === 'stage' || run.mode === 'endless';
  const ok = startPlay(legacy ? run.stage : run, {
    onEnd: (r) => { renderResult(r); showScreen('result'); },
    onExit: goLobby,
  });
  if (!ok) { toast('아직 이 판은 준비되지 않았어요.'); return; }
  showScreen('play');
}

function retry() {
  if (lastRun.mode === 'review' || lastRun.mode === 'daily') play({ mode: lastRun.mode });
  else play(lastRun.stage);
}

function renderSound() {
  const on = store.sound();
  const btn = $('#btn-sound');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? '🔊' : '🔇';
  btn.setAttribute('aria-label', on ? '소리 켜짐' : '소리 꺼짐');
  setSoundEnabled(on);
}

$('#btn-start').addEventListener('click', goStages);
$('#btn-daily').addEventListener('click', () => play({ mode: 'daily' }));
$('#btn-review').addEventListener('click', () => play({ mode: 'review' }));
$('#btn-dex').addEventListener('click', goDex);
$('#btn-stickers').addEventListener('click', goStickers);
$('#btn-title').addEventListener('click', goStickers);
$('#btn-help').addEventListener('click', () => openHelp());
$('#btn-sound').addEventListener('click', () => {
  store.setSound(!store.sound());
  renderSound();
  sfx('tap');
});
$('#btn-retry').addEventListener('click', retry);
$('#btn-next').addEventListener('click', () => play(Math.min(4, (lastRun.stage || 1) + 1)));
for (const b of $$('.js-home')) b.addEventListener('click', goLobby);
for (const b of $$('.js-dex')) b.addEventListener('click', goDex);

// 오디오는 첫 사용자 동작에서 생성
const unlock = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

renderSound();
goLobby();

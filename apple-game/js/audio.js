// 공유 AudioContext + 효과음/배경음 마스터 게인. sfx.js·bgm.js가 함께 사용.
let ctx = null;
let sfxGain = null;
let bgmGain = null;

export function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = ctx.createGain();
    bgmGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    bgmGain.gain.value = 0.18;
    sfxGain.connect(ctx.destination);
    bgmGain.connect(ctx.destination);
  }
  return ctx;
}

export const nodes = {
  get sfx() { getCtx(); return sfxGain; },
  get bgm() { getCtx(); return bgmGain; },
};

// 자동재생 정책 대응: 첫 사용자 입력에서 호출.
export function unlock() {
  const c = getCtx();
  if (c.state === "suspended") c.resume();
}

// 0~1 볼륨.
export function setSfxVolume(v) { nodes.sfx.gain.value = v; }
export function setBgmVolume(v) { nodes.bgm.gain.value = v; }

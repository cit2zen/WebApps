// 진동 — 지원 기기 + 소리 켜짐일 때만
import { on } from './events.js';
import { soundOn } from './audio.js';

/** pattern: ms 숫자 또는 [진동, 쉼, 진동…] */
export function buzz(pattern) {
  if (!soundOn() || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* 무시 */ }
}

on('wrong', () => buzz(70));
on('miss', () => buzz(40));
on('fever', ({ on: isOn }) => { if (isOn) buzz([30, 40, 30]); });
on('rush', ({ on: isOn }) => { if (isOn) buzz(50); });

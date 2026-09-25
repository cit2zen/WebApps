// rng.js — mulberry32 시드 난수(fx·fx_clear·render·debug 공용, §6)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let shared = mulberry32(1);
// 공용 스트림 재시드(__hanbut.seed(n))
export function seed(n) { shared = mulberry32(n); }
// 공용 스트림에서 [0,1) 1개
export function next() { return shared(); }

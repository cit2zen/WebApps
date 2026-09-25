// 캔버스 팔레트 — styles.css :root의 --yg-* 토큰(Polaroid 키트 토큰 참조)을 읽는다.
// 색 리터럴은 두지 않는다: 톤 변경은 CSS 토큰만 고치면 된다. 투명도는 ctx.globalAlpha로.
const css = getComputedStyle(document.documentElement);
const read = (name) => css.getPropertyValue(name).trim();

export const PAL = {
  skyTop: read("--yg-sky-top"),
  skyBot: read("--yg-sky-bot"),
  cloud: read("--yg-cloud"),
  grass: read("--yg-grass"),
  dirt: read("--yg-dirt"),
  dash: read("--yg-dash"),
  cactus: read("--yg-cactus"),
  cactusLine: read("--yg-cactus-line"),
  cactusSpot: read("--yg-cactus-spot"),
  cat: read("--yg-cat"),
  catDark: read("--yg-cat-dark"),
  catEar: read("--yg-cat-ear"),
  catBlush: read("--yg-cat-blush"),
  catEye: read("--yg-cat-eye"),
  catNose: read("--yg-cat-nose"),
  shadow: read("--yg-shadow"),
};

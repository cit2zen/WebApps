// 오프스크린 2레이어 파이프라인 — 전부 일반(source-over) 합성, 가산(lighter) 없음.
//  · wash  : 매 프레임 새로 그리는 넓은 안료 면(수채 로브·보케·코어·광선). 목표 알파를 그대로 쓴다.
//  · trail : 잔상이 남는 가는 선·티끌(멤브레인 링·파티클). destination-out으로 감쇠.
// 두 레이어를 half-res 가우시안 블러로 '종이에 번진 안료'를 만들어 아래에 옅게 깐 뒤 본체를 올린다.
// (크림 배경 위에서는 넓은 저알파 면을 잔상 버퍼에 누적하면 8비트 알파 반올림으로 얼룩이 남아
//  wash는 잔상 없이 그리고, trail도 감쇠율 하한을 둔다.)
const TRAIL_MIN_FADE = 0.13;

export class Bloom {
  constructor(scale = 0.5) {
    this.scale = scale;
    this.w = 0;
    this.h = 0;
    this.washC = document.createElement('canvas');
    this.wash = this.washC.getContext('2d');
    this.trailC = document.createElement('canvas');
    this.trail = this.trailC.getContext('2d');
    this.blur = document.createElement('canvas');
    this.bctx = this.blur.getContext('2d');
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    for (const c of [this.washC, this.trailC]) { c.width = w; c.height = h; }
    this.blur.width = Math.max(1, Math.floor(w * this.scale));
    this.blur.height = Math.max(1, Math.floor(h * this.scale));
  }

  // 프레임 시작: wash는 비우고, trail은 fade(0..1)만큼 알파를 깎아 꼬리를 남긴다.
  // 반환 fade = 실제 적용된 감쇠율(목표 농도 환산용).
  begin(fade) {
    const f = Math.max(TRAIL_MIN_FADE, Math.min(1, fade));
    const w = this.wash;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.globalCompositeOperation = 'source-over';
    w.clearRect(0, 0, this.w, this.h);
    const c = this.trail;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (f >= 1) {
      c.clearRect(0, 0, this.w, this.h);
    } else {
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = `rgba(0,0,0,${f})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    c.globalCompositeOperation = 'source-over';
    return f;
  }

  // 두 레이어를 target ctx(이미 종이 배경이 그려진)에 합성: 번진 워시(아래) + 선명한 본체(위).
  composite(ctx, radius, intensity) {
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, this.blur.width, this.blur.height);
    b.filter = `blur(${radius}px)`;
    b.drawImage(this.washC, 0, 0, this.blur.width, this.blur.height);
    b.drawImage(this.trailC, 0, 0, this.blur.width, this.blur.height);
    b.filter = 'none';

    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = intensity;
    ctx.drawImage(this.blur, 0, 0, this.blur.width, this.blur.height, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.washC, 0, 0, this.w, this.h);
    ctx.drawImage(this.trailC, 0, 0, this.w, this.h);
  }
}

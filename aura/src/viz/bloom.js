// 오프스크린 블룸 파이프라인. 발광 콘텐츠를 별도 버퍼에 그린 뒤
// half-res 가우시안 블러(ctx.filter)로 글로우를 만들어 additive 합성한다.
// shadowBlur 남발보다 빠르고, 화이트 블로우아웃 없이 부드러운 발광을 얻는다.
export class Bloom {
  constructor(scale = 0.5) {
    this.scale = scale;
    this.w = 0;
    this.h = 0;
    this.scene = document.createElement('canvas');
    this.sctx = this.scene.getContext('2d');
    this.blur = document.createElement('canvas');
    this.bctx = this.blur.getContext('2d');
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.scene.width = w;
    this.scene.height = h;
    this.blur.width = Math.max(1, Math.floor(w * this.scale));
    this.blur.height = Math.max(1, Math.floor(h * this.scale));
  }

  // 프레임 시작: 발광 버퍼를 trailing(잔상) 감쇠. fade=0..1 만큼 알파를 깎아 꼬리를 남긴다.
  // 반환된 ctx에 'lighter'로 발광 요소를 그린다.
  begin(fade) {
    const c = this.sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = `rgba(0,0,0,${fade})`;
    c.fillRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    return c;
  }

  // 발광 버퍼를 target ctx(이미 배경이 그려진)에 합성: 선명한 본체 + 블러 글로우.
  composite(ctx, radius, intensity) {
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, this.blur.width, this.blur.height);
    b.filter = `blur(${radius}px)`;
    b.drawImage(this.scene, 0, 0, this.blur.width, this.blur.height);
    b.filter = 'none';

    ctx.imageSmoothingEnabled = true;
    // 선명한 발광 본체 — source-over로 배경 위에 올린다(이중 가산 방지).
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.scene, 0, 0, this.w, this.h);
    // 부드러운 글로우만 additive로 더한다.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    ctx.drawImage(this.blur, 0, 0, this.blur.width, this.blur.height, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// input.js — keyboard handling with DAS/ARR auto-repeat

export function createInput(actions) {
  const DAS = 150; // delay before auto-repeat (ms)
  const ARR = 35;  // auto-repeat rate (ms)
  const SOFT = 40; // soft-drop repeat rate (ms)
  const mk = () => ({ held: false, charge: 0, das: false });
  const L = mk(), R = mk(), D = mk();
  let dt = 0;

  function press(s, fire, repeatNow) {
    if (s.held) return;
    s.held = true;
    s.charge = 0;
    s.das = !!repeatNow;
    fire();
  }

  function keydown(e) {
    switch (e.code) {
      case 'ArrowLeft': e.preventDefault(); press(L, actions.left); break;
      case 'ArrowRight': e.preventDefault(); press(R, actions.right); break;
      case 'ArrowDown': e.preventDefault(); press(D, actions.softDrop, true); break;
      case 'ArrowUp':
      case 'KeyX': e.preventDefault(); if (!e.repeat) actions.rotateCW(); break;
      case 'KeyZ': if (!e.repeat) actions.rotateCCW(); break;
      case 'Space': e.preventDefault(); if (!e.repeat) actions.hardDrop(); break;
      case 'KeyC': if (!e.repeat) actions.hold(); break;
      case 'KeyP': if (!e.repeat) actions.pause(); break;
      case 'KeyR': if (!e.repeat) actions.restart(); break;
      case 'KeyM': if (!e.repeat) actions.mute(); break;
    }
  }

  function keyup(e) {
    if (e.code === 'ArrowLeft') L.held = false;
    if (e.code === 'ArrowRight') R.held = false;
    if (e.code === 'ArrowDown') D.held = false;
  }

  function step(s, fire, rate) {
    if (!s.held) return;
    s.charge += dt;
    if (!s.das) {
      if (s.charge >= DAS) { s.das = true; s.charge -= DAS; fire(); }
    } else {
      while (s.charge >= rate) { s.charge -= rate; fire(); }
    }
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  // ── 터치/포인터 제스처 (모바일) ──
  // 보드 위 스와이프: 가로=한 칸 이동(누적), 아래 스와이프=하드드롭, 짧은 탭=회전.
  // step 좌표를 셀 크기에 비례시키지 않고 고정 임계로 환산해 기기 무관하게 동작.
  function bindTouch(el) {
    if (!el) return;
    const SWIPE = 26;   // 한 칸 이동으로 치는 가로 이동 픽셀
    const TAP_MOVE = 14; // 이보다 작게 움직이면 탭(회전)
    const TAP_MS = 220;  // 탭으로 인정하는 최대 시간
    const HARD = 42;     // 아래 하드드롭 임계
    let sx = 0, sy = 0, lastX = 0, t0 = 0, moved = false, dropped = false, id = null;

    el.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      sx = lastX = e.clientX; sy = e.clientY; t0 = performance.now();
      moved = false; dropped = false;
      if (el.setPointerCapture) try { el.setPointerCapture(id); } catch {}
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dyTotal = e.clientY - sy;
      if (Math.abs(e.clientX - sx) > TAP_MOVE || Math.abs(dyTotal) > TAP_MOVE) moved = true;
      // 가로 이동: SWIPE px마다 한 칸. lastX를 칸 경계로 끌어올려 누적 처리.
      while (e.clientX - lastX >= SWIPE) { actions.right(); lastX += SWIPE; }
      while (lastX - e.clientX >= SWIPE) { actions.left(); lastX -= SWIPE; }
      // 아래로 크게 스와이프: 하드드롭 1회
      if (!dropped && dyTotal > HARD && Math.abs(dyTotal) > Math.abs(e.clientX - sx)) {
        dropped = true; actions.hardDrop();
      }
    });
    function end(e) {
      if (e.pointerId !== id) return;
      const dt2 = performance.now() - t0;
      if (!moved && !dropped && dt2 < TAP_MS) actions.rotateCW();
      id = null;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // 보드 위 스크롤/줌 차단
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  return {
    bindTouch,
    update(frameDt) {
      dt = frameDt;
      step(L, actions.left, ARR);
      step(R, actions.right, ARR);
      step(D, actions.softDrop, SOFT);
    },
  };
}

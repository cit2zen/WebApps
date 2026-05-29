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

  return {
    update(frameDt) {
      dt = frameDt;
      step(L, actions.left, ARR);
      step(R, actions.right, ARR);
      step(D, actions.softDrop, SOFT);
    },
  };
}

/* cityzen-ui — Neon Arcade helpers. SOURCE OF TRUTH: WebApps/cityzen-ui.js
   사용: <link rel="stylesheet" href="/cityzen-ui.css">
        <script type="module">import {czFx,czHeader} from '/cityzen-ui.js';
          czFx(); czHeader({title:'Neon Tetris'});</script> */
export function czFx(target){
  const host = target || document.body;
  if (host.querySelector(':scope > .cz-fx')) return;
  const fx = document.createElement('div');
  fx.className = 'cz-fx';
  fx.innerHTML =
    '<div class="cz-orbs"><div class="cz-orb o1"></div><div class="cz-orb o2"></div><div class="cz-orb o3"></div></div>'+
    '<div class="cz-grid"></div><div class="cz-scan"></div>';
  host.prepend(fx);
}
export function czHeader({title='', hudId='', backHref='https://cityzen.kr'}={}){
  if (document.querySelector('.cz-gamehead')) return;
  const h = document.createElement('header');
  h.className = 'cz-gamehead';
  // back link (static), title via textContent (defensive against injection), optional hud slot
  const back = document.createElement('a');
  back.className = 'cz-back'; back.href = backHref; back.textContent = '← cityzen';
  const gt = document.createElement('span');
  gt.className = 'cz-gt'; gt.textContent = title;
  h.append(back, gt);
  if (hudId){
    const hud = document.createElement('span');
    hud.className = 'cz-hud'; hud.id = hudId;
    h.append(hud);
  }
  document.body.prepend(h);
  return h;
}

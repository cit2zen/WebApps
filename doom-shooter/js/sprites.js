import * as THREE from 'three';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Detailed front-facing imp, 256px, transparent.
export function makeEnemyTexture() {
  const [c, x] = makeCanvas(256);
  x.clearRect(0, 0, 256, 256);
  x.lineJoin = 'round';
  const outline = (w = 5) => { x.lineWidth = w; x.strokeStyle = '#180502'; };

  // shadow under feet
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.beginPath(); x.ellipse(128, 244, 56, 12, 0, 0, 7); x.fill();

  // legs
  x.fillStyle = '#5a1f12';
  x.fillRect(86, 188, 30, 56); x.fillRect(140, 188, 30, 56);
  outline(); x.strokeRect(86, 188, 30, 56); x.strokeRect(140, 188, 30, 56);
  // hooves
  x.fillStyle = '#1c100a'; x.fillRect(84, 236, 34, 12); x.fillRect(138, 236, 34, 12);

  // torso with vertical shading
  const tg = x.createLinearGradient(64, 100, 192, 100);
  tg.addColorStop(0, '#5e1f10'); tg.addColorStop(0.5, '#8c3018'); tg.addColorStop(1, '#5e1f10');
  x.fillStyle = tg;
  x.beginPath();
  x.moveTo(74, 102); x.lineTo(182, 102); x.lineTo(196, 198); x.lineTo(60, 198); x.closePath();
  x.fill(); outline(); x.stroke();
  // ab muscle lines
  x.strokeStyle = 'rgba(40,8,4,.5)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(128, 116); x.lineTo(128, 188); x.stroke();
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(96, 130 + i * 20); x.lineTo(160, 130 + i * 20); x.stroke(); }
  // chest highlight
  x.fillStyle = 'rgba(200,90,50,.5)'; x.fillRect(108, 110, 40, 26);

  // arms
  x.fillStyle = '#6a2414';
  x.fillRect(40, 104, 30, 86); x.fillRect(186, 104, 30, 86);
  outline(); x.strokeRect(40, 104, 30, 86); x.strokeRect(186, 104, 30, 86);
  // claws
  x.fillStyle = '#e8d8a0';
  for (let i = 0; i < 3; i++) {
    x.beginPath(); x.moveTo(40 + i * 11, 188); x.lineTo(45 + i * 11, 204); x.lineTo(50 + i * 11, 188); x.fill();
    x.beginPath(); x.moveTo(186 + i * 11, 188); x.lineTo(191 + i * 11, 204); x.lineTo(196 + i * 11, 188); x.fill();
  }

  // head
  const hg = x.createRadialGradient(118, 66, 6, 128, 76, 48);
  hg.addColorStop(0, '#a83a1e'); hg.addColorStop(1, '#702612');
  x.fillStyle = hg;
  x.beginPath(); x.arc(128, 76, 46, 0, 7); x.fill(); outline(); x.stroke();
  // brow ridge
  x.fillStyle = '#5e2010'; x.beginPath();
  x.moveTo(86, 64); x.quadraticCurveTo(128, 50, 170, 64); x.lineTo(168, 76); x.quadraticCurveTo(128, 64, 88, 76); x.fill();
  // horns
  x.fillStyle = '#caa84a';
  x.beginPath(); x.moveTo(90, 46); x.quadraticCurveTo(64, 14, 72, 6); x.quadraticCurveTo(96, 24, 108, 44); x.fill(); outline(4); x.stroke();
  x.beginPath(); x.moveTo(166, 46); x.quadraticCurveTo(192, 14, 184, 6); x.quadraticCurveTo(160, 24, 148, 44); x.fill(); x.stroke();
  // glowing eyes
  for (const ex of [108, 148]) {
    const eg = x.createRadialGradient(ex, 78, 1, ex, 78, 13);
    eg.addColorStop(0, '#fffbe0'); eg.addColorStop(0.4, '#ffe000'); eg.addColorStop(1, 'rgba(255,120,0,0)');
    x.fillStyle = eg; x.beginPath(); x.arc(ex, 78, 13, 0, 7); x.fill();
    x.fillStyle = '#1a0a00'; x.fillRect(ex - 3, 74, 6, 9);
  }
  // mouth + fangs
  x.fillStyle = '#2a0804';
  x.beginPath(); x.moveTo(100, 100); x.quadraticCurveTo(128, 114, 156, 100); x.quadraticCurveTo(128, 108, 100, 100); x.fill();
  x.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(104 + i * 10, 100); x.lineTo(109 + i * 10, 112); x.lineTo(114 + i * 10, 100); x.fill(); }
  // drool
  x.fillStyle = 'rgba(200,255,180,.5)'; x.fillRect(124, 110, 4, 16);
  return new THREE.CanvasTexture(c);
}

// Detailed pistol viewmodel as data URL.
export function makeGunDataURL() {
  const [c, x] = makeCanvas(256);
  x.clearRect(0, 0, 256, 256);
  // hands / forearm
  const hg = x.createLinearGradient(96, 150, 96, 256);
  hg.addColorStop(0, '#d8a878'); hg.addColorStop(1, '#a87848');
  x.fillStyle = hg; x.fillRect(92, 150, 72, 106);
  x.fillStyle = '#b88858'; x.fillRect(150, 166, 40, 90);
  // finger lines
  x.strokeStyle = 'rgba(80,40,20,.5)'; x.lineWidth = 2;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(150, 184 + i * 22); x.lineTo(188, 184 + i * 22); x.stroke(); }

  // grip
  const gg = x.createLinearGradient(106, 120, 152, 120);
  gg.addColorStop(0, '#1a1a20'); gg.addColorStop(1, '#33333c'); x.fillStyle = gg;
  x.fillRect(106, 118, 48, 84);
  x.fillStyle = 'rgba(0,0,0,.4)'; // checkering
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(110 + i * 7, 126 + j * 8, 4, 4);

  // slide / body
  const bg = x.createLinearGradient(0, 92, 0, 140);
  bg.addColorStop(0, '#4a4a56'); bg.addColorStop(0.5, '#33333d'); bg.addColorStop(1, '#202028');
  x.fillStyle = bg; x.fillRect(92, 90, 104, 44);
  // slide serrations
  x.fillStyle = 'rgba(0,0,0,.45)';
  for (let i = 0; i < 5; i++) x.fillRect(170 + i * 5, 96, 3, 32);
  // barrel
  x.fillStyle = '#23232a'; x.fillRect(118, 32, 32, 64);
  x.fillStyle = '#0e0e12'; x.beginPath(); x.arc(134, 34, 11, 0, 7); x.fill();
  // hammer
  x.fillStyle = '#15151a'; x.fillRect(96, 80, 14, 14);
  // sights
  x.fillStyle = '#666'; x.fillRect(120, 84, 8, 8); x.fillRect(182, 84, 8, 8);
  // highlights / shadows
  x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(94, 92, 100, 4); x.fillRect(120, 34, 5, 60);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(92, 128, 104, 6); x.fillRect(144, 34, 6, 60);
  return c.toDataURL();
}

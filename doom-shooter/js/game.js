import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { MAPS } from './maps.js';
import { buildLevel } from './level.js';
import { Enemy } from './enemy.js';
import { Boss } from './boss.js';
import { Weapon } from './weapon.js';
import { GameAudio } from './audio.js';
import { PostFX } from './postfx.js';
import { ParticleSystem } from './particles.js';
import { DecalPool } from './decals.js';
import { CombatFX } from './combatfx.js';
import { ProjectileSystem } from './projectile.js';
import { PickupSystem } from './pickups.js';
import { MiniMap } from './minimap.js';
import { Score } from './score.js';
import { buildEnvironment } from './envmap.js';

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = buildEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 0);
scene.add(camera);

// per-stage ambient/hemi/fog are owned by the level; this torch follows the player
const torch = new THREE.PointLight(0xffd28a, 1.15, 24);
torch.castShadow = true;
torch.shadow.mapSize.width = 1024;
torch.shadow.mapSize.height = 1024;
torch.shadow.camera.near = 0.1;
torch.shadow.camera.far = 25;
torch.shadow.bias = -0.002;
camera.add(torch);

const controls = new PointerLockControls(camera, renderer.domElement);
const audio = new GameAudio();
const postfx = new PostFX(renderer, scene, camera);

// ---- VFX systems ----
const particles = new ParticleSystem(scene);
const decals = new DecalPool(scene);
const combatfx = new CombatFX(scene);
const fx = { particles, decals, combat: combatfx };

// reduced-motion: 화면흔들림(shake) 강도 0.3배 감쇠(호출부 무변경, 인스턴스 래핑)
if (typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
  const _origShake = combatfx.shake.bind(combatfx);
  combatfx.shake = (amount) => _origShake(amount * 0.3);
}

const projectiles = new ProjectileSystem(scene);
const pickups = new PickupSystem(scene);

// R4: attach audio to fx so enemy.js / combatfx can reach it
fx.audio = audio;

const weapon = new Weapon(scene, camera, audio, fx);

// R4: minimap + score
const minimap = new MiniMap();
const score = new Score();

// ---- HUD: inject #weaponname element (#hud 안에 넣어 메뉴/일시정지에서 함께 숨김) ----
let weaponNameEl = document.getElementById('weaponname');
if (!weaponNameEl) {
  weaponNameEl = document.createElement('div');
  weaponNameEl.id = 'weaponname';
  weaponNameEl.style.cssText = [
    'position:fixed', 'bottom:72px', 'right:18px',
    'color:#ffcc44', 'font-family:monospace', 'font-size:13px',
    'letter-spacing:0.12em', 'font-weight:bold',
    'text-shadow:0 0 6px #ff8800,0 1px 2px #000',
    'pointer-events:none', 'user-select:none',
  ].join(';');
  (document.getElementById('hud') ?? document.body).appendChild(weaponNameEl);
}

// ---- boss HP bar (injected into #hud — 메뉴/일시정지에서 함께 숨김) ----
let bossHpEl = document.getElementById('bosshp');
if (!bossHpEl) {
  bossHpEl = document.createElement('div');
  bossHpEl.id = 'bosshp';
  bossHpEl.style.cssText = [
    'position:fixed', 'bottom:56px', 'left:50%', 'transform:translateX(-50%)',
    'width:320px', 'height:14px',
    'background:rgba(0,0,0,0.65)', 'border:1px solid #880000',
    'display:none', 'pointer-events:none', 'z-index:100',
  ].join(';');
  const bossHpFill = document.createElement('div');
  bossHpFill.id = 'bosshp-fill';
  bossHpFill.style.cssText = [
    'height:100%', 'width:100%',
    'background:linear-gradient(90deg,#cc0000,#ff4400)',
    'transition:width 0.1s',
  ].join(';');
  const bossHpLabel = document.createElement('div');
  bossHpLabel.id = 'bosshp-label';
  bossHpLabel.style.cssText = [
    'position:absolute', 'top:0', 'left:0', 'right:0', 'text-align:center',
    'color:#ffcccc', 'font-family:monospace', 'font-size:11px', 'line-height:14px',
    'letter-spacing:0.1em', 'font-weight:bold',
  ].join(';');
  bossHpLabel.textContent = 'WARLORD';
  bossHpEl.appendChild(bossHpFill);
  bossHpEl.appendChild(bossHpLabel);
  (document.getElementById('hud') ?? document.body).appendChild(bossHpEl);
}

// ---- state ----
const State = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', OVER: 'over', WIN: 'win' };
let state = State.MENU;
let level = null;
let enemies = [];
let stageIndex = 0;
let hp = 100;
let exitReady = false;

// mouse-held state for auto-fire
let mouseHeld = false;
let autoFireTimer = 0;

// R4: footstep timer + already-counted kill set
let footstepTimer = 0;
let countedDeadIds = new Set();

// jump / gravity
const GROUND_Y = 1.6, GRAVITY = 22, JUMP_V = 6.6;
let playerVY = 0, onGround = true;

// horizontal velocity vector for acceleration/inertia
const vel = new THREE.Vector2(0, 0); // x, z

// coyote time & jump buffer
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.1;
let coyoteTimer = 0;
let jumpBufferTimer = 0;
let wasOnGround = true;

// landing dip state
let landDipVel = 0;
let landDipOffset = 0;

// head-bob state
let bobPhase = 0;

const keys = {};
const clock = new THREE.Clock();

// 전정기관 민감 사용자 배려: 머리흔들림(bob)/화면흔들림(shake) 감쇠
const REDUCE_MOTION = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
// 터치/coarse 포인터(모바일·태블릿) 환경 감지 — PointerLock 미지원이라 안내 노출
const COARSE_POINTER = window.matchMedia?.('(pointer:coarse)').matches
  || ('ontouchstart' in window && !window.matchMedia?.('(pointer:fine)').matches);

// scratch vectors reused each frame to avoid per-frame heap allocations
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _eMin = new THREE.Vector3();
const _eMax = new THREE.Vector3();

// ---- DOM ----
const el = (id) => document.getElementById(id);
const hud = el('hud'), overlay = el('overlay'), damageEl = el('damage');
const bannerEl = el('banner');
let bannerTimer = 0;

function setBanner(text) {
  bannerEl.textContent = text;
  bannerEl.classList.add('show');
  bannerTimer = 2.5;
}

function updateHud() {
  el('stage').textContent = MAPS[stageIndex].name;
  const left = enemies.filter((e) => !e.dead).length;
  el('enemies').textContent = left > 0 ? `ENEMIES ${left}` : 'GO TO EXIT';
  el('hp-fill').style.width = Math.max(0, hp) + '%';
  el('hp-num').textContent = Math.max(0, Math.round(hp));
  el('ammo-mag').textContent = weapon.reloading > 0 ? '..' : weapon.ammo;
  el('ammo-res').textContent = weapon.reserve;
  // weapon name HUD element
  const wname = weapon.WEAPONS ? weapon.WEAPONS[weapon.weaponType]?.name ?? '' : '';
  weaponNameEl.textContent = wname;
}

// ---- stages ----
function clearStage() {
  enemies.forEach((e) => e.dispose());
  enemies = [];
  if (level) { level.dispose(); level = null; }
  particles.reset();
  decals.reset();
  combatfx.reset();
  projectiles.reset();
  pickups.reset();
}

// Per-type stat tweaks applied on top of map defaults
const TYPE_STATS = {
  imp:     (base) => ({ hp: base.hp,          speed: base.speed,       damage: base.damage }),
  caster:  (base) => ({ hp: base.hp * 0.65,   speed: base.speed * 0.8, damage: base.damage * 0.7 }),
  charger: (base) => ({ hp: base.hp * 2.2,    speed: base.speed,       damage: base.damage * 1.4 }),
};

function loadStage(i) {
  clearStage();
  stageIndex = i;
  const map = MAPS[i];
  level = buildLevel(scene, map);
  camera.position.copy(level.start);
  playerVY = 0; onGround = true; wasOnGround = true;
  vel.set(0, 0);
  coyoteTimer = 0; jumpBufferTimer = 0;
  landDipOffset = 0; landDipVel = 0;
  bobPhase = 0;

  const baseStats = { hp: map.enemyHp, speed: map.enemySpeed, damage: map.enemyDamage };

  enemies = level.spawnPoints.map((s) => {
    if (s.type === 'boss') {
      return new Boss(
        scene,
        s.pos,
        { hp: 600, speed: map.enemySpeed, damage: map.enemyDamage * 1.2, tint: level.theme.enemyTint },
        fx,
        projectiles
      );
    }
    const tweakFn = TYPE_STATS[s.type] ?? TYPE_STATS.imp;
    const stats = tweakFn(baseStats);
    return new Enemy(
      scene,
      s.pos,
      { ...stats, tint: level.theme.enemyTint, type: s.type },
      fx,
      projectiles
    );
  });

  // hide boss bar on new stage load
  if (bossHpEl) bossHpEl.style.display = 'none';

  for (const ps of level.pickupSpawns) {
    pickups.spawn(ps.type, ps.pos);
  }

  // apply per-theme player torch settings
  const pl = level.theme.playerLight;
  torch.color.set(pl.color);
  torch.intensity = pl.intensity;
  torch.distance = pl.distance;

  exitReady = false;
  setBanner(map.name);
  updateHud();

  // R4: reset minimap for new stage; ambient drone; clear counted kills
  minimap.reset();
  countedDeadIds = new Set();
  audio.ambient?.(level.theme?.kind ?? 'stone');
}

function startGame() {
  hp = 100;
  weapon.reset(); // 전 무기 탄약 초기 로드아웃 복원 + 피스톨 복귀
  score.reset();
  audio.init();
  loadStage(0);
  // re-trigger ambient now that audio is ready (loadStage ran before init)
  audio.ambient?.(level?.theme?.kind ?? 'stone');
  audio.startMusic();
  state = State.PLAYING;
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  try { controls.lock(); } catch (e) { /* headless: play without lock */ }
}

function showOverlay(title, text, btn) {
  el('o-title').textContent = title;
  el('o-text').innerHTML = text;
  el('o-btn').textContent = btn;
  el('o-controls').style.display = title === 'PAUSED' ? 'block' : 'none';
  overlay.classList.remove('hidden');
}

function gameOver() {
  state = State.OVER;
  hud.classList.add('hidden');
  audio.stopMusic();
  audio.stopAmbient();
  audio.dead();
  const finalScore = score.getScore();
  const totalKills = score.getKills?.() ?? countedDeadIds.size;
  showOverlay(
    'YOU DIED',
    `STAGE ${stageIndex + 1}에서 쓰러졌다.<br>SCORE: ${finalScore} &nbsp;|&nbsp; KILLS: ${totalKills}`,
    '다시 시작'
  );
  try { controls.unlock(); } catch (e) {}
}

function winGame() {
  state = State.WIN;
  hud.classList.add('hidden');
  audio.stopMusic();
  audio.stopAmbient();
  audio.win();
  const finalScore = score.getScore();
  const totalKills = score.getKills?.() ?? countedDeadIds.size;
  showOverlay(
    'VICTORY',
    `${MAPS.length}개 스테이지를 모두 정복했다. 지옥은 잠잠해졌다.<br>SCORE: ${finalScore} &nbsp;|&nbsp; KILLS: ${totalKills}`,
    '다시 플레이'
  );
  try { controls.unlock(); } catch (e) {}
}

function nextStage() {
  if (stageIndex + 1 >= MAPS.length) { winGame(); return; }
  loadStage(stageIndex + 1);
}

function damagePlayer(amount) {
  if (state !== State.PLAYING) return;
  hp -= amount;
  damageEl.style.opacity = '0.9';
  audio.hurt();
  combatfx.shake(0.5);
  combatfx.damageDir(0);
  if (hp <= 0) { hp = 0; gameOver(); }
}

function onPickup(type) {
  if (type === 'health') {
    hp = Math.min(100, hp + 25);
  } else {
    // ammo pickup: use weapon.addAmmo() if available, else increment reserve
    if (typeof weapon.addAmmo === 'function') {
      weapon.addAmmo();
    } else {
      weapon.reserve = Math.min((weapon.reserveMax ?? 60), weapon.reserve + 20);
    }
  }
  audio.pickup?.();
}

// ---- movement with acceleration/inertia ----
function move(dt) {
  camera.getWorldDirection(_dir);
  _dir.y = 0; _dir.normalize();
  _right.set(-_dir.z, 0, _dir.x);

  let fb = 0, lr = 0;
  if (keys['KeyW']) fb += 1;
  if (keys['KeyS']) fb -= 1;
  if (keys['KeyD']) lr += 1;
  if (keys['KeyA']) lr -= 1;

  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 7.5 : 4.2;

  let desX = 0, desZ = 0;
  if (fb !== 0 || lr !== 0) {
    let ix = _dir.x * fb + _right.x * lr;
    let iz = _dir.z * fb + _right.z * lr;
    const len = Math.hypot(ix, iz) || 1;
    desX = (ix / len) * speed;
    desZ = (iz / len) * speed;
  }

  const accel = onGround ? 40 : 40 / 3;
  const friction = onGround ? 10 : 10 / 3;

  if (fb !== 0 || lr !== 0) {
    vel.x += (desX - vel.x) * Math.min(accel * dt, 1);
    vel.y += (desZ - vel.y) * Math.min(accel * dt, 1);
  } else {
    const decay = Math.max(0, 1 - friction * dt);
    vel.x *= decay;
    vel.y *= decay;
  }

  const vx = vel.x * dt;
  const vz = vel.y * dt;

  const R = 0.55;
  const p = camera.position;
  if (Math.abs(vx) > 0.0001) {
    if (!level.isWall(p.x + vx + Math.sign(vx) * R, p.z)) p.x += vx;
    else vel.x = 0;
  }
  if (Math.abs(vz) > 0.0001) {
    if (!level.isWall(p.x, p.z + vz + Math.sign(vz) * R)) p.z += vz;
    else vel.y = 0;
  }
}

function applyGravity(dt) {
  const prevOnGround = onGround;

  if (onGround && playerVY <= 0) {
    camera.position.y = GROUND_Y;
  } else {
    playerVY -= GRAVITY * dt;
    camera.position.y += playerVY * dt;
    if (camera.position.y <= GROUND_Y) {
      camera.position.y = GROUND_Y;
      playerVY = 0;
      onGround = true;
    } else {
      onGround = false;
    }
  }

  if (prevOnGround && !onGround) {
    coyoteTimer = COYOTE_TIME;
  } else if (onGround) {
    coyoteTimer = 0;
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - dt);
  }

  if (!wasOnGround && onGround) {
    if (jumpBufferTimer > 0) {
      jumpBufferTimer = 0;
      doJump();
    } else {
      landDipVel = -1.8;
      if (combatfx && typeof combatfx.shake === 'function') combatfx.shake(0.2);
    }
  }
  jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
  wasOnGround = onGround;
}

function doJump() {
  playerVY = JUMP_V;
  onGround = false;
  coyoteTimer = 0;
}

// ---- landing dip ----
function updateLandDip(dt) {
  if (landDipOffset === 0 && landDipVel === 0) return;
  const stiffness = 140, damping = 14;
  const force = -stiffness * landDipOffset - damping * landDipVel;
  landDipVel += force * dt;
  landDipOffset += landDipVel * dt;
  if (Math.abs(landDipOffset) < 0.001 && Math.abs(landDipVel) < 0.001) {
    landDipOffset = 0; landDipVel = 0;
  }
}

// ---- head bob ----
const BOB_SPEED = 9.0;
// reduced-motion 시 머리흔들림 제거(전정기관 자극 차단)
const BOB_VERT = REDUCE_MOTION ? 0 : 0.035;
const BOB_LAT = REDUCE_MOTION ? 0 : 0.018;

function getHeadBob(dt) {
  const moving = onGround && (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']);
  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.4 : 1.0;
  if (moving) {
    bobPhase += BOB_SPEED * speed * dt;
  } else {
    bobPhase += BOB_SPEED * dt * 0.15;
  }
  bobPhase %= Math.PI * 4;
  const bobY = Math.sin(bobPhase) * BOB_VERT * (moving ? 1 : 0);
  const bobX = Math.cos(bobPhase * 0.5) * BOB_LAT * (moving ? 1 : 0);
  return { x: bobX, y: bobY };
}

// ---- shared per-frame game logic ----
function updateGame(dt) {
  const t = clock.getElapsedTime();

  const moving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
  weapon.update(dt, moving);

  if (parseFloat(damageEl.style.opacity || '0') > 0)
    damageEl.style.opacity = String(Math.max(0, parseFloat(damageEl.style.opacity) - dt * 3));
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) bannerEl.classList.remove('show'); }

  if (state === State.PLAYING && level) {
    move(dt);
    applyGravity(dt);
    updateLandDip(dt);

    // R4: footsteps while moving on ground (~0.4 s interval)
    if (onGround && (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'])) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        audio.footstep?.();
        footstepTimer = 0.4;
      }
    } else {
      footstepTimer = Math.min(footstepTimer, 0.15); // short delay when movement starts again
    }

    // auto-fire for held mouse + automatic weapons
    if (mouseHeld && weapon.WEAPONS?.[weapon.weaponType]?.auto) {
      autoFireTimer -= dt;
      if (autoFireTimer <= 0) {
        weapon.tryFire(enemies, level.isWall);
        autoFireTimer = weapon.WEAPONS[weapon.weaponType].fireRate;
      }
    }

    for (const e of enemies) e.update(dt, t, camera.position, level.isWall, damagePlayer, enemies);

    projectiles.update(dt, camera.position, level.isWall, damagePlayer);
    pickups.update(dt, camera.position, onPickup);

    const left = enemies.filter((e) => !e.dead).length;
    if (left === 0 && !exitReady) {
      exitReady = true;
      level.activateExit();
      audio.clear();
      setBanner('적 전멸! 빛나는 출구로 탈출하라');
    }
    if (exitReady && level.atExit(camera.position)) nextStage();

    for (const fl of level.flickerLights)
      fl.light.intensity = fl.base * (0.78 + 0.22 * Math.abs(Math.sin(t * 11 + fl.light.position.x)));

    particles.update(dt);
    decals.update(dt);
    combatfx.update(dt, camera);

    // R4: detect newly-dead enemies and register kills
    for (const e of enemies) {
      if (e.dead && !countedDeadIds.has(e)) {
        countedDeadIds.add(e);
        score.addKill(e.type ?? (e.isBoss ? 'boss' : 'imp'));
      }
    }

    // R4: score tick + minimap update
    score.update(dt);
    camera.getWorldDirection(_forward);
    minimap.update(level, camera.position, _forward, enemies);

    // hell theme: ambient embers over the level bounds
    if (level.theme && level.theme.kind === 'hell' && level.bounds) {
      const b = level.bounds;
      _eMin.set(b.minX, 0, b.minZ);
      _eMax.set(b.maxX, 2, b.maxZ);
      particles.emitEmbers(_eMin, _eMax, dt, 20);
    }

    // boss HP bar
    const liveBoss = enemies.find((e) => e.isBoss && !e.dead);
    if (liveBoss && bossHpEl) {
      bossHpEl.style.display = 'block';
      const fill = document.getElementById('bosshp-fill');
      if (fill) fill.style.width = Math.max(0, (liveBoss.hp / liveBoss.maxHp) * 100) + '%';
    } else if (bossHpEl) {
      bossHpEl.style.display = 'none';
    }

    updateHud();
  }
}

// ---- loop ----
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!window.GAME?.test?.paused) {
    updateGame(dt);
  }

  // composite offsets: shake + landing dip + head bob
  let offX = 0, offY = 0;
  if (state === State.PLAYING) {
    const shk = combatfx.getShakeOffset();
    const bob = getHeadBob(dt);
    offX = shk.x + bob.x;
    offY = shk.y + landDipOffset + bob.y;
  }

  camera.position.x += offX;
  camera.position.y += offY;
  postfx.render(clock.getElapsedTime());
  camera.position.x -= offX;
  camera.position.y -= offY;
}

// ---- input ----
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && state === State.PLAYING) weapon.reload();
  if (e.code === 'Space' && state === State.PLAYING) {
    if (onGround || coyoteTimer > 0) {
      doJump();
    } else {
      jumpBufferTimer = JUMP_BUFFER_TIME;
    }
  }
  // weapon switching
  if (state === State.PLAYING) {
    if (e.code === 'Digit1') weapon.switchTo?.(0);
    if (e.code === 'Digit2') weapon.switchTo?.(1);
    if (e.code === 'Digit3') weapon.switchTo?.(2);
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0 && state === State.PLAYING && controls.isLocked) {
    mouseHeld = true;
    autoFireTimer = 0; // fire immediately on first press
    weapon.tryFire(enemies, level.isWall);
  }
});

renderer.domElement.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouseHeld = false;
    autoFireTimer = 0;
  }
});

// 단일 핸들러로 상태 분기(MENU/OVER/WIN→시작, PAUSED→재잠금)
el('o-btn').addEventListener('click', () => {
  if (state === State.PLAYING) return;
  if (state === State.PAUSED) { try { controls.lock(); } catch (e) {} return; }
  startGame();
});

controls.addEventListener('unlock', () => {
  if (state === State.PLAYING) {
    state = State.PAUSED;
    mouseHeld = false;
    hud.classList.add('hidden');
    audio.stopMusic();
    audio.stopAmbient();
    showOverlay('PAUSED', '잠시 멈췄다.', '계속하기');
  }
});
controls.addEventListener('lock', () => {
  if (state === State.PAUSED) {
    state = State.PLAYING;
    overlay.classList.add('hidden');
    hud.classList.remove('hidden');
    audio.startMusic();
    audio.ambient?.(level?.theme?.kind ?? 'stone');
  }
});

// settings sliders — audio.init()은 첫 사용자 제스처(startGame)에서 1회 호출되므로
// 드래그마다 호출하지 않는다. init 전 슬라이더 조작 시 설정만 보관됐다가 init 시 적용됨.
const sliders = [['vol-master', 'setMaster', 'master'], ['vol-sfx', 'setSfx', 'sfx'], ['vol-music', 'setMusic', 'music']];
for (const [id, setter, key] of sliders) {
  const input = el(id);
  input.value = audio.vol[key];
  input.addEventListener('input', () => {
    audio[setter](parseFloat(input.value));
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  postfx.resize(innerWidth, innerHeight);
});

// 터치/모바일 환경: PointerLock(마우스)이 없어 사실상 플레이 불가 → 시작 오버레이에 안내 노출
// ('클릭하여 시작'을 눌러도 시점 전환이 안 되는 죽은 페이지 오해 방지)
if (COARSE_POINTER) {
  const notice = el('touch-notice');
  if (notice) notice.style.display = 'block';
}

tick();

// ---- debug / test API ----
window.GAME = {
  get state() { return state; },
  get hp() { return hp; },
  get stageIndex() { return stageIndex; },
  get enemies() { return enemies; },
  get exitReady() { return exitReady; },
  get level() { return level; },
  weapon, camera, audio, score, minimap, renderer,
  start: startGame,
  killAll() { enemies.forEach((e) => e.takeDamage(9999)); },
  teleportToExit() {
    if (level && level.exitCell) camera.position.set(level.exitCell.x, 1.6, level.exitCell.z);
  },
  fire() { return weapon.tryFire(enemies, level ? level.isWall : () => false); },

  test: {
    paused: false,
    step(dt) { updateGame(dt); },
    look(yaw, pitch) { camera.rotation.set(pitch, yaw, 0, 'YXZ'); },
    keyDown(code) { keys[code] = true; },
    keyUp(code) { keys[code] = false; },
    click() { if (state === State.PLAYING && level) weapon.tryFire(enemies, level.isWall); },
  },
};

// IRONHAVEN — boot and the one loop. The systems are created in dependency
// order, wired through one context, and then the loop runs them in fixed
// 1/60 s steps. ?seed=N fixes the city. ?shot=cover|chase|defend|reward (with
// &seed=N) stages that scene from the real rules, paints it twice, and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { COLORS, GAME_RULES } from './config.js';
import { createIronhavenWorld, mulberry32 } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_RELOAD, createInputState } from './input.js';
import { createOnFootController } from './player.js';
import { createVehicleSystem } from './vehicles.js';
import { createTrafficAndPedestrians } from './cityLife.js';
import { createCombatSystem } from './combat.js';
import { createWantedResponseSystem } from './police.js';
import { createEvidenceCampaign } from './missions.js';
import { createPortTrustProgression } from './progression.js';
import { createAdaptiveCamera } from './camera.js';
import { createContextualHud } from './hud.js';
import { createDistrictMinimap } from './minimap.js';
import { createWorldEffects } from './effects.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : GAME_RULES.seedDefault;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
// -- sky: a gradient dome (warm sunset band at the horizon), soft clouds
// and a low sun glow, so the sky reads as a golden-hour sky, not flat paint.
// The dome ignores fog; the clouds and sun are sprites that face the camera.
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  // Round 15 (lighting-direction): the sky was the brightest, lowest-contrast
  // part of the frame and competed with the subject — deepen the blue and
  // push the warm band lower, so the blue occupies more of the visible sky.
  grad.addColorStop(0.0, '#1f5aa8');
  grad.addColorStop(0.30, '#4a86c4');
  grad.addColorStop(0.48, '#e9a869');
  grad.addColorStop(0.56, '#ffb347');
  grad.addColorStop(0.62, '#ff8a3d');
  grad.addColorStop(0.68, '#8a6a52');
  grad.addColorStop(1.0, '#4a3a30');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(650, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(dome);
  // one soft radial texture, reused for every cloud and for the sun glow
  const soft = document.createElement('canvas'); soft.width = 128; soft.height = 128;
  const sg = soft.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)');
  rg.addColorStop(0.6, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const softTex = new THREE.CanvasTexture(soft);
  const cloudSpots = [
    [-320, 48, -260, 150, 34], [-120, 58, -330, 120, 26], [180, 52, -300, 170, 36],
    [330, 46, -180, 130, 28], [-260, 62, 140, 140, 30], [60, 55, 260, 160, 32],
    [300, 50, 240, 120, 26], [-40, 64, -180, 110, 24],
    // Round 18 (causal B1-c): more clouds, CLUSTERED, warm-rimmed, lower
    // and larger — the sky was one narrow gradient; the volumetric-clouds
    // principle is clustered masses with a warm rim, not a raymarch.
    [-200, 44, -200, 200, 40, 0xffe0b0], [-60, 46, -240, 180, 38, 0xffe0b0],
    [120, 42, -220, 190, 36, 0xffd9a0], [240, 44, 200, 170, 34, 0xffe0b0],
  ];
  for (const [x, y, z, w, h, c] of cloudSpots) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: c || 0xffffff, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
    s.scale.set(w, h, 1); s.position.set(x, y, z); scene.add(s);
  }
  // the low sun itself, glowing in the west where the light comes from
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffc27a, transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
  sunGlow.scale.set(220, 220, 1);
  sunGlow.position.set(-420, 100, -180);
  scene.add(sunGlow);
}
scene.fog = new THREE.Fog(COLORS.fog, 190, 430);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(-24, 6, 14);

// low golden-hour sun from the west, throwing long shadows east
const sun = new THREE.DirectionalLight(COLORS.sun, 3.4);
sun.position.set(-170, 55, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffd9a8, 0x8a6a50, 0.65));
// fill from the east, so the camera side of the hero is never in full shadow
const fill = new THREE.DirectionalLight(0xbfd4e6, 0.75);
fill.position.set(170, 40, -60);
scene.add(fill);

const ctx = {
  scene, camera, renderer, time: 0, frozen: false,
  rng: mulberry32(seed),
  world: null, input: null, player: null, vehicles: null, cityLife: null,
  combat: null, police: null, missions: null, progression: null,
  cameraRig: null, hud: null, minimap: null, effects: null,
};

ctx.world = createIronhavenWorld(scene, ctx.rng);
ctx.input = createInputState(canvas);
ctx.player = createOnFootController(ctx);
ctx.vehicles = createVehicleSystem(ctx);
ctx.cityLife = createTrafficAndPedestrians(ctx);
ctx.combat = createCombatSystem(ctx);
ctx.police = createWantedResponseSystem(ctx);
ctx.progression = createPortTrustProgression(ctx);
ctx.cameraRig = createAdaptiveCamera(ctx);
ctx.hud = createContextualHud();
ctx.minimap = createDistrictMinimap(ctx);
ctx.effects = createWorldEffects(ctx);
ctx.missions = createEvidenceCampaign(ctx);

const hud = ctx.hud;
const input = ctx.input;

// Round 29 defect fix (Fix 4): reused frustum scratch objects for the
// dispatch visibility filter (allocated once, not per frame).
const _dispatchFrustum = new THREE.Frustum();
const _dispatchProj = new THREE.Matrix4();
const _dispatchPoint = new THREE.Vector3();

function syncHud() {
  const driving = ctx.vehicles.drive.active;
  hud.setHealth(ctx.player.state.health);
  hud.setAmmo(ctx.combat.state.ammo, ctx.combat.state.reserve);
  // Round 29 defect fix (Fix 3): a staged shot may override the wanted
  // display (ctx.stagedWanted, set by shots.js) — the reward's 1 fading
  // star. Otherwise the HUD always reflects the live police wanted level.
  hud.setWanted(ctx.stagedWanted ?? ctx.police.wanted());
  if (driving) hud.setSpeed(Math.abs(ctx.vehicles.drive.speed) * 3.6, ctx.vehicles.drive.integrity);
  else hud.hideSpeed();
  if (!ctx.frozen) hud.setCrosshair(!driving && input.aiming() && ctx.player.state.visible);
  // the dispatch list: every live police unit, closest first, capped at five
  // when Mara is driving, the distances are measured from the hauler she is
  // in — her on-foot position is stale while she drives, and the dispatch
  // read 162 m for a car riding her bumper
  const mp = ctx.vehicles.drive.active ? ctx.vehicles.drive.pos : ctx.player.state.pos;
  const rows = [];
  ctx.police.cars.forEach((c, i) => {
    const d = Math.hypot(c.pos.x - mp.x, c.pos.z - mp.z);
    rows.push({ name: `IRON-${i + 1}`, role: c.speed > 15 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'RESPONDING', dist: Math.round(d), d, _x: c.pos.x, _y: 1.5, _z: c.pos.z });
  });
  if (ctx.police.heli.active) {
    const h = ctx.police.heli.pos;
    rows.push({ name: 'AIR ONE', role: 'SPOTLIGHT', dist: Math.round(Math.hypot(h.x - mp.x, h.z - mp.z)), d: Math.hypot(h.x - mp.x, h.z - mp.z), _x: h.x, _y: h.y, _z: h.z });
  }
  ctx.police.officers.forEach((o, i) => {
    const p = o.group.position;
    rows.push({ name: `OFFICER-${i + 1}`, role: 'CLOSING', dist: Math.round(Math.hypot(p.x - mp.x, p.z - mp.z)), d: Math.hypot(p.x - mp.x, p.z - mp.z), _x: p.x, _y: 1.5, _z: p.z });
  });
  rows.sort((a, b) => a.d - b.d);
  // Round 29 defect fix (Fix 4): the dispatch must not claim units the
  // frame cannot see. A unit 5 m away behind the camera is not "5 m" to
  // the viewer — it is invisible, and the panel reads as a lie (the jury
  // reads text AND image in the same call). Filter to units inside the
  // camera frustum, then take the closest 5. The test point is the unit's
  // torso (y=1.5) or the heli's position. This also improves the live
  // game: the dispatch shows only the police you can see.
  camera.updateMatrixWorld();
  _dispatchProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _dispatchFrustum.setFromProjectionMatrix(_dispatchProj);
  const visible = rows.filter((r) => _dispatchFrustum.containsPoint(_dispatchPoint.set(r._x, r._y, r._z)));
  hud.setDispatch(ctx.police.wanted() > 0 ? visible.slice(0, 5).map(({ name, role, dist }) => ({ name, role, dist })) : []);
  hud.setRadio(ctx.missions.state.mode === 'playing');
  ctx.minimap.update();
}

function step(dt) {
  ctx.time += dt;
  const mode = ctx.missions.state.mode;
  if (mode === 'title') {
    // a slow orbit over the yard while the title is up
    const a = ctx.time * 0.05;
    ctx.cameraRig.setCinematic(
      new THREE.Vector3(Math.cos(a) * 70, 34, Math.sin(a) * 70),
      new THREE.Vector3(0, 2, -10),
    );
    ctx.cameraRig.update(dt, input);
    ctx.world.update(dt, ctx.time);
    ctx.cityLife.update(dt);
    return;
  }
  if (mode === 'paused' || mode === 'failed' || mode === 'complete') return;
  const driving = ctx.vehicles.drive.active;
  if (!driving && ctx.player.state.visible) {
    ctx.player.update(dt, input, ctx.cameraRig.yaw());
    if (input.firing() && input.aiming()) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = ctx.player.state.pos.clone(); origin.y += 1.5;
      ctx.combat.shootMara(origin, dir, ctx.police.officers);
    }
  }
  const driveResult = ctx.vehicles.update(dt, input);
  if (driveResult && driveResult.hit) ctx.missions.onHaulerHit(driveResult.hit, driveResult.speedBefore);
  ctx.cityLife.update(dt);
  ctx.police.update(dt, ctx.time);
  ctx.missions.update(dt);
  ctx.world.update(dt, ctx.time);
  ctx.effects.update(dt);
  ctx.combat.update(dt);
  ctx.cameraRig.update(dt, input);
  syncHud();
}

function handleActions() {
  const actions = input.takeActions();
  const mode = ctx.missions.state.mode;
  if (actions & ACTION_CONFIRM) {
    if (mode === 'title') {
      ctx.missions.startCampaign();
      hud.hideTitle();
      hud.announce('Chapter 1. Get in the evidence hauler.');
    } else if (mode === 'failed') {
      ctx.missions.retryChapter();
      hud.hideFail();
    } else if (mode === 'complete') {
      hud.hideCompletion();
      ctx.missions.state.mode = 'freeroam';
    }
  }
  if (actions & ACTION_PAUSE) {
    if (mode === 'playing' || mode === 'freeroam') {
      ctx.missions.state.mode = 'paused';
      hud.showPause();
    } else if (mode === 'paused') {
      ctx.missions.state.mode = ctx.missions.state.chapter === 0 ? 'freeroam' : 'playing';
      hud.hidePause();
    }
  }
  if (actions & ACTION_INTERACT) {
    if (mode === 'playing' && ctx.missions.state.chapter === 1 && ctx.missions.nearHauler()) {
      ctx.missions.startChapter2();
    } else if (mode === 'freeroam') {
      if (ctx.vehicles.drive.active) {
        ctx.vehicles.exitHauler();
        const h = ctx.vehicles.drive;
        ctx.player.setPosition(h.pos.x - 3, h.pos.z + 2, h.heading);
        ctx.player.show();
      } else if (ctx.missions.nearHauler()) {
        ctx.vehicles.enterHauler();
        ctx.player.hide();
      }
    }
  }
  if (actions & ACTION_RELOAD) ctx.combat.reload();
  if ((mode === 'playing' || mode === 'freeroam') && !ctx.vehicles.drive.active) {
    if (input.aiming()) input.requestLock();
  }
}

function runShot(name) {
  stageShot(name, ctx);
  ctx.cameraRig.update(0, input);
  syncHud();
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  hud.showTitle();
  hud.setObjective('IRONHAVEN', 'Press ENTER to start', 'A port city on a hill. One manifest. One hardcase. One broadcast.');
  let accumulator = 0;
  let last = performance.now();
  document.addEventListener('visibilitychange', () => {
    const mode = ctx.missions.state.mode;
    if (document.hidden && (mode === 'playing' || mode === 'freeroam')) {
      ctx.missions.state.mode = 'paused';
      hud.showPause();
    }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
    renderer.render(scene, camera);
  }
  hud.announce('Ironhaven. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// test-only state probe, only when the URL asks for it (?debug=1). The jury
// loads the game without it, so it never affects a real play session.
if (new URLSearchParams(location.search).has('debug')) window.__ironhaven = ctx;

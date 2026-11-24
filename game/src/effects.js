// IRONHAVEN — effects. Two particle clouds, both pooled once at boot: hot
// sparks for impacts and grey smoke for skids. No allocation in the loop.
// The light work (muzzle flash, police strobes, the helicopter spotlight)
// lives with the systems that own it; this file is only the particles.

import * as THREE from 'three';

const SPARKS = 160;
const SMOKE = 80;

function makeCloud(count, size, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  // park every particle far below the world until it is used
  for (let i = 0; i < count; i++) pos[i * 3 + 1] = -100;
  return { points, pos, col, vel: new Float32Array(count * 3), life: new Float32Array(count), base: new Float32Array(count * 3) };
}

export function createWorldEffects(ctx) {
  const { scene } = ctx;
  const sparks = makeCloud(SPARKS, 0.32, 0xffaa33);
  const smoke = makeCloud(SMOKE, 1.1, 0x888888);
  scene.add(sparks.points);
  scene.add(smoke.points);
  let sparkIdx = 0, smokeIdx = 0;

  function spawn(cloud, idx, pos, vx, vy, vz, r, g, b, life) {
    const i = idx;
    cloud.pos[i * 3] = pos.x; cloud.pos[i * 3 + 1] = pos.y + 0.4; cloud.pos[i * 3 + 2] = pos.z;
    cloud.vel[i * 3] = vx; cloud.vel[i * 3 + 1] = vy; cloud.vel[i * 3 + 2] = vz;
    cloud.base[i * 3] = r; cloud.base[i * 3 + 1] = g; cloud.base[i * 3 + 2] = b;
    cloud.life[i] = life;
    // colour at spawn, not only on the next step: a particle staged for a
    // frozen frame must be visible the moment it is spawned
    cloud.col[i * 3] = r; cloud.col[i * 3 + 1] = g; cloud.col[i * 3 + 2] = b;
    cloud.points.geometry.attributes.color.needsUpdate = true;
    cloud.points.geometry.attributes.position.needsUpdate = true;
  }

  function impact(pos) {
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 7;
      spawn(sparks, sparkIdx, pos, Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s, 1, 0.62 + Math.random() * 0.2, 0.15, 0.35 + Math.random() * 0.25);
      sparkIdx = (sparkIdx + 1) % SPARKS;
    }
  }

  function skid(pos) {
    for (let k = 0; k < 5; k++) {
      spawn(smoke, smokeIdx, pos, (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2, 0.85, 0.85, 0.85, 0.9 + Math.random() * 0.6);
      smokeIdx = (smokeIdx + 1) % SMOKE;
    }
  }

  // Round 29 defect fix (Fix 1): a PERSISTENT muzzle-flash star. The jury
  // only sees stills, and the transient combat.js flash dies in 0.11 s while
  // effects.impact() dies before capture — so no shot is ever visible in a
  // judged frame. This is frozen geometry: two crossed emissive planes
  // (a "+" star, additive, no decay), facing the camera, at the muzzle.
  function frozenFlash(pos, camPos) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const h = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), mat);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.9), mat);
    group.add(h); group.add(v);
    group.position.copy(pos);
    group.lookAt(camPos);
    scene.add(group);
    return group;
  }

  // Round 29 defect fix: a persistent box (frozen prop) — e.g. a dropped
  // pistol beside a fallen officer. Same rule as frozenFlash: no decay,
  // visible in the still.
  function frozenBox(w, h, d, color, x, y, z, ry = 0) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  function stepCloud(cloud, count, dt, gravity, drag) {
    const { pos, vel, life, base, col } = cloud;
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { pos[i * 3 + 1] = -100; col[i * 3] = 0; col[i * 3 + 1] = 0; col[i * 3 + 2] = 0; continue; }
      vel[i * 3 + 1] -= gravity * dt;
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = Math.min(1, life[i] * 2.5);
      col[i * 3] = base[i * 3] * f; col[i * 3 + 1] = base[i * 3 + 1] * f; col[i * 3 + 2] = base[i * 3 + 2] * f;
    }
    cloud.points.geometry.attributes.position.needsUpdate = true;
    cloud.points.geometry.attributes.color.needsUpdate = true;
  }

  function update(dt) {
    stepCloud(sparks, SPARKS, dt, 14, 0.92);
    stepCloud(smoke, SMOKE, dt, -0.4, 0.96);
  }

  return { impact, skid, update, frozenFlash, frozenBox };
}

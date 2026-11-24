// IRONHAVEN — combat. Hitscan only: no projectiles to simulate, no bullet
// drop to tune. A shot is a ray from the shooter; it hits the first officer
// sphere or the first obstacle box in its path, or nothing. Mara's pistol
// holds 12 rounds and reloads on R. Every shot shows a muzzle flash and a
// tracer that fades, so the player always sees where the shot went.

import * as THREE from 'three';
import { GAME_RULES } from './config.js';

// distance along ray origin->dir where it first enters the sphere, or -1
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}

// distance along the ray where it first enters the box, or -1
function rayBox(ox, oy, oz, dx, dy, dz, o) {
  let tmin = 0, tmax = Infinity;
  const mins = [o.minX, 0, o.minZ], maxs = [o.maxX, 30, o.maxZ];
  const org = [ox, oy, oz], dir = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (org[i] < mins[i] || org[i] > maxs[i]) return -1;
    } else {
      let t1 = (mins[i] - org[i]) / dir[i];
      let t2 = (maxs[i] - org[i]) / dir[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function createCombatSystem(ctx) {
  const { scene, world } = ctx;
  const tracers = [];
  for (let i = 0; i < 12; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0 }));
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  const muzzle = new THREE.PointLight(0xffd27a, 0, 18, 1.6);
  scene.add(muzzle);
  const muzzleSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(muzzleSprite);

  let tracerIdx = 0;
  function fireTracer(from, to) {
    const t = tracers[tracerIdx++ % tracers.length];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.opacity = 0.9;
    t.life = 0.09;
  }
  function flash(at, dir) {
    muzzle.position.copy(at);
    muzzle.intensity = 14;
    muzzleSprite.position.copy(at).addScaledVector(dir, 0.5);
    muzzleSprite.material.opacity = 0.95;
    muzzleSprite.lookAt(at.clone().addScaledVector(dir, 2));
  }

  function nearestObstacleDist(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    for (const o of world.obstacles) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, o);
      if (t >= 0 && t < best) best = t;
    }
    return best;
  }

  const state = {
    ammo: GAME_RULES.pistolAmmo, reserve: GAME_RULES.pistolReserve,
    reloading: 0, cooldown: 0,
  };

  // Mara's shot, from the camera through the crosshair. Returns the officer hit, or null.
  function shootMara(origin, dir, officers) {
    if (state.cooldown > 0 || state.reloading > 0) return null;
    if (state.ammo <= 0) { state.reloading = 1.1; return null; }
    state.ammo -= 1;
    state.cooldown = 0.28;
    flash(origin, dir);
    let bestDist = GAME_RULES.pistolRange;
    let hit = null;
    for (const off of officers) {
      if (!off.alive) continue;
      const p = off.group.position;
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, p.x, p.y + 1.1, p.z, 0.7);
      if (t >= 0 && t < bestDist) { bestDist = t; hit = off; }
    }
    const wallDist = nearestObstacleDist(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, bestDist);
    const endDist = Math.min(bestDist, wallDist);
    const end = origin.clone().addScaledVector(dir, endDist);
    fireTracer(origin, end);
    if (hit && bestDist <= wallDist) {
      hit.health -= GAME_RULES.pistolDamage;
      if (hit.health <= 0) { hit.alive = false; hit.group.rotation.x = -Math.PI / 2; hit.group.position.y = 0.4; }
      return hit;
    }
    return null;
  }

  // An officer's shot at Mara. Hit chance falls with distance; a wall blocks it.
  function shootOfficer(officer, targetPos) {
    const from = officer.group.position.clone(); from.y += 1.4;
    const to = targetPos.clone(); to.y += 1.2;
    const dir = to.clone().sub(from).normalize();
    const dist = from.distanceTo(to);
    flash(from, dir);
    const wallDist = nearestObstacleDist(from.x, from.y, from.z, dir.x, dir.y, dir.z, dist);
    fireTracer(from, wallDist < dist ? from.clone().addScaledVector(dir, wallDist) : to);
    if (wallDist >= dist && dist < GAME_RULES.officerRange) {
      const chance = Math.max(0.2, 0.65 - dist * 0.012);
      return ctx.rng() < chance;
    }
    return false;
  }

  function reload() {
    if (state.reloading > 0 || state.ammo === GAME_RULES.pistolAmmo || state.reserve === 0) return;
    state.reloading = 1.1;
  }

  function update(dt) {
    if (state.cooldown > 0) state.cooldown -= dt;
    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) {
        const need = GAME_RULES.pistolAmmo - state.ammo;
        const take = Math.min(need, state.reserve);
        state.ammo += take; state.reserve -= take;
      }
    }
    muzzle.intensity = Math.max(0, muzzle.intensity - dt * 90);
    muzzleSprite.material.opacity = Math.max(0, muzzleSprite.material.opacity - dt * 9);
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      }
    }
  }

  return { state, shootMara, shootOfficer, reload, update };
}

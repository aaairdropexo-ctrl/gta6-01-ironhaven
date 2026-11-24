// IRONHAVEN — Mara on foot. A low-poly figure built from boxes: rust jacket,
// dark trousers, dark hair, a small pack. She moves relative to the camera,
// sprints on Shift, slows to a walk when aiming, and collides with the city's
// obstacle boxes by circle-vs-box push-out. The figure's legs swing and the
// body bobs so the walk reads at a glance.

import * as THREE from 'three';
import { COLORS, GAME_RULES } from './config.js';

function collideCircle(pos, radius, obstacles) {
  for (const o of obstacles) {
    const cx = Math.max(o.minX, Math.min(pos.x, o.maxX));
    const cz = Math.max(o.minZ, Math.min(pos.z, o.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // degenerate case: Mara is exactly on the box's closest point, so
        // there is no direction to push along — push her out along +X.
        pos.x = o.maxX + radius;
      }
    }
  }
}

export function createOnFootController(ctx) {
  const { scene, world } = ctx;
  const group = new THREE.Group();
  const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const part = (w, h, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z); m.castShadow = true; group.add(m); return m;
  };
  // torso, head, hair, arms, legs, pack — the whole figure is nine boxes.
  const torso = part(0.62, 0.72, 0.34, COLORS.maraJacket, 0, 1.12, 0);
  part(0.34, 0.34, 0.32, COLORS.maraSkin, 0, 1.66, 0);
  part(0.38, 0.16, 0.36, COLORS.maraHair, 0, 1.84, 0);
  part(0.4, 0.1, 0.38, COLORS.maraHair, 0, 1.8, -0.06);
  const armL = part(0.16, 0.62, 0.2, COLORS.maraJacket, -0.4, 1.12, 0);
  const armR = part(0.16, 0.62, 0.2, COLORS.maraJacket, 0.4, 1.12, 0);
  const legL = part(0.22, 0.72, 0.24, COLORS.maraPants, -0.16, 0.36, 0);
  const legR = part(0.22, 0.72, 0.24, COLORS.maraPants, 0.16, 0.36, 0);
  part(0.4, 0.5, 0.18, 0x3a3e45, 0, 1.14, -0.26);
  // the pistol, held in the right hand when aiming
  const pistol = part(0.07, 0.12, 0.3, 0x1a1a1a, 0.42, 1.05, 0.2);
  pistol.visible = false;
  scene.add(group);

  const state = {
    pos: new THREE.Vector3(-14, 0, 6),
    heading: Math.PI / 2, // facing east, toward the hauler
    health: GAME_RULES.playerHealth,
    speed: 0, moving: false, aiming: false,
    walkPhase: 0, visible: true, invulnerable: 0,
  };

  function setPosition(x, z, heading) {
    state.pos.set(x, world.heightAt(x, z), z);
    if (heading !== undefined) state.heading = heading;
    group.position.copy(state.pos);
    group.rotation.y = state.heading;
  }

  function update(dt, input, cameraYaw) {
    if (!state.visible) return;
    const mv = input.move();
    const aiming = input.aiming();
    state.aiming = aiming;
    pistol.visible = aiming;
    const speed = aiming ? GAME_RULES.aimSpeed : mv.sprint ? GAME_RULES.sprintSpeed : GAME_RULES.walkSpeed;
    // movement is relative to the camera's yaw
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    const fx = -sin, fz = -cos; // camera looks along -Z rotated by yaw
    const rx = -fz, rz = fx;
    const mx = fx * mv.forward + rx * mv.strafe;
    const mz = fz * mv.forward + rz * mv.strafe;
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.01;
    if (state.moving) {
      const nx = mx / len, nz = mz / len;
      state.pos.x += nx * speed * dt;
      state.pos.z += nz * speed * dt;
      state.speed = speed;
      // face the direction of travel, or the aim direction when aiming
      const target = aiming ? cameraYaw + Math.PI : Math.atan2(nx, nz);
      let diff = target - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += diff * Math.min(1, dt * 12);
      state.walkPhase += dt * speed * 1.6;
    } else {
      state.speed = 0;
    }
    // stay inside the world and out of obstacles
    state.pos.x = Math.max(GAME_RULES.world.minX + 2, Math.min(GAME_RULES.world.maxX - 2, state.pos.x));
    state.pos.z = Math.max(GAME_RULES.world.minZ + 2, Math.min(GAME_RULES.world.maxZ - 2, state.pos.z));
    collideCircle(state.pos, GAME_RULES.playerRadius, world.obstacles);
    state.pos.y = world.heightAt(state.pos.x, state.pos.z);
    if (state.invulnerable > 0) state.invulnerable -= dt;
    // walk cycle: legs swing, arms counter-swing, body bobs
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.55 : 0;
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = aiming ? -1.2 : swing * 0.8;
    group.position.copy(state.pos);
    group.position.y += state.moving ? Math.abs(Math.sin(state.walkPhase)) * 0.05 : 0;
    group.rotation.y = state.heading;
    group.visible = state.visible;
  }

  function takeDamage(amount) {
    if (state.invulnerable > 0 || !state.visible) return false;
    state.health -= amount;
    state.invulnerable = 0.6;
    return state.health <= 0;
  }

  function heal(amount) {
    state.health = Math.min(GAME_RULES.playerHealth, state.health + amount);
  }

  function hide() { state.visible = false; group.visible = false; }
  function show() { state.visible = true; group.visible = true; }

  setPosition(-14, 6, Math.PI / 2);
  return { group, state, legL, legR, armL, armR, pistol, setPosition, update, takeDamage, heal, hide, show };
}

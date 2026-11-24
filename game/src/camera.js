// IRONHAVEN — the camera. One camera, three distances: on foot it rides
// behind Mara's shoulder, aiming pulls it in close over her shoulder, driving
// lifts it high behind the hauler. It never cuts — it glides between modes —
// and impacts shake it briefly. The cover shot uses a fixed cinematic
// position, so the frame is composed, not caught mid-glide.

import * as THREE from 'three';
import { GAME_RULES } from './config.js';

export function createAdaptiveCamera(ctx) {
  const { camera } = ctx;
  let yaw = -Math.PI / 2; // the camera looks east at boot (toward the hauler)
  let pitch = 0.22;
  let mode = 'foot';
  let shake = 0;
  let cinematic = null;
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const current = new THREE.Vector3(-24, 6, 14);
  const currentLook = new THREE.Vector3(-8, 1.5, 0);

  function setMode(m) { mode = m; }
  function addShake(amount) { shake = Math.min(0.9, shake + amount); }
  function setCinematic(pos, look) {
    cinematic = { pos: pos.clone(), look: look.clone() };
  }
  function clearCinematic() { cinematic = null; }

  function update(dt, input) {
    if (cinematic) {
      camera.position.copy(cinematic.pos);
      camera.lookAt(cinematic.look);
      return { yaw, pitch };
    }
    const mouse = input.takeMouse();
    yaw -= mouse.dx * 0.0028;
    pitch = Math.max(-0.15, Math.min(0.55, pitch + mouse.dy * 0.0022));
    const driving = ctx.vehicles.drive.active;
    const aiming = input.aiming() && !driving;
    const targetMode = driving ? 'drive' : aiming ? 'aim' : 'foot';
    if (targetMode !== mode) mode = targetMode;

    const dist = mode === 'drive' ? GAME_RULES.driveDistance : mode === 'aim' ? GAME_RULES.aimDistance : GAME_RULES.footDistance;
    const height = mode === 'drive' ? GAME_RULES.driveHeight : GAME_RULES.footHeight;
    const focus = driving ? ctx.vehicles.drive.pos : ctx.player.state.pos;
    const fx = focus.x, fy = focus.y, fz = focus.z;
    desired.set(
      fx + Math.sin(yaw) * dist * Math.cos(pitch),
      fy + height + Math.sin(pitch) * dist,
      fz + Math.cos(yaw) * dist * Math.cos(pitch),
    );
    // keep the camera out of the ground on the hill
    const ground = ctx.world.heightAt(desired.x, desired.z);
    desired.y = Math.max(desired.y, ground + 0.7);
    const k = 1 - Math.exp(-dt * (mode === 'drive' ? 5 : 8));
    current.lerp(desired, k);
    lookAt.set(fx, fy + 1.6, fz);
    currentLook.lerp(lookAt, 1 - Math.exp(-dt * 10));
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.2);
      const s = shake * shake * 0.5;
      current.x += (Math.random() - 0.5) * s;
      current.y += (Math.random() - 0.5) * s;
      currentLook.x += (Math.random() - 0.5) * s * 0.5;
    }
    camera.position.copy(current);
    camera.lookAt(currentLook);
    return { yaw, pitch };
  }

  return { yaw: () => yaw, setMode, addShake, setCinematic, clearCinematic, update };
}

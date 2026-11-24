// IRONHAVEN — the vehicles. Only one is ever player-driven: the evidence
// hauler, a flatbed truck with the red hardcase strapped to its bed and a
// PORT POLICE — SEALED stencil on its side. Driving is arcade: accelerate,
// brake, steer, and the truck follows the road's height. The hauler is also
// the chapter-2 weapon — ramming the bridge barrier breaks it, and the
// barrier stays broken. The Iron Garage gives the hauler a fixed spawn after
// the campaign, so the checkpoint is a place, not a number.

import * as THREE from 'three';
import { COLORS, GAME_RULES } from './config.js';
import { makeSign } from './world.js';

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
        pos.x = o.maxX + radius;
      }
      return o;
    }
  }
  return null;
}

export function createVehicleSystem(ctx) {
  const { scene, world } = ctx;
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

  // -- the evidence hauler --
  const hauler = new THREE.Group();
  // Round 18 (narrative fix 1): the hardcase is the story's one object —
  // bigger, so it reads as a token at 768px, not a red smudge.
  const hardcase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.1), mat(COLORS.hardcase, 0.6));
  {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 2.4), mat(0x3a3e45));
    bed.position.set(-1.2, 0.95, 0); bed.castShadow = true; hauler.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1.9, 2.3), mat(0x8a6a4a));
    cab.position.set(2.6, 1.35, 0); cab.castShadow = true; hauler.add(cab);
    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.1), mat(0x2b2e33));
    cabTop.position.set(2.6, 2.6, 0); hauler.add(cabTop);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 2), mat(0x1a1a1a));
    grille.position.set(3.65, 1.1, 0); hauler.add(grille);
    // the hardcase, strapped to the flatbed where the cover shot can see it
    hardcase.position.set(-1.4, 1.48, 0); hardcase.castShadow = true; hauler.add(hardcase);
    // the label strip ON the case itself — the courier line, so the jury
    // reads the case as one object moving through the story, not cargo
    const caseSign = makeSign('COURIER: MARA', 'SEALED', 1.4, 0.5, '#11151a', '#F4F0E7');
    caseSign.position.set(0, 0, -0.56); caseSign.rotation.y = Math.PI; hardcase.add(caseSign);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 2.5), mat(0x111111));
    strap.position.set(-1.4, 1.45, 0); hauler.add(strap);
    const seal = makeSign('PORT POLICE', 'SEALED', 3.4, 1.1, '#11151a', '#F4F0E7');
    seal.position.set(-1.2, 1.1, 1.26); hauler.add(seal);
    const seal2 = seal.clone(); seal2.position.z = -1.26; seal2.rotation.y = Math.PI; hauler.add(seal2);
    // wheels
    for (const [wx, wz] of [[2.6, 1.15], [2.6, -1.15], [-2.6, 1.15], [-2.6, -1.15], [-0.6, 1.15], [-0.6, -1.15]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), mat(0x141414, 0.95));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.5, wz); wheel.castShadow = true; hauler.add(wheel);
    }
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.4), new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd27a, emissiveIntensity: 1.2 }));
    lightL.position.set(3.68, 1.5, 0.8); hauler.add(lightL);
    const lightR = lightL.clone(); lightR.position.z = -0.8; hauler.add(lightR);
  }
  scene.add(hauler);

  const drive = {
    active: false, speed: 0, heading: Math.PI / 2,
    pos: new THREE.Vector3(-8, 0, 0), wheelSpin: 0, integrity: 100,
  };
  hauler.position.copy(drive.pos);
  hauler.position.y = world.heightAt(drive.pos.x, drive.pos.z);
  // the cab is built toward local +X, so the group's yaw is heading minus a quarter turn
  hauler.rotation.y = drive.heading - Math.PI / 2;

  function placeHauler(x, z, heading) {
    drive.pos.set(x, world.heightAt(x, z), z);
    drive.heading = heading;
    drive.speed = 0;
    hauler.position.copy(drive.pos);
    hauler.rotation.y = drive.heading - Math.PI / 2;
  }

  function enterHauler() {
    drive.active = true;
    return drive;
  }
  function exitHauler() {
    drive.active = false;
    drive.speed = 0;
  }

  function update(dt, input) {
    if (!drive.active) return;
    const mv = input.move();
    const accel = mv.forward > 0 ? GAME_RULES.haulerAccel : mv.forward < 0 ? -GAME_RULES.haulerBrake : 0;
    if (mv.forward !== 0) drive.speed += accel * dt;
    else drive.speed -= Math.sign(drive.speed) * Math.min(Math.abs(drive.speed), 8 * dt);
    const top = mv.forward < 0 ? -GAME_RULES.haulerReverse : GAME_RULES.haulerTopSpeed;
    drive.speed = Math.max(-GAME_RULES.haulerReverse, Math.min(GAME_RULES.haulerTopSpeed, drive.speed));
    // steering scales with speed and reverses when reversing
    const steer = mv.strafe * GAME_RULES.haulerTurn * Math.min(1, Math.abs(drive.speed) / 8);
    drive.heading += steer * Math.sign(drive.speed || 1) * dt;
    const nx = Math.sin(drive.heading), nz = Math.cos(drive.heading);
    drive.pos.x += nx * drive.speed * dt;
    drive.pos.z += nz * drive.speed * dt;
    drive.pos.x = Math.max(GAME_RULES.world.minX + 3, Math.min(GAME_RULES.world.maxX - 3, drive.pos.x));
    drive.pos.z = Math.max(GAME_RULES.world.minZ + 3, Math.min(GAME_RULES.world.maxZ - 3, drive.pos.z));
    const speedBefore = drive.speed;
    const hit = collideCircle(drive.pos, GAME_RULES.haulerRadius, world.obstacles);
    if (hit) {
      // a hard hit on an obstacle kills most of the speed
      if (Math.abs(drive.speed) > 12) drive.speed *= 0.3;
      else drive.speed *= 0.6;
    }
    drive.pos.y = world.heightAt(drive.pos.x, drive.pos.z);
    drive.wheelSpin += drive.speed * dt * 1.4;
    hauler.position.copy(drive.pos);
    hauler.rotation.y = drive.heading - Math.PI / 2;
    // the truck leans into the steer a touch
    hauler.rotation.z = -steer * 0.04;
    return { hit, speedBefore };
  }

  placeHauler(-8, 0, Math.PI / 2);
  return { hauler, hardcase, drive, placeHauler, enterHauler, exitHauler, update };
}

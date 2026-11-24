// IRONHAVEN — the wanted response. The wanted level is the city's pressure
// gauge: more stars, more cars, and at five the helicopter comes up. Police
// cars pursue and ram — a ram costs the hauler integrity or Mara's health.
// Officers arrive on foot in waves, close to range, and shoot. The helicopter
// does not shoot; it watches, and its spotlight is the sign the whole city
// is looking at you.

import * as THREE from 'three';
import { COLORS, GAME_RULES } from './config.js';

function makePoliceCar() {
  const g = new THREE.Group();
  const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 1.9), mat(COLORS.policeWhite));
  body.position.y = 0.7; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 1.7), mat(0x22262e, 0.5));
  cabin.position.set(-0.2, 1.4, 0); cabin.castShadow = true; g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.62, 0.28, 1.92), mat(COLORS.policeBlue, 0.6));
  stripe.position.y = 0.72; g.add(stripe);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.4), mat(0x111111));
  bar.position.set(-0.2, 1.85, 0); g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.62), new THREE.MeshStandardMaterial({ color: 0xff2211, emissive: 0xff2211, emissiveIntensity: 1 }));
  red.position.set(-0.2, 1.98, 0.36); g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.62), new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 1 }));
  blue.position.set(-0.2, 1.98, -0.36); g.add(blue);
  for (const [wx, wz] of [[1.2, 0.9], [1.2, -0.9], [-1.2, 0.9], [-1.2, -0.9]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10), mat(0x141414, 0.95));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.37, wz); g.add(wheel);
  }
  return { group: g, red, blue };
}

function makeOfficer() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), mat(COLORS.policeBlue));
  torso.position.y = 1.1; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), mat(COLORS.maraSkin));
  head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), mat(0x11151a));
  cap.position.y = 1.8; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.22), mat(0x1a1d22));
  legL.position.set(-0.15, 0.34, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.18), mat(COLORS.policeBlue));
  armR.position.set(0.38, 1.1, 0.1); g.add(armR);
  return { group: g, legL, legR };
}

export function createWantedResponseSystem(ctx) {
  const { scene, world, rng } = ctx;
  const cars = [];
  const officers = [];
  const heli = { group: null, rotor: null, light: null, cone: null, active: false, pos: new THREE.Vector3(0, 40, 0) };
  let wanted = 0;
  let flashPhase = 0;

  // -- helicopter, built once, hidden until five stars --
  {
    const g = new THREE.Group();
    const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 1.8), mat(COLORS.heliGrey));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.5), mat(COLORS.heliGrey));
    tail.position.set(-3, 0.3, 0); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.1), mat(COLORS.policeBlue));
    fin.position.set(-4.5, 0.9, 0); g.add(fin);
    heli.rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5), mat(0x1a1a1a));
    heli.rotor.position.y = 1; g.add(heli.rotor);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.12), mat(0x222222));
    skidL.position.set(0, -0.95, 0.8); g.add(skidL);
    const skidR = skidL.clone(); skidR.position.z = -0.8; g.add(skidR);
    heli.light = new THREE.SpotLight(0xfff2cc, 0, 70, 0.35, 0.5, 1.2);
    heli.light.position.set(0, -0.6, 0);
    g.add(heli.light);
    heli.light.target.position.set(0, -10, 0);
    g.add(heli.light.target);
    const coneGeo = new THREE.ConeGeometry(5.5, 40, 20, 1, true);
    heli.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
    heli.cone.position.y = -20; heli.cone.rotation.x = Math.PI; g.add(heli.cone);
    g.visible = false;
    scene.add(g);
    heli.group = g;
  }

  const carSpawns = [[-52, -6], [-52, 6], [100, -6], [100, 6], [170, -8]];
  function spawnCar() {
    const { group, red, blue } = makePoliceCar();
    scene.add(group);
    const s = carSpawns[cars.length % carSpawns.length];
    cars.push({
      group, red, blue, pos: new THREE.Vector3(s[0], 0, s[1]),
      heading: Math.PI / 2, speed: 0, ramCooldown: 0,
    });
  }
  function setWanted(n) {
    wanted = Math.max(0, Math.min(GAME_RULES.wantedMax, n));
    const want = GAME_RULES.policeCarCount[wanted] ?? 0;
    while (cars.length < want) spawnCar();
    while (cars.length > want) {
      const c = cars.pop();
      scene.remove(c.group);
    }
    const heliOn = wanted >= GAME_RULES.heliAtStars;
    heli.active = heliOn;
    heli.group.visible = heliOn;
    heli.light.intensity = heliOn ? 900 : 0;
    ctx.cityLife.setFleeing(wanted >= 3);
  }

  function spawnOfficerWave(count, near) {
    for (let i = 0; i < count; i++) {
      const { group, legL, legR } = makeOfficer();
      scene.add(group);
      const a = rng() * Math.PI * 2;
      const x = near.x + Math.cos(a) * (18 + rng() * 10);
      const z = near.z + Math.sin(a) * (18 + rng() * 10);
      group.position.set(x, world.heightAt(x, z), z);
      officers.push({ group, legL, legR, health: GAME_RULES.officerHealth, alive: true, shootTimer: 1 + rng(), phase: rng() * 6, speed: 3.4 + rng() * 0.8 });
    }
  }

  function clearOfficers() {
    for (const o of officers) scene.remove(o.group);
    officers.length = 0;
  }

  function targetPos() {
    if (ctx.vehicles.drive.active) return ctx.vehicles.drive.pos;
    return ctx.player.state.pos;
  }

  function update(dt, time) {
    flashPhase += dt * 7;
    const target = targetPos();
    // -- police cars pursue and ram --
    for (const car of cars) {
      const dx = target.x - car.pos.x, dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      car.speed = Math.min(36, car.speed + 12 * dt);
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      car.pos.y = world.heightAt(car.pos.x, car.pos.z);
      car.group.position.copy(car.pos);
      car.group.rotation.y = car.heading - Math.PI / 2;
      car.red.material.emissiveIntensity = Math.sin(flashPhase) > 0 ? 2.2 : 0.2;
      car.blue.material.emissiveIntensity = Math.sin(flashPhase) > 0 ? 0.2 : 2.2;
      car.ramCooldown -= dt;
      if (dist < 4 && car.ramCooldown <= 0) {
        car.ramCooldown = 2.5;
        car.speed *= 0.4;
        if (ctx.vehicles.drive.active) {
          ctx.vehicles.drive.integrity = Math.max(0, (ctx.vehicles.drive.integrity ?? 100) - 4);
          ctx.vehicles.drive.speed *= 0.85;
          ctx.effects.impact(target);
        } else {
          ctx.player.takeDamage(6);
          ctx.effects.impact(target);
        }
      }
    }
    // -- officers close in and shoot --
    for (const off of officers) {
      if (!off.alive) continue;
      const p = off.group.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 24) {
        const nx = dx / dist, nz = dz / dist;
        p.x += nx * off.speed * dt;
        p.z += nz * off.speed * dt;
        p.y = world.heightAt(p.x, p.z);
        off.group.rotation.y = Math.atan2(nx, nz);
        off.phase += dt * 7;
        off.legL.rotation.x = Math.sin(off.phase) * 0.5;
        off.legR.rotation.x = -Math.sin(off.phase) * 0.5;
      } else {
        off.group.rotation.y = Math.atan2(dx, dz);
        off.shootTimer -= dt;
        if (off.shootTimer <= 0) {
          off.shootTimer = GAME_RULES.officerShotInterval;
          if (ctx.combat.shootOfficer(off, target)) {
            if (ctx.player.takeDamage(GAME_RULES.officerDamage)) ctx.missions.fail('MARA WAS TAKEN DOWN');
          }
        }
      }
    }
    // -- helicopter follows and watches, offset ahead so the drive camera sees it --
    if (heli.active) {
      heli.pos.x += ((target.x + 16) - heli.pos.x) * Math.min(1, dt * 0.5);
      heli.pos.z += ((target.z + 10) - heli.pos.z) * Math.min(1, dt * 0.5);
      heli.pos.y = 26 + Math.sin(time * 0.7) * 2;
      heli.group.position.copy(heli.pos);
      heli.group.rotation.y += dt * 0.3;
      heli.rotor.rotation.y += dt * 22;
      heli.light.target.position.set(target.x - heli.pos.x, -40, target.z - heli.pos.z);
      heli.cone.lookAt(target.x, 0, target.z);
      heli.cone.rotateX(Math.PI / 2);
    }
  }

  return { cars, officers, heli, wanted: () => wanted, setWanted, spawnOfficerWave, clearOfficers, update };
}

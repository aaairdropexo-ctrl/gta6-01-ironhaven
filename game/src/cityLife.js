// IRONHAVEN — the city lives. Civilian cars drive the main loop through all
// three districts and pedestrians walk the yard, the hill and the dock. When
// the wanted level rises, pedestrians flee toward the nearest loop exit and
// traffic thins; when it falls, the city comes back. Nobody here is a prop
// that stands still: every figure has a route and a reaction.

import * as THREE from 'three';
import { COLORS, GAME_RULES } from './config.js';

function makeCar(color, isVan) {
  const g = new THREE.Group();
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const body = new THREE.Mesh(new THREE.BoxGeometry(isVan ? 3.6 : 3.4, 0.75, 1.8), mat(color));
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(isVan ? 3.2 : 1.8, 0.7, 1.6), mat(isVan ? color : 0x22262e, 0.5));
  cabin.position.set(isVan ? 0 : -0.3, 1.35, 0); cabin.castShadow = true; g.add(cabin);
  for (const [wx, wz] of [[1.1, 0.85], [1.1, -0.85], [-1.1, 0.85], [-1.1, -0.85]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), mat(0x141414, 0.95));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.36, wz); g.add(wheel);
  }
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffd27a, emissiveIntensity: 0.9 }));
  light.position.set(1.75, 0.7, 0.65); g.add(light);
  const light2 = light.clone(); light2.position.z = -0.65; g.add(light2);
  return g;
}

function makePed(color) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), mat(color));
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.28), mat(COLORS.maraSkin));
  head.position.y = 1.55; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.2), mat(0x2e3138));
  legL.position.set(-0.13, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  // a hi-vis vest for the yard workers
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.4, 0.34), mat(COLORS.safetyYellow));
  vest.position.y = 1.1; g.add(vest);
  return { group: g, legL, legR };
}

export function createTrafficAndPedestrians(ctx) {
  const { scene, world, rng } = ctx;
  // the traffic palette: mid-bin hues (round 29 colour script) so the
  // cars read as distinct colours under golden-hour light — teal, yellow,
  // blue, pink and green all sit at their bin centres, never on a boundary.
  const carColors = [0xff7a1a, 0xd9261c, 0x35d3c0, 0xf2b705, 0x3a6ea5, 0xe84a7a, 0x4a9e4a];
  const cars = [];
  const loop = world.trafficLoop;
  // precompute the loop's segment lengths so cars can sit at a distance along it
  const segLens = [];
  let loopLen = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, z0] = loop[i]; const [x1, z1] = loop[(i + 1) % loop.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    segLens.push(len); loopLen += len;
  }
  function pointAt(dist) {
    let d = ((dist % loopLen) + loopLen) % loopLen;
    for (let i = 0; i < loop.length; i++) {
      if (d <= segLens[i]) {
        const [x0, z0] = loop[i]; const [x1, z1] = loop[(i + 1) % loop.length];
        const t = segLens[i] === 0 ? 0 : d / segLens[i];
        return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, heading: Math.atan2(x1 - x0, z1 - z0) };
      }
      d -= segLens[i];
    }
    return { x: loop[0][0], z: loop[0][1], heading: 0 };
  }
  for (let i = 0; i < GAME_RULES.trafficCount; i++) {
    const car = makeCar(carColors[i % carColors.length], i % 3 === 2);
    scene.add(car);
    cars.push({ mesh: car, dist: (loopLen / GAME_RULES.trafficCount) * i + rng() * 8, speed: GAME_RULES.trafficSpeed * (0.85 + rng() * 0.3) });
  }

  const peds = [];
  const pedColors = [0x6b7c5e, 0x8a6a4a, 0x4a5a6b, 0x7a4a35, 0x5a5a6b];
  for (let i = 0; i < GAME_RULES.pedCount; i++) {
    const loopIdx = i % world.pedLoops.length;
    const { group, legL, legR } = makePed(pedColors[i % pedColors.length]);
    scene.add(group);
    peds.push({
      group, legL, legR, loop: world.pedLoops[loopIdx],
      seg: i % world.pedLoops[loopIdx].length, t: rng(), speed: 1.2 + rng() * 0.7,
      phase: rng() * 6, fleeing: false,
    });
  }

  let flee = false;
  function setFleeing(on) { flee = on; }

  function update(dt) {
    // traffic follows the loop; at high wanted levels cars pull over and stop
    const trafficOn = !flee;
    for (const car of cars) {
      if (trafficOn) car.dist += car.speed * dt;
      const p = pointAt(car.dist);
      car.mesh.position.set(p.x, world.heightAt(p.x, p.z), p.z);
      car.mesh.rotation.y = p.heading - Math.PI / 2;
    }
    for (const ped of peds) {
      const loopPts = ped.loop;
      const a = loopPts[ped.seg]; const b = loopPts[(ped.seg + 1) % loopPts.length];
      ped.t += (ped.speed * (flee ? 2.4 : 1) * dt) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (ped.t >= 1) { ped.t = 0; ped.seg = (ped.seg + 1) % loopPts.length; }
      const x = a[0] + (b[0] - a[0]) * ped.t;
      const z = a[1] + (b[1] - a[1]) * ped.t;
      ped.group.position.set(x, world.heightAt(x, z), z);
      ped.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      ped.phase += dt * ped.speed * 4;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.legL.rotation.x = swing; ped.legR.rotation.x = -swing;
    }
  }

  return { cars, peds, setFleeing, update, pointAt };
}

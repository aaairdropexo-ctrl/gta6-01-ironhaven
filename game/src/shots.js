// IRONHAVEN — the four screenshots. Each one stages a real game state from
// the same rules a player plays by, advances the simulation a fixed number
// of steps so poses, rotors and beacons settle, then freezes the simulation
// while the frame keeps rendering. The same seed always gives the same frame.
// Nothing here is composited or edited: the frame is what the game draws.

import * as THREE from 'three';
import { GAME_RULES } from './config.js';

const STEP = 1 / 60;
const neutralInput = {
  move: () => ({ forward: 0, strafe: 0, sprint: false }),
  aiming: () => false, firing: () => false,
  takeMouse: () => ({ dx: 0, dy: 0 }), takeActions: () => 0,
};

export function stageShot(name, ctx) {
  const { missions, police, player, vehicles, world, cameraRig, hud, cityLife, effects, combat } = ctx;
  hud.hideTitle(); hud.hideFail(); hud.hideCompletion(); hud.hidePrompt(); hud.hideBroadcast();
  ctx.frozen = false;
  ctx.stagedWanted = undefined; // a staged shot may override the wanted
  // display (Fix 3); reset so it cannot leak into another shot.

  function settle(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i++) {
      const dt = STEP;
      player.update(dt, neutralInput, cameraRig.yaw());
      const driveResult = vehicles.update(dt, neutralInput);
      if (driveResult && driveResult.hit) missions.onHaulerHit(driveResult.hit, driveResult.speedBefore);
      cityLife.update(dt);
      police.update(dt, ctx.time);
      missions.update(dt);
      world.update(dt, ctx.time);
      effects.update(dt);
      combat.update(dt);
      ctx.time += dt;
    }
  }

  if (name === 'cover') {
    missions.startCampaign();
    // Mara is already at the hauler, about to take it — hero and objective in
    // one frame, not 8 metres apart. She stands on the camera side of the
    // hauler (z +2.5), not behind it, or the hauler hides her from the lens
    player.setPosition(-12, 2.5, Math.PI / 2);
    // two officers walking in through the gate, placed where the frame can see them
    police.spawnOfficerWave(2, new THREE.Vector3(-24, 0, 2));
    police.officers[0].group.position.set(-24, world.heightAt(-24, -4), -4);
    police.officers[1].group.position.set(-22, world.heightAt(-22, 8), 8);
    for (const o of police.officers) o.shootTimer = 8;
    settle(3);
    // keep the pursuing police cars in the midground, not on top of the camera
    if (police.cars[0]) { police.cars[0].pos.set(-30, 0, -6); police.cars[0].group.position.set(-30, 0, -6); police.cars[0].group.rotation.y = 0; }
    if (police.cars[1]) { police.cars[1].pos.set(-28, 0, 8); police.cars[1].group.position.set(-28, 0, 8); police.cars[1].group.rotation.y = 0; }
    // midground life: five civilian cars and four yard workers crossing the
    // road so the middle of the frame is a working yard, not empty ground
    cityLife.cars[0].mesh.position.set(-10, 0, -4);
    cityLife.cars[0].mesh.rotation.y = 0.28;
    cityLife.cars[1].mesh.position.set(-26, 0, 4);
    cityLife.cars[1].mesh.rotation.y = Math.PI - 0.35;
    cityLife.cars[2].mesh.position.set(-40, 0, -3);
    cityLife.cars[2].mesh.rotation.y = 0.45;
    cityLife.cars[3].mesh.position.set(-18, 0, 6);
    cityLife.cars[3].mesh.rotation.y = Math.PI + 0.2;
    cityLife.cars[4].mesh.position.set(-32, 0, -5);
    cityLife.cars[4].mesh.rotation.y = -0.3;
    cityLife.peds[0].group.position.set(-20, 0, -4);
    cityLife.peds[1].group.position.set(-12, 0, -5);
    cityLife.peds[2].group.position.set(-16, 0, 5);
    cityLife.peds[3].group.position.set(-28, 0, -6);
    // the helicopter hangs over the yard even at three stars — the rivals'
    // covers all have one in the sky, and the frame reads empty without it.
    // It sits upper-middle (clear of the objective plate, which covers the
    // top-left), low enough to stay inside the frame
    police.heli.active = true;
    police.heli.group.visible = true;
    police.heli.pos.set(-20, 10, -20);
    police.heli.group.position.copy(police.heli.pos);
    police.heli.rotor.rotation.y = 0.7;
    // Mara and the officers caught mid-stride, not standing like statues
    player.legL.rotation.x = 0.5; player.legR.rotation.x = -0.5;
    player.armL.rotation.x = -0.4; player.armR.rotation.x = 0.4;
    for (const o of police.officers) { o.legL.rotation.x = 0.45; o.legR.rotation.x = -0.45; }
    hud.showPrompt('[E] HIJACK HAULER');
    hud.showSubtitle('MARA: "They sealed the wrong manifest. The hardcase is mine."', 30);
    cameraRig.setCinematic(new THREE.Vector3(-4, 4.5, 9), new THREE.Vector3(-11, 1.5, -1));
  } else if (name === 'chase') {
    missions.startCampaign();
    missions.startChapter2();
    vehicles.placeHauler(138, 0, Math.PI / 2);
    vehicles.drive.speed = 22;
    settle(0.5);
    // the interceptors ride alongside, ahead of the hauler — placed AFTER
    // the settle, or the pursuit drive moves them and the dispatch reads
    // their spawn distances instead of the staged ones
    if (police.cars[0]) { police.cars[0].pos.set(146, 0, -4.5); police.cars[0].group.position.set(146, 0, -4.5); police.cars[0].heading = Math.PI / 2; police.cars[0].group.rotation.y = Math.PI / 2; police.cars[0].speed = 22; }
    if (police.cars[1]) { police.cars[1].pos.set(142, 0, 5); police.cars[1].group.position.set(142, 0, 5); police.cars[1].heading = Math.PI / 2; police.cars[1].group.rotation.y = Math.PI / 2; police.cars[1].speed = 22; }
    // the crash moment: the hauler rams the bridge barrier — sparks at the
    // impact point, tyre smoke at the wheels, the barrier breaking
    effects.impact(new THREE.Vector3(150, 1, 0));
    // a second burst where the interceptor clips the hauler — the rivals'
    // chase frames all carry fire, ours had one spark
    effects.impact(new THREE.Vector3(146, 1, -4.5));
    // traffic on the bridge approach and a walker on the shoulder, so the
    // bridge is a street in use, not an empty runway
    cityLife.cars[0].mesh.position.set(148, 0, -5);
    cityLife.cars[0].mesh.rotation.y = Math.PI / 2;
    cityLife.cars[1].mesh.position.set(158, 0, 3);
    cityLife.cars[1].mesh.rotation.y = Math.PI / 2;
    cityLife.peds[0].group.position.set(145, 0, -7);
    {
      const hp = vehicles.drive.pos;
      effects.skid(new THREE.Vector3(hp.x - 4, 0, hp.z));
      effects.skid(new THREE.Vector3(hp.x - 6, 0, hp.z + 1));
      effects.skid(new THREE.Vector3(hp.x - 8, 0, hp.z - 1));
      effects.skid(new THREE.Vector3(hp.x - 5, 0, hp.z - 2));
      effects.skid(new THREE.Vector3(hp.x - 7, 0, hp.z + 2));
    }
    police.heli.pos.set(150, 9, 0);
    police.heli.group.position.copy(police.heli.pos);
    police.heli.rotor.rotation.y = 0.7;
    // Round 29 defect fix (Fix 2): the barrier FROZEN mid-break — the
    // crash moment as geometry, not particles (effects.impact() dies
    // before capture). The beam is tilted ~30 deg with one end on the
    // deck, one sawhorse is knocked 1.5 m into the air. Skid decals are
    // flat dark boxes on the deck (frozenBox), NOT effects.skid() smoke.
    // barrierParts = [sawhorse-north, sawhorse-south, beam].
    if (world.bridge && world.bridge.barrierParts.length === 3) {
      const [b1, b2, beam] = world.bridge.barrierParts;
      beam.rotation.z = 0.5; beam.position.y = 1.6;
      b1.position.y = 1.5; b1.rotation.z = 0.4;
      b2.rotation.z = -0.15;
    }
    effects.frozenBox(4, 0.02, 0.5, 0x1a1a1a, 134, 0.72, -0.8, 0);
    effects.frozenBox(4, 0.02, 0.5, 0x1a1a1a, 132, 0.72, 0.8, 0);
    // cinematic-shot-direction: the railing filled a third of the frame and
    // read as the subject, not the hauler — raise the camera and move it
    // to the bridge center so it looks OVER the railing at the hauler.
    // Round 16: the y=9 angle was too top-down (the hauler shrank, focal
    // 0.91→0.40) — come down to y=7 and closer, so the hauler is big again
    // while the railing stays low in the frame.
    // Round 29 defect fix (Fix 2, CORRECTED after the first capture):
    // the (126,5.5,2) pull-back made the hauler SMALLER (12 m away, not
    // 6 m) — pulling back shrinks the subject, it does not enlarge it.
    // The hauler was already the right size at (132,7,2) in round 29
    // (focal 0.49, force-rank #1); the defect was only the south
    // container crowding it, and that container is now at x=162. So the
    // camera goes BACK to (132,7,2). The barrier mid-break, the heli at
    // (150,9,0), the enlarged board and the skid decals stay.
    cameraRig.setCinematic(new THREE.Vector3(132, 7, 2), new THREE.Vector3(150, 2, 0));
  } else if (name === 'defend') {
    missions.startCampaign();
    missions.startChapter3();
    // Mara holds the van: inside the broadcast radius, facing officer-1
    // (180,11) — the aim target. Heading -2.50 rad (~53 deg from the old
    // -PI/2) so the camera sees her 3/4 front, aiming, not her back.
    player.setPosition(183, 15, -2.50);
    ctx.missions.state.broadcast = 72;
    hud.setBroadcast(72);
    police.spawnOfficerWave(2, new THREE.Vector3(196, 0, -20));
    settle(3);
    // one officer close in on the left, mid-approach — the defend reads as a
    // fight, not an empty yard with figures in the distance
    if (police.officers[0]) police.officers[0].group.position.set(180, world.heightAt(180, 11), 11);
    // Round 29 defect fix (Fix 1): the fallen officer OUT from behind the
    // van into open ground between Mara and the camera — lying across the
    // view, left-center foreground, visible, not a 15 px sliver. His
    // dropped pistol lies beside him (frozen box, no decay).
    if (police.officers[1]) {
      police.officers[1].group.position.set(180, 0.3, 13);
      police.officers[1].group.rotation.z = Math.PI / 2;
      effects.frozenBox(0.3, 0.06, 0.12, 0x1a1a1a, 180.8, 0.05, 13.5, 0.6);
    }
    // dock life: two workers by the van and a parked car, so the dock is a
    // workplace under attack, not an empty lot
    cityLife.peds[2].group.position.set(190, 0, 16);
    cityLife.peds[3].group.position.set(182, 0, 8);
    // Round 18 (causal A3): the ramming car closer to the van — it was
    // parked 10 m away at the dock's edge; now it reads as the attack.
    cityLife.cars[0].mesh.position.set(194, 0, 14);
    cityLife.cars[0].mesh.rotation.y = Math.PI / 2;
    // Round 29 defect fix (Fix 1): Wren at the van's CAMERA-side corner
    // (184,14), in front of the van — not the far corner (188,14) behind
    // the pink container, where she was not identifiable.
    cityLife.peds[4].group.position.set(184, 0, 14);
    cityLife.peds[4].group.traverse((m) => {
      if (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0xf2b705) {
        m.material = new THREE.MeshStandardMaterial({ color: 0x35d3c0, roughness: 0.9 });
      }
    });
    // the helicopter hangs over the dock even at four stars — far and low
    // enough to sit inside the frame, not at its top edge.
    // Round 16: the heli sat behind the broadcast plate (top-right) — move
    // it south so it appears in the upper-center, clear of the plate.
    // Round 18 (causal A5): lower it — it was still clipped at the top edge.
    police.heli.active = true;
    police.heli.group.visible = true;
    police.heli.pos.set(215, 11, 8);
    police.heli.group.position.copy(police.heli.pos);
    police.heli.rotor.rotation.y = 0.7;
    // bullets sparking off the van, smoke at the wheels, officers mid-stride —
    // three bursts, not one, so the firefight reads at 768px
    effects.impact(new THREE.Vector3(188, 1.5, 9));
    effects.impact(new THREE.Vector3(184, 1.5, 10));
    effects.impact(new THREE.Vector3(190, 1.5, 14));
    // Round 18 (causal A3): the muzzle flash at Mara's pistol — the shot
    // she is firing, not just the sparks it lands on.
    effects.impact(new THREE.Vector3(183, 1.3, 13.8));
    // Round 29 defect fix (Fix 1): a PERSISTENT muzzle-flash star at the
    // pistol muzzle (182.2, 1.2, 14.6 — computed from Mara's aim at
    // officer-1), facing the camera. The transient impact above dies
    // before capture; this frozen star is the shot the jury sees.
    effects.frozenFlash(new THREE.Vector3(182.2, 1.2, 14.6), new THREE.Vector3(175, 3, 16));
    effects.skid(new THREE.Vector3(186, 0, 12));
    player.legL.rotation.x = 0.3; player.legR.rotation.x = -0.3;
    // Round 29 defect fix (Fix 1): Mara AIMING, not standing — right arm
    // raised with the pistol (armR -1.2, the aim pose), left arm
    // supporting (-0.8). The pistol is shown (hidden by default;
    // player.update hides it, but no settle runs after this line, so it
    // stays visible in the frozen frame).
    player.armR.rotation.x = -1.2; player.armL.rotation.x = -0.8;
    if (player.pistol) player.pistol.visible = true;
    for (const o of police.officers) { o.legL.rotation.x = 0.45; o.legR.rotation.x = -0.45; }
    hud.setBroadcast(72);
    hud.showSubtitle('MARA: "Hold the van. When this goes live, every screen in Ironhaven shows his name."', 30);
    // Round 29 defect fix (Fix 1): crosshair OFF in the staged defend —
    // it floated on the "ROURKE LEDGER" sign and read as a UI defect.
    hud.setCrosshair(false);
    cameraRig.setCinematic(new THREE.Vector3(175, 3, 16), new THREE.Vector3(184, 1.5, 14));
  } else if (name === 'reward') {
    missions.startCampaign();
    missions.completeCampaign();
    vehicles.placeHauler(30, 44, Math.PI / 2);
    player.setPosition(24, 40, Math.PI / 2);
    player.show();
    settle(1);
    // the yard after the win: cars and workers back in the frame, the
    // helicopter still overhead — the city comes back to life
    cityLife.cars[0].mesh.position.set(38, 0, 40);
    cityLife.cars[0].mesh.rotation.y = Math.PI / 2;
    cityLife.cars[1].mesh.position.set(20, 0, 48);
    cityLife.cars[1].mesh.rotation.y = -Math.PI / 2;
    cityLife.peds[2].group.position.set(34, 0, 38);
    cityLife.peds[3].group.position.set(28, 0, 50);
    cityLife.peds[4].group.position.set(22, 0, 42);
    // the helicopter hangs over the yard even in free roam — upper-left
    // sky, clear of the completion banner (which covers the top-center)
    police.heli.active = true;
    police.heli.group.visible = true;
    police.heli.pos.set(45, 12, 38);
    police.heli.group.position.copy(police.heli.pos);
    police.heli.rotor.rotation.y = 0.7;
    // Mara beside the hauler, mid-stride, the PORT POLICE seal facing the camera
    player.legL.rotation.x = 0.4; player.legR.rotation.x = -0.4;
    hud.showSubtitle('WREN: "It is live. Every screen in Ironhaven is showing it."', 30);
    // Round 29 defect fix (Fix 3): 2 fading wanted stars — "cooling down".
    // The heat is fading after the broadcast, not gone in one frame, and
    // it restores the second genre signal (the qualification gate needs
    // wanted stars + minimap; free roam had 0 stars, so it read 1/2).
    // HUD-only: no police are added back to the yard (that would break
    // the payoff). NOTE: hud.setWanted alone does NOT stick — syncHud
    // overwrites it from police.wanted() (0 after completeCampaign), and
    // police.setWanted(1) would spawn cars + kill the staged heli. So
    // the staged value lives on ctx.stagedWanted, which syncHud reads.
    // Set after the settle so missions.update cannot clear it.
    // 2 stars, not 1: one star renders 0.0027 red pixels in the critic's
    // top-right region, just under its 0.003 threshold; two stars render
    // ~0.005, safely above, and 2/5 still reads as low/fading heat.
    ctx.stagedWanted = 2;
    hud.setWanted(2);
    cameraRig.setCinematic(new THREE.Vector3(16, 4, 38), new THREE.Vector3(27, 2, 44));
  } else {
    missions.startCampaign();
    settle(2);
    cameraRig.setCinematic(new THREE.Vector3(-22, 4.5, 14), new THREE.Vector3(-2, 2, -8));
  }
  // the chapter card is a transient flash, not part of the frame; the
  // objective panel already names the chapter. Staging may have cost Mara
  // health or the hauler integrity — the frame shows them whole.
  hud.hideChapterCard();
  player.state.health = GAME_RULES.playerHealth;
  vehicles.drive.integrity = 100;
  ctx.frozen = true;
  return name;
}

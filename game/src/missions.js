// IRONHAVEN — the evidence campaign. Three chapters, no cutscenes: the story
// is told by what changes in the world. Chapter 1 traps Mara in the yard and
// makes her take the hauler. Chapter 2 puts five stars on her and a roadblock
// on the bridge. Chapter 3 makes her hold the radio van while the ledger
// broadcasts. When it goes live, the gate and the garage open, the wanted
// level clears, and the hauler has a fixed home — the rewards are places,
// not numbers.

import * as THREE from 'three';
import { CHAPTERS, GAME_RULES } from './config.js';

const VAN_POS = new THREE.Vector3(186, 0, 12);
const BARRIER_POS = new THREE.Vector3(150, 0, 0);

export function createEvidenceCampaign(ctx) {
  const { world, player, vehicles, police, hud, progression, cameraRig } = ctx;
  const state = {
    chapter: 0, mode: 'title', // title | playing | failed | complete
    broadcast: 0, broadcastActive: false,
    chapterTimer: 0, waveTimer: 0, officersSpawned: false,
    failReason: '',
  };

  function setObjective(ch) {
    hud.setObjective(`CHAPTER ${ch.id} — ${ch.name}`, ch.objective, ch.detail);
    hud.showChapterCard(`CHAPTER ${ch.id}`, ch.name, ch.objective);
    hud.showSubtitle(ch.subtitle, 5);
  }

  function startChapter1() {
    state.chapter = 1;
    state.mode = 'playing';
    state.broadcast = 0; state.officersSpawned = false; state.chapterTimer = 0;
    cameraRig.clearCinematic();
    vehicles.placeHauler(-8, 0, Math.PI / 2);
    vehicles.drive.integrity = 100;
    player.setPosition(-16, 0, Math.PI / 2);
    player.show();
    player.state.health = GAME_RULES.playerHealth;
    world.setBeaconOn(true);
    world.setGateOpen(false);
    police.setWanted(CHAPTERS[0].wanted);
    setObjective(CHAPTERS[0]);
  }

  function startChapter2() {
    state.chapter = 2;
    state.chapterTimer = 0;
    vehicles.enterHauler();
    player.hide();
    police.setWanted(CHAPTERS[1].wanted);
    setObjective(CHAPTERS[1]);
  }

  function startChapter3() {
    state.chapter = 3;
    state.chapterTimer = 0; state.waveTimer = 0;
    vehicles.exitHauler();
    vehicles.placeHauler(176, 2, Math.PI / 2);
    player.setPosition(183, 15, Math.PI * 0.75);
    player.show();
    player.heal(40);
    // the hardcase leaves the flatbed and locks into the van's uplink cradle
    vehicles.hardcase.visible = false;
    world.van.hardcase.visible = true;
    police.setWanted(CHAPTERS[2].wanted);
    police.spawnOfficerWave(3, new THREE.Vector3(196, 0, -20));
    setObjective(CHAPTERS[2]);
  }

  function completeCampaign() {
    state.chapter = 0;
    state.mode = 'complete';
    state.broadcast = 100;
    police.setWanted(0);
    police.clearOfficers();
    world.setBeaconOn(false);
    world.setGateOpen(true);
    world.setGarageOpen(true);
    progression.applyReward();
    hud.hideChapterCard();
    hud.setObjective('EVIDENCE LIVE', 'FREE ROAM — IRONHAVEN IS YOURS', 'The gate and the garage are open. The hauler lives at the Iron Garage.');
    hud.showCompletion([
      'PORT TRUST +1 — the Yard 17 gate stays open',
      'IRON GARAGE OPEN — the hauler has a fixed home',
      'EVIDENCE LIVE — the Rourke ledger is public',
    ]);
    hud.showSubtitle('WREN: "It is live. Every screen in Ironhaven is showing it."', 6);
  }

  function fail(reason) {
    if (state.mode !== 'playing') return;
    state.mode = 'failed';
    state.failReason = reason;
    police.setWanted(0);
    hud.showFail(reason);
  }

  function retryChapter() {
    police.clearOfficers();
    if (state.chapter === 1) startChapter1();
    else if (state.chapter === 2) { startChapter1(); startChapter2(); }
    else if (state.chapter === 3) startChapter3();
    state.mode = 'playing';
  }

  function startCampaign() {
    police.clearOfficers();
    startChapter1();
  }

  // The hauler hit something: if it was the bridge barrier, fast enough, it breaks.
  function onHaulerHit(hit, speedBefore) {
    if (state.mode !== 'playing' || state.chapter !== 2) return;
    if (hit && hit.barrier && Math.abs(speedBefore) > 5) {
      world.breakBarrier();
      vehicles.drive.speed = Math.max(vehicles.drive.speed, 14);
      hud.showSubtitle('WREN: "Through! The barrier is down — keep driving."', 4);
    }
  }

  function nearHauler() {
    const p = player.state.pos;
    const h = vehicles.drive.pos;
    return Math.hypot(p.x - h.x, p.z - h.z) < 4.2;
  }

  function update(dt) {
    if (state.mode !== 'playing') return;
    state.chapterTimer += dt;
    if (state.chapter === 1) {
      // two officers walk in through the gate after the delay
      if (!state.officersSpawned && state.chapterTimer > GAME_RULES.chapter1PoliceDelay) {
        state.officersSpawned = true;
        police.spawnOfficerWave(2, new THREE.Vector3(-50, 0, 0));
      }
      if (nearHauler()) hud.showPrompt('[E] HIJACK HAULER');
      else hud.hidePrompt();
    } else if (state.chapter === 2) {
      hud.hidePrompt();
      if (vehicles.drive.integrity <= 0) { fail('THE HAULER WAS DISABLED'); return; }
      if (vehicles.drive.pos.x > 160) { startChapter3(); return; }
    } else if (state.chapter === 3) {
      hud.hidePrompt();
      const p = player.state.pos;
      const nearVan = Math.hypot(p.x - VAN_POS.x, p.z - VAN_POS.z) < GAME_RULES.broadcastRadius;
      state.broadcastActive = nearVan;
      if (nearVan) {
        state.broadcast += (100 / GAME_RULES.broadcastSeconds) * dt;
        hud.setBroadcast(state.broadcast);
        if (state.broadcast >= 100) { completeCampaign(); return; }
      } else {
        hud.setBroadcast(state.broadcast);
      }
      // officers come in waves while the broadcast runs
      state.waveTimer += dt;
      if (state.waveTimer > 9) {
        state.waveTimer = 0;
        const alive = police.officers.filter((o) => o.alive).length;
        if (alive < 4) police.spawnOfficerWave(GAME_RULES.officersPerWave, new THREE.Vector3(196, 0, 40));
      }
      if (player.state.health <= 0) { fail('MARA WAS TAKEN DOWN'); return; }
    }
  }

  return {
    state, startCampaign, startChapter1, startChapter2, startChapter3,
    completeCampaign, fail, retryChapter, onHaulerHit, nearHauler, update,
  };
}

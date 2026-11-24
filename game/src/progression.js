// IRONHAVEN — Port Trust. The campaign's rewards are places, not numbers:
// the Yard 17 gate stays open, the Iron Garage opens, and the hauler gets a
// fixed home in front of the garage. This module is the record of what the
// campaign unlocked, so the HUD, the minimap and the free-roam spawn all read
// the same truth.

export function createPortTrustProgression(ctx) {
  const { world, vehicles } = ctx;
  const state = {
    // trust is a flag, not a level: 0 before the broadcast, 1 after. The
    // rewards are places (gate, garage, hauler home), not numbers, so
    // there is nothing to count past 1.
    trust: 0, gateOpen: false, garageOpen: false, evidenceLive: false,
    haulerHome: { x: 30, z: 44, heading: Math.PI },
  };

  function applyReward() {
    state.trust = 1;
    state.gateOpen = true;
    state.garageOpen = true;
    state.evidenceLive = true;
    // the hauler's fixed home: parked in front of the Iron Garage
    vehicles.placeHauler(state.haulerHome.x, state.haulerHome.z, state.haulerHome.heading);
    world.setGarageOpen(true);
    world.setGateOpen(true);
  }

  function reset() {
    state.trust = 0; state.gateOpen = false; state.garageOpen = false; state.evidenceLive = false;
  }

  return { state, applyReward, reset };
}

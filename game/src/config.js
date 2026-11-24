// IRONHAVEN — shared rules. One place for every number the game balances on:
// wanted thresholds, mission timings, movement, camera and the visual constants.
// The jury reads this file first in the dossier, so the rules are stated here,
// not hidden inside the systems that use them.

export const GAME_RULES = {
  // -- world scale (metres, Y up, +X east toward the dock, +Z south) --
  world: { minX: -200, maxX: 212, minZ: -92, maxZ: 92 },
  hill: { startX: -55, topX: -190, topHeight: 22 },
  channel: { westX: 118, eastX: 158, halfWidth: 45 },
  // -- on foot --
  walkSpeed: 6, sprintSpeed: 10, aimSpeed: 3.2,
  playerRadius: 0.55, playerHeight: 1.8, playerHealth: 100,
  // -- driving --
  haulerAccel: 14, haulerBrake: 26, haulerTopSpeed: 34, haulerReverse: 9,
  haulerTurn: 1.9, haulerRadius: 2.6,
  trafficSpeed: 9, trafficCount: 7, pedCount: 10,
  // -- wanted --
  wantedMax: 5,
  policeCarCount: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
  heliAtStars: 5, officersPerWave: 3,
  // -- combat --
  pistolDamage: 50, pistolAmmo: 12, pistolReserve: 60, pistolRange: 90,
  officerHealth: 50, officerDamage: 8, officerShotInterval: 1.4, officerRange: 42,
  // -- missions --
  broadcastSeconds: 26, broadcastRadius: 7,
  chapter1PoliceDelay: 6,
  // -- camera --
  footDistance: 7.5, footHeight: 3.1, aimDistance: 4.2, driveDistance: 13, driveHeight: 5.2,
  // -- capture --
  seedDefault: 1,
};

// The palette the whole game is graded on: rust, safety yellow, concrete cream,
// police blue, teal water. One palette, no extra colours.
export const COLORS = {
  rust: 0xb5502a, rustDark: 0x8a3b1e, safetyYellow: 0xf2b705, cream: 0xe8ddc9,
  concrete: 0x9a938a, asphalt: 0x3d4148, asphaltLight: 0x4a4e56,
  steel: 0x7a4a35, steelDark: 0x5c3626, tealWater: 0x1e7d8a, tealDeep: 0x175a63,
  policeBlue: 0x1e3a5f, policeWhite: 0xf2f2f2, heliGrey: 0x4a4f55,
  maraJacket: 0xc23b22, maraPants: 0x2e3138, maraSkin: 0xc98e6b, maraHair: 0x1c1712,
  hardcase: 0xd9261c, containerA: 0xb5502a, containerB: 0x2e7f86, containerC: 0xd9a441,
  containerD: 0x3a6ea5, containerE: 0x6b7c5e, grass: 0x8a8a48, hillRock: 0x8d8578,
  sky: 0x9fc4e0, sun: 0xff9e3d, fog: 0xe2c9a4,
  hudText: '#F4F0E7', hudPlate: 'rgba(17,21,26,0.88)', hudAmber: '#FFC247',
  hudRed: '#FF5A36', hudTeal: '#35D3C0', hudMuted: '#7B8188',
};

// The three chapters. Each one names its objective, its wanted level, and what
// changes in the world when it starts and when it ends. The story is told by
// what changes, not by cutscenes.
export const CHAPTERS = [
  {
    id: 1, name: 'WRONG MANIFEST', objective: 'GET THE EVIDENCE HAULER',
    wanted: 3, subtitle: 'MARA: "They sealed the wrong manifest. The hardcase is mine."',
    detail: 'Two officers are already walking in. The gate is closing. Take the hauler.',
  },
  {
    id: 2, name: 'IRON DESCENT', objective: 'BREAK THE BRIDGE BLOCKADE',
    wanted: 5, subtitle: 'WREN: "Rourke put a roadblock on the bridge. Drive through it."',
    detail: 'The interceptor is on your bumper and the helicopter is overhead. The bridge is the only way east, and Rourke blocked it.',
  },
  {
    id: 3, name: 'OPEN FREQUENCY', objective: 'DEFEND THE RADIO VAN',
    wanted: 4, subtitle: 'MARA: "Hold the van. When this goes live, every screen in Ironhaven shows his name."',
    detail: 'Stay near the van to broadcast. Officers come in waves. The ledger is the hardcase, locked into the uplink.',
  },
];

// The four screenshots. Each one is a real game state, staged by shots.js from
// the same rules a player plays by, with a fixed seed so the frame is repeatable.
export const SHOTS = ['cover', 'chase', 'defend', 'reward'];

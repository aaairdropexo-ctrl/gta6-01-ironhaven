// IRONHAVEN — the district minimap. A 180px top-down map of the three
// districts: the roads, the channel, the zone labels, Mara's arrow, the
// objective diamond, at most two police dots, and the garage square when it
// opens. It is a map, not a second screen: nothing on it is drawn that the
// player cannot already see in the world.

import { COLORS } from './config.js';

const W = 180, H = 180;
const SCALE = 0.40;
const OX = 7.6, OY = 53;

export function createDistrictMinimap(ctx) {
  const canvas = document.getElementById('minimap');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const { world } = ctx;

  function px(x) { return OX + (x + 200) * SCALE; }
  function py(z) { return OY + (z + 92) * SCALE; }

  function drawRoad(points, color, width) {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
    g.beginPath();
    points.forEach(([x, z], i) => { if (i === 0) g.moveTo(px(x), py(z)); else g.lineTo(px(x), py(z)); });
    g.stroke();
  }

  function update() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#11151a';
    g.fillRect(0, 0, W, H);
    // the channel water
    g.fillStyle = '#2e7f86';
    g.fillRect(px(118), py(-45), (158 - 118) * SCALE, 90 * SCALE);
    // roads
    drawRoad([[-188, -52], [-152, 18], [-128, 52], [-104, -48], [-78, 32], [-58, 0], [-20, 0], [40, 0], [86, 0], [118, 0], [140, 0], [158, 0], [186, 6], [204, 8]], '#8a8f96', 2);
    drawRoad([[-40, -58], [60, -58], [60, 58], [-40, 58], [-40, -58]], '#6a6f76', 1.5);
    drawRoad([[158, 0], [186, 6], [204, 8], [204, 52], [170, 56], [162, 30]], '#6a6f76', 1.5);
    // zone labels
    g.fillStyle = '#7B8188';
    g.font = '700 8px "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.fillText('WIRE HILL', px(-140), py(-70));
    g.fillText('YARD 17', px(10), py(-70));
    g.fillText('IRON BRIDGE', px(136), py(-58));
    // EAST DOCK sits right of the channel: right-align it so the wide fallback
    // font can never clip it off the canvas edge
    g.textAlign = 'right';
    g.fillText('EAST DOCK', 176, py(62));
    g.textAlign = 'center';
    // the garage, when it opens
    if (ctx.progression.state.garageOpen) {
      g.fillStyle = COLORS.hudTeal;
      g.fillRect(px(30) - 3, py(55) - 3, 6, 6);
    }
    // the objective: an amber diamond at the current target
    const target = objectivePos();
    if (target) {
      g.fillStyle = COLORS.hudAmber;
      g.beginPath();
      g.moveTo(px(target.x), py(target.z) - 5);
      g.lineTo(px(target.x) + 5, py(target.z));
      g.lineTo(px(target.x), py(target.z) + 5);
      g.lineTo(px(target.x) - 5, py(target.z));
      g.closePath(); g.fill();
    }
    // police, at most two dots
    g.fillStyle = COLORS.hudRed;
    for (const car of ctx.police.cars.slice(0, 2)) {
      g.beginPath(); g.arc(px(car.pos.x), py(car.pos.z), 2.5, 0, Math.PI * 2); g.fill();
    }
    // Mara: a white arrow
    const p = ctx.vehicles.drive.active ? ctx.vehicles.drive.pos : ctx.player.state.pos;
    const heading = ctx.vehicles.drive.active ? ctx.vehicles.drive.heading : ctx.player.state.heading;
    g.save();
    g.translate(px(p.x), py(p.z));
    g.rotate(heading);
    g.fillStyle = '#F4F0E7';
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
    // frame
    g.strokeStyle = 'rgba(244,240,231,0.35)'; g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function objectivePos() {
    const ch = ctx.missions.state.chapter;
    if (ch === 1) return { x: -8, z: 0 };
    if (ch === 2) return { x: 150, z: 0 };
    if (ch === 3) return { x: 186, z: 12 };
    return null;
  }

  return { update };
}

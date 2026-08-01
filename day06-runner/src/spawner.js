// Row generator. Produces obstacle/coin entities at the far edge, guaranteeing
// every obstacle row leaves at least one clear lane so the run stays fair.

import { LANES, OB, DRAW_DIST } from './config.js';

// deterministic-ish pick without Math.random dependence on any single call site
const rand = () => Math.random();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

let uid = 0;

function make(kind, laneIndex) {
  return {
    id: (uid += 1),
    kind,
    laneIndex,
    lane: LANES[laneIndex],
    d: DRAW_DIST,
    resolved: false,
    taken: false,
    spin: rand() * Math.PI * 2,
  };
}

export class Spawner {
  constructor() { this.reset(); }

  reset() {
    this.rowCount = 0;
    uid = 0;
  }

  // Build one row. Early rows are gentle; difficulty rises with rowCount.
  buildRow() {
    this.rowCount += 1;
    const out = [];
    const n = this.rowCount;

    // Coin-only rows sprinkled in — a short trail the player weaves toward.
    if (n > 2 && rand() < 0.32) {
      const lane = Math.floor(rand() * 3);
      out.push(make(OB.COIN, lane));
      return out;
    }

    // Number of blocked lanes: 1 early, up to 2 later. Never all 3.
    let blocked = 1;
    if (n > 6 && rand() < 0.45) blocked = 2;

    const lanes = [0, 1, 2];
    // shuffle
    for (let i = lanes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const chosen = lanes.slice(0, blocked);

    const kinds = n > 4 ? [OB.BLOCK, OB.LOW, OB.HIGH] : [OB.BLOCK, OB.LOW];
    for (const lane of chosen) out.push(make(pick(kinds), lane));

    // Drop a coin into one of the free lanes now and then.
    const free = lanes.slice(blocked);
    if (free.length && rand() < 0.5) out.push(make(OB.COIN, pick(free)));

    return out;
  }
}

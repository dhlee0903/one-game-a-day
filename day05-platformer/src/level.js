// Level layouts as tile-type grids, built programmatically. Three stages.
// Blocks that are bumped from below (?, coin-brick, brick) live in the grid;
// free-floating coins are a separate list.

import { CELL, TILE } from './config.js';

function stage(cols, build) {
  const rows = 15;
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(TILE.EMPTY));
  const coins = [];
  const enemies = [];
  const api = {
    ground(c0, c1) { for (let c = c0; c <= c1; c += 1) { tiles[13][c] = TILE.GROUND; tiles[14][c] = TILE.GROUND; } },
    pit(c0, c1) { for (let c = c0; c <= c1; c += 1) { tiles[13][c] = TILE.EMPTY; tiles[14][c] = TILE.EMPTY; } },
    put(r, c, t) { tiles[r][c] = t; },
    fill(r, c0, c1, t) { for (let c = c0; c <= c1; c += 1) tiles[r][c] = t; },
    coin(r, c) { coins.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, taken: false }); },
    coinRow(r, c0, c1) { for (let c = c0; c <= c1; c += 1) api.coin(r, c); },
    enemy(c) { enemies.push({ x: c * CELL, y: 12 * CELL }); },
  };
  const meta = build(api);
  return {
    cols, rows, width: cols * CELL, height: rows * CELL, tiles, coins, enemies,
    spawn: { x: 4 * CELL, y: 12 * CELL }, goal: { x: meta.goal * CELL, y: 11 * CELL },
  };
}

export function buildStages() {
  return [
    stage(110, (a) => {
      a.ground(0, 109);
      a.pit(30, 31); a.pit(72, 73);
      a.put(9, 17, TILE.BRICK); a.put(9, 18, TILE.QITEM); a.put(9, 19, TILE.BRICK);
      a.put(9, 21, TILE.QCOIN); a.put(9, 23, TILE.QCOIN);
      a.put(9, 40, TILE.COINBRICK);
      a.fill(10, 52, 56, TILE.BRICK); a.coinRow(9, 52, 56);
      a.coinRow(11, 44, 46); a.coinRow(11, 84, 86);
      a.enemy(26); a.enemy(48); a.enemy(64); a.enemy(90);
      return { goal: 105 };
    }),
    stage(120, (a) => {
      a.ground(0, 119);
      a.pit(24, 26); a.pit(60, 61); a.pit(92, 93);
      a.put(9, 14, TILE.QCOIN); a.put(9, 15, TILE.BRICK); a.put(9, 16, TILE.QITEM);
      a.fill(10, 34, 38, TILE.BRICK); a.coinRow(9, 34, 38);
      a.put(9, 45, TILE.QITEM);
      a.put(9, 70, TILE.COINBRICK); a.put(9, 71, TILE.COINBRICK);
      a.fill(10, 80, 84, TILE.BRICK);
      a.coinRow(11, 48, 51); a.coinRow(11, 98, 100);
      a.enemy(20); a.enemy(40); a.enemy(55); a.enemy(78); a.enemy(104);
      return { goal: 115 };
    }),
    stage(120, (a) => {
      a.ground(0, 119);
      a.pit(20, 22); a.pit(40, 42); a.pit(64, 66);
      a.put(9, 12, TILE.QITEM);
      a.fill(10, 28, 32, TILE.BRICK); a.put(9, 30, TILE.QCOIN); a.coin(9, 28); a.coin(9, 32);
      a.put(9, 50, TILE.COINBRICK); a.put(9, 52, TILE.QCOIN);
      a.fill(10, 72, 76, TILE.BRICK); a.coinRow(9, 72, 76);
      // staircase up to the pole
      a.fill(12, 100, 104, TILE.GROUND); a.fill(11, 101, 104, TILE.GROUND);
      a.fill(10, 102, 104, TILE.GROUND); a.fill(9, 103, 104, TILE.GROUND);
      a.enemy(16); a.enemy(36); a.enemy(58); a.enemy(84);
      a.coinRow(11, 44, 47);
      return { goal: 112 };
    }),
  ];
}

// Level layout, built programmatically so tiles/entities line up exactly.
// Returns a solid-tile grid plus coin/enemy/spawn/goal data in world pixels.

import { CELL } from './config.js';

export function buildLevel() {
  const cols = 100;
  const rows = 15;
  const solid = Array.from({ length: rows }, () => Array(cols).fill(false));
  const fill = (r, c0, c1) => { for (let c = c0; c <= c1; c += 1) solid[r][c] = true; };

  // ground (two tiles thick) with a couple of jumpable pits
  fill(13, 0, cols - 1);
  fill(14, 0, cols - 1);
  [[34, 35], [66, 67]].forEach(([a, b]) => {
    for (let c = a; c <= b; c += 1) { solid[13][c] = false; solid[14][c] = false; }
  });

  // floating platforms
  [[14, 18], [44, 48], [70, 74]].forEach(([a, b]) => fill(10, a, b));
  // low step near the second pit so it's crossable both ways
  fill(11, 38, 40);
  fill(11, 60, 62);

  // coins
  const coins = [];
  const coinRow = (r, c0, c1) => {
    for (let c = c0; c <= c1; c += 1) coins.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, taken: false });
  };
  [[15, 17], [45, 47], [71, 73]].forEach(([a, b]) => coinRow(9, a, b));  // over platforms
  [[26, 28], [54, 56], [84, 86]].forEach(([a, b]) => coinRow(11, a, b)); // reachable from ground

  const enemies = [22, 50, 80, 88].map((c) => ({ x: c * CELL, y: 12 * CELL }));
  const spawn = { x: 4 * CELL, y: 12 * CELL };
  const goal = { x: 96 * CELL, y: 11 * CELL };

  return {
    cols, rows, width: cols * CELL, height: rows * CELL, solid, coins, enemies, spawn, goal,
  };
}

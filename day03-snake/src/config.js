// Game constants — single source of truth for grid, speed, and colors.

export const COLS = 16;
export const ROWS = 16;
export const CELL = 27; // canvas = 432 x 432

// Gravity of the game: how often the snake advances. It speeds up as you eat.
export const BASE_TICK_MS = 200;
export const MIN_TICK_MS = 100;
export const SPEEDUP_MS = 3; // faster per food eaten

export const CRASH_DELAY_MS = 550; // show the crash before the game-over screen

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// Light theme — a checkerboard board so every cell reads clearly.
export const COLORS = {
  cellA: '#eef2f9',
  cellB: '#e2e8f3',
  head: '#2fb344',
  body: '#33a247',
  bodyAlt: '#2a8c3c',
  food: '#e5484d',
  foodGlow: 'rgba(229, 72, 77, .45)',
  eye: '#0f2418',
  crash: '#e5484d',
};

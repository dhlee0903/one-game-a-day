// Game constants — single source of truth for grid, speed, and colors.

export const COLS = 20;
export const ROWS = 20;
export const CELL = 22; // canvas = 440 x 440

// Gravity of the game: how often the snake advances. It speeds up as you eat.
export const BASE_TICK_MS = 200;
export const MIN_TICK_MS = 100;
export const SPEEDUP_MS = 3; // faster per food eaten

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const COLORS = {
  grid: 'rgba(255, 255, 255, .035)',
  head: '#9bf6ac',
  body: '#39d353',
  bodyAlt: '#2ea043',
  food: '#ff5b5b',
  foodGlow: 'rgba(255, 91, 91, .55)',
  eye: '#0d1117',
};

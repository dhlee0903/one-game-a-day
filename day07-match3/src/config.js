// Match-3 constants — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v7.7';

export const COLS = 8;
export const ROWS = 8;
export const NUM_COLORS = 6;
export const CELL = 52;
export const PAD = 8;
export const BOARD_W = COLS * CELL + PAD * 2;
export const BOARD_H = ROWS * CELL + PAD * 2;

// In-canvas HUD strip above the grid, so score/stage/moves live inside the game.
export const HUD_H = 86;
export const CANVAS_W = BOARD_W;
export const CANVAS_H = HUD_H + BOARD_H;

// Special block kinds and the match shape that creates each (modern match-3):
//  - 가로 4  → ROW    : clears the whole row
//  - 세로 4  → COL    : clears the whole column
//  - 2 x 2   → BOMB   : clears the surrounding 3x3
//  - 5 매치  → COLOR  : clears every gem of one colour (rainbow)
export const SP = { NONE: 0, ROW: 'row', COL: 'col', BOMB: 'bomb', COLOR: 'color' };
export const COLOR_GEM = -1; // colour used by a rainbow (COLOR) block

export const POINTS_PER_GEM = 20;

// 10 stages: reach the target score within the move budget.
export const STAGES = [
  { moves: 30, target: 1200 },
  { moves: 28, target: 1800 },
  { moves: 26, target: 2600 },
  { moves: 26, target: 3400 },
  { moves: 24, target: 4300 },
  { moves: 24, target: 5400 },
  { moves: 22, target: 6600 },
  { moves: 22, target: 8000 },
  { moves: 20, target: 9600 },
  { moves: 20, target: 12000 },
];

// Six monsters in deliberately distinct hues (green / bone-white / red / blue /
// purple / orange) so they never blur together. `kind` drives the face+shape.
export const GEM_COLORS = [
  { kind: 'zombie', base: '#4cc85a', light: '#8fe897', dark: '#2f9a3d' }, // green
  { kind: 'skeleton', base: '#e7edf4', light: '#ffffff', dark: '#aeb9c8' }, // bone white
  { kind: 'demon', base: '#ff4d44', light: '#ff897f', dark: '#bf2d26' }, // red
  { kind: 'slime', base: '#38a1ff', light: '#82c5ff', dark: '#1f6dc2' }, // blue
  { kind: 'ghost', base: '#b06bff', light: '#d0a6ff', dark: '#7d3fd0' }, // purple
  { kind: 'pumpkin', base: '#ff9a2e', light: '#ffc06e', dark: '#d1701a' }, // orange
];

export const UI = {
  bg: '#141a26',
  cell0: '#1d2636',
  cell1: '#222c3e',
  gridLine: '#2c3752',
  select: '#ffffff',
  text: '#e6edf3',
  dim: '#8fa0b5',
  accent: '#ffd23f',
};

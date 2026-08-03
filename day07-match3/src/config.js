// Match-3 constants — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v7.5';

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

export const GEM_COLORS = [
  { base: '#ff5a63', light: '#ff8f95', dark: '#c9343d' }, // red
  { base: '#ffb03a', light: '#ffcd7c', dark: '#c47c14' }, // amber
  { base: '#3fce6a', light: '#7fe59a', dark: '#249a48' }, // green
  { base: '#3aa0ff', light: '#7fc2ff', dark: '#1f6fc4' }, // blue
  { base: '#a566ff', light: '#c79bff', dark: '#7239c4' }, // purple
  { base: '#ff5fae', light: '#ff97cb', dark: '#c73583' }, // pink
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

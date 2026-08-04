// Match-3 constants — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v7.32';

// Frames a matched gem takes to shrink/fade out (its dying face + the pop).
// Lower = snappier "터지는" pop and faster cascades.
export const CLEAR_LIFE = 16;

// Moves-left threshold that triggers the low-moves alarm + urgent tempo.
export const LOW_MOVES = 5;

// Continue after running out of moves: pay gold for +N moves, cost doubles each
// time within the same stage attempt.
export const CONTINUE_MOVES = 3;
export const CONTINUE_BASE = 100;

// Active items (bottom bar). `target: true` → arm, then tap a board cell.
// `price` scales with how powerful the item is (gold to buy one when out).
export const ITEMS = [
  { id: 'hammer', name: '망치', target: true, price: 60, desc: '한 칸 제거' },
  { id: 'shuffle', name: '섞기', target: false, price: 90, desc: '보드 섞기' },
  { id: 'bomb', name: '폭탄', target: true, price: 140, desc: '주변 3×3 제거' },
  { id: 'cross', name: '십자', target: true, price: 170, desc: '가로·세로 줄 제거' },
  { id: 'color', name: '색폭탄', target: true, price: 240, desc: '같은 색 전체 제거' },
];
export const ITEM_START = 2;   // uses of each item at a fresh game start
export const START_GOLD = 200;
export const STAGE_GOLD = 60;  // base reward per stage clear (+ leftover moves)

// Idle time (frames) before a possible-match hint is shown.
export const HINT_DELAY = 300; // ~5s at 60fps

// Difficulty: monster types in play rises with the stage (harder to match).
export function stageColors(stageIndex) {
  return Math.min(NUM_COLORS, 4 + Math.floor(stageIndex / 3)); // 4 → 5 → 6
}

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

// Special block kinds and the match shape that creates each:
//  - 가로 4       → ROW     : clears the whole row (firework)
//  - 세로 4       → COL     : clears the whole column (firework)
//  - 2 x 2        → MISSILE : bat flies to the best cell, removes 1 block
//  - ㄱ/ㄴ/T (5)  → BOMB    : clears the surrounding 3x3
//  - 5 일자       → COLOR   : clears every gem of one colour (rainbow)
export const SP = { NONE: 0, ROW: 'row', COL: 'col', BOMB: 'bomb', MISSILE: 'missile', COLOR: 'color' };
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

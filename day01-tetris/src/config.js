// Game configuration: board dimensions, piece definitions, scoring rules.
// Kept free of logic so every other module shares a single source of truth.

export const COLS = 10;
export const ROWS = 20;
export const CELL = 30;

// Tetromino colors keyed by type.
export const COLORS = {
  I: '#4dd0e1',
  J: '#5c6bc0',
  L: '#ffa726',
  O: '#ffee58',
  S: '#66bb6a',
  T: '#ab47bc',
  Z: '#ef5350',
};

// Spawn matrices. Square matrices so rotation is a clean transpose+reverse.
export const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

// Points awarded for clearing N lines at once (index = line count), times level.
export const SCORE_TABLE = [0, 100, 300, 500, 800];
export const SOFT_DROP_POINT = 1;
export const HARD_DROP_POINT = 2;

// Level progression and gravity.
export const LINES_PER_LEVEL = 10;
export const BASE_DROP_MS = 1000;
export const MIN_DROP_MS = 80;
export const SPEED_STEP_MS = 80;

// Wall-kick offsets tried, in order, when a rotation collides.
export const WALL_KICKS = [0, -1, 1, -2, 2];

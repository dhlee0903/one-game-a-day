// The playfield grid: owns settled blocks, collision tests, merging a locked
// piece, and clearing completed rows. Holds no rendering or timing concerns.

import { COLS, ROWS } from './config.js';

export class Board {
  constructor() {
    this.grid = Board.empty();
  }

  static empty() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  reset() {
    this.grid = Board.empty();
  }

  // Does `shape` collide with walls, floor, or settled blocks when the piece
  // is offset by (dx, dy)? A custom shape lets callers test a rotation.
  collides(piece, dx, dy, shape = piece.shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.grid[ny][nx]) return true;
      }
    }
    return false;
  }

  // Stamp a piece into the grid permanently.
  merge(piece) {
    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const y = piece.y + r;
        if (y >= 0) this.grid[y][piece.x + c] = piece.type;
      });
    });
  }

  // Remove full rows, shifting everything above down. Returns rows cleared.
  clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every((cell) => cell)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // re-check the same index after the shift
      }
    }
    return cleared;
  }
}

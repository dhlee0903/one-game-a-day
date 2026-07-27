// Tetromino model and the "7-bag" randomizer.
// A bag yields all seven pieces in random order before repeating, which keeps
// piece distribution fair (no long droughts of a needed piece).

import { SHAPES, COLS } from './config.js';

const TYPES = Object.keys(SHAPES);

export class Tetromino {
  constructor(type) {
    this.type = type;
    this.shape = SHAPES[type].map((row) => row.slice());
    // Center horizontally; I-piece starts one row high so it enters cleanly.
    this.x = Math.floor((COLS - this.shape[0].length) / 2);
    this.y = type === 'I' ? -1 : 0;
  }

  // Rotate a square matrix 90deg. dir = 1 clockwise, -1 counter-clockwise.
  static rotateMatrix(shape, dir) {
    const n = shape.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dir > 0) out[c][n - 1 - r] = shape[r][c];
        else out[n - 1 - c][r] = shape[r][c];
      }
    }
    return out;
  }

  rotatedShape(dir) {
    return Tetromino.rotateMatrix(this.shape, dir);
  }
}

export class Bag {
  constructor() {
    this.queue = [];
  }

  refill() {
    const types = TYPES.slice();
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.queue.push(...types);
  }

  next() {
    if (this.queue.length === 0) this.refill();
    return new Tetromino(this.queue.shift());
  }
}

// The snake model: body segments, direction, and movement. No rendering,
// no collision policy — the game decides what a collision means.

import { COLS, ROWS, DIRS } from './config.js';

export class Snake {
  constructor() {
    this.reset();
  }

  reset() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    // Start length 3, heading right.
    this.body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    this.dir = DIRS.right;
    this.queued = DIRS.right;
    this.growBy = 0;
  }

  head() {
    return this.body[0];
  }

  // Queue a direction for the next step; ignore 180° reversals into the neck.
  setDir(d) {
    if (d.x === -this.dir.x && d.y === -this.dir.y) return;
    this.queued = d;
  }

  // The cell the head will move into next step.
  nextHead() {
    const h = this.head();
    return { x: h.x + this.queued.x, y: h.y + this.queued.y };
  }

  // Advance one cell: commit the queued direction, add a head, drop the tail
  // unless we're still growing.
  step() {
    this.dir = this.queued;
    this.body.unshift(this.nextHead());
    if (this.growBy > 0) this.growBy -= 1;
    else this.body.pop();
  }

  grow(n = 1) {
    this.growBy += n;
  }

  // Is (x, y) part of the snake? `ignoreTail` skips the last segment, which is
  // about to move away this step.
  occupies(x, y, ignoreTail = false) {
    const body = ignoreTail ? this.body.slice(0, -1) : this.body;
    return body.some((s) => s.x === x && s.y === y);
  }
}

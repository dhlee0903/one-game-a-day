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
    this.queue = []; // buffered turns, applied one per step
    this.growBy = 0;
  }

  head() {
    return this.body[0];
  }

  // Buffer a turn. Validating against the LAST buffered/current direction (not
  // just the current one) lets two quick presses — e.g. a corner turn near a
  // wall — both register instead of the second being swallowed.
  setDir(d) {
    const ref = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (d.x === -ref.x && d.y === -ref.y) return; // no 180° reversal
    if (d.x === ref.x && d.y === ref.y) return;   // no duplicate
    if (this.queue.length < 2) this.queue.push(d); // keep at most 2 pending
  }

  // The direction that will be applied on the next step.
  _pending() {
    return this.queue.length ? this.queue[0] : this.dir;
  }

  // The cell the head will move into next step.
  nextHead() {
    const h = this.head();
    const d = this._pending();
    return { x: h.x + d.x, y: h.y + d.y };
  }

  // Advance one cell: commit the next buffered direction, add a head, drop the
  // tail unless we're still growing.
  step() {
    if (this.queue.length) this.dir = this.queue.shift();
    this.body.unshift({ x: this.head().x + this.dir.x, y: this.head().y + this.dir.y });
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

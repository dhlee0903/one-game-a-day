// Core game orchestration: owns state, the gravity loop, scoring, and the
// running/paused/over state machine. Exposes semantic commands (moveLeft,
// rotate, hardDrop, ...) that the input layer drives.

import {
  SCORE_TABLE, SOFT_DROP_POINT, HARD_DROP_POINT,
  LINES_PER_LEVEL, BASE_DROP_MS, MIN_DROP_MS, SPEED_STEP_MS, WALL_KICKS,
} from './config.js';
import { Board } from './board.js';
import { Bag, Tetromino } from './tetromino.js';

export class Game {
  constructor(renderer, { onStats, onStateChange } = {}) {
    this.renderer = renderer;
    this.onStats = onStats || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.board = new Board();
    this._raf = 0;
    this._resetState();
  }

  _resetState() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = BASE_DROP_MS;
    this.dropTimer = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.over = false;
    this.current = null;
    this.next = null;
    this.heldPiece = null;
    this.canHold = true; // one hold per drop; re-enabled when a piece locks
  }

  start() {
    cancelAnimationFrame(this._raf);
    this.board.reset();
    this.bag = new Bag();
    this._resetState();
    this.current = this.bag.next();
    this.next = this.bag.next();
    this.running = true;
    this._emitStats();
    this.renderer.drawNext(this.next);
    this.renderer.drawHold(this.heldPiece, this.canHold);
    this.onStateChange('playing');
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  togglePause() {
    if (!this.running || this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.onStateChange('paused');
    } else {
      this.lastTime = 0;
      this.onStateChange('playing');
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  // ----- commands -----

  moveLeft() { this._shift(-1); }
  moveRight() { this._shift(1); }

  _shift(dx) {
    if (!this._active()) return;
    if (!this.board.collides(this.current, dx, 0)) this.current.x += dx;
    this._draw();
  }

  softDrop() {
    if (!this._active()) return;
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y += 1;
      this.score += SOFT_DROP_POINT;
      this._emitStats();
    }
    this.dropTimer = 0;
    this._draw();
  }

  rotate(dir) {
    if (!this._active()) return;
    const rotated = this.current.rotatedShape(dir);
    for (const kick of WALL_KICKS) {
      if (!this.board.collides(this.current, kick, 0, rotated)) {
        this.current.shape = rotated;
        this.current.x += kick;
        break;
      }
    }
    this._draw();
  }

  hardDrop() {
    if (!this._active()) return;
    let dist = 0;
    while (!this.board.collides(this.current, 0, dist + 1)) dist++;
    this.current.y += dist;
    this.score += dist * HARD_DROP_POINT;
    this._emitStats();
    this._lock();
  }

  // Stash the current piece, or swap it with the stashed one. Allowed once
  // per drop so it can't be used to stall indefinitely.
  hold() {
    if (!this._active() || !this.canHold) return;
    const currentType = this.current.type;
    if (this.heldPiece) {
      this.current = new Tetromino(this.heldPiece.type);
      this.heldPiece = new Tetromino(currentType);
    } else {
      this.heldPiece = new Tetromino(currentType);
      this.current = this.next;
      this.next = this.bag.next();
      this.renderer.drawNext(this.next);
    }
    this.canHold = false;
    this.renderer.drawHold(this.heldPiece, this.canHold);
    if (this.board.collides(this.current, 0, 0)) this._gameOver();
    this._draw();
  }

  // ----- internals -----

  _active() {
    return this.running && !this.paused && !this.over;
  }

  ghostY() {
    let dist = 0;
    while (!this.board.collides(this.current, 0, dist + 1)) dist++;
    return this.current.y + dist;
  }

  _gravity() {
    if (!this.board.collides(this.current, 0, 1)) this.current.y += 1;
    else this._lock();
  }

  _lock() {
    this.board.merge(this.current);
    const cleared = this.board.clearLines();
    if (cleared > 0) this._score(cleared);

    this.current = this.next;
    this.next = this.bag.next();
    this.renderer.drawNext(this.next);

    this.canHold = true;
    this.renderer.drawHold(this.heldPiece, this.canHold);

    if (this.board.collides(this.current, 0, 0)) this._gameOver();
  }

  _score(cleared) {
    this.score += SCORE_TABLE[cleared] * this.level;
    this.lines += cleared;
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    this.dropInterval = Math.max(MIN_DROP_MS, BASE_DROP_MS - (this.level - 1) * SPEED_STEP_MS);
    this._emitStats();
  }

  _gameOver() {
    this.over = true;
    this.running = false;
    this.onStateChange('over', { score: this.score, lines: this.lines });
  }

  _loop(t) {
    if (!this._active()) return;
    if (!this.lastTime) this.lastTime = t;
    const dt = t - this.lastTime;
    this.lastTime = t;
    this.dropTimer += dt;
    if (this.dropTimer > this.dropInterval) {
      this._gravity();
      this.dropTimer = 0;
    }
    this._draw();
    this._raf = requestAnimationFrame((n) => this._loop(n));
  }

  _draw() {
    if (this.current) this.renderer.render(this.board, this.current, this.ghostY());
  }

  _emitStats() {
    this.onStats({ score: this.score, lines: this.lines, level: this.level });
  }
}

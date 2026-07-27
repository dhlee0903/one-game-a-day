// Core game orchestration: owns state, the gravity loop, scoring, and the
// running/paused/over state machine. Exposes semantic commands (moveLeft,
// rotate, hardDrop, ...) that the input layer drives.

import {
  SCORE_TABLE, SOFT_DROP_POINT, HARD_DROP_POINT, COMBO_POINT, CLEAR_ANIM_MS,
  LINES_PER_LEVEL, BASE_DROP_MS, MIN_DROP_MS, SPEED_STEP_MS,
  JLSTZ_KICKS, I_KICKS,
} from './config.js';
import { Board } from './board.js';
import { Bag, Tetromino } from './tetromino.js';

export class Game {
  constructor(renderer, { onStats, onStateChange, onClear } = {}) {
    this.renderer = renderer;
    this.onStats = onStats || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.onClear = onClear || (() => {});
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
    this.combo = -1;     // -1 = no streak; incremented per line-clearing lock
    this.clearAnim = null; // { rows, elapsed, cleared } while a clear plays out
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
    const piece = this.current;
    if (piece.type === 'O') return; // O never needs to rotate or kick

    const from = piece.rotation;
    const to = (from + (dir > 0 ? 1 : 3)) % 4;
    const rotated = piece.rotatedShape(dir);
    const table = piece.type === 'I' ? I_KICKS : JLSTZ_KICKS;
    const tests = table[`${from}>${to}`];

    // Try each kick offset in order; the first that clears wins. SRS y is
    // up-positive, so negate it for our downward grid.
    for (const [kx, ky] of tests) {
      if (!this.board.collides(piece, kx, -ky, rotated)) {
        piece.shape = rotated;
        piece.x += kx;
        piece.y += -ky;
        piece.rotation = to;
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
    return this.running && !this.paused && !this.over && !this.clearAnim;
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
    const rows = this.board.fullRows();
    if (rows.length > 0) {
      // Defer removal: flash the rows, then collapse and spawn in _finishClear.
      this.clearAnim = { rows, elapsed: 0, cleared: rows.length };
      return;
    }
    this.combo = -1; // a lock that clears nothing breaks the streak
    this._spawnNext();
  }

  // Rows have finished flashing: collapse them, score the clear, then spawn.
  _finishClear() {
    const { rows, cleared } = this.clearAnim;
    this.board.removeRows(rows);
    this.clearAnim = null;
    this._score(cleared);
    this._spawnNext();
  }

  _spawnNext() {
    this.current = this.next;
    this.next = this.bag.next();
    this.renderer.drawNext(this.next);

    this.canHold = true;
    this.renderer.drawHold(this.heldPiece, this.canHold);

    if (this.board.collides(this.current, 0, 0)) this._gameOver();
  }

  _score(cleared) {
    this.score += SCORE_TABLE[cleared] * this.level;

    // Consecutive clears build a combo; the bonus scales with the streak.
    this.combo += 1;
    if (this.combo > 0) this.score += COMBO_POINT * this.combo * this.level;

    this.lines += cleared;
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
    this.dropInterval = Math.max(MIN_DROP_MS, BASE_DROP_MS - (this.level - 1) * SPEED_STEP_MS);
    this._emitStats();
    this.onClear({ cleared, combo: this.combo });
  }

  _gameOver() {
    this.over = true;
    this.running = false;
    this.onStateChange('over', { score: this.score, lines: this.lines });
  }

  _loop(t) {
    // Keep looping through the clear animation; only a hard stop or pause ends it.
    if (!this.running || this.over || this.paused) return;
    if (!this.lastTime) this.lastTime = t;
    const dt = t - this.lastTime;
    this.lastTime = t;

    if (this.clearAnim) {
      this.clearAnim.elapsed += dt;
      if (this.clearAnim.elapsed >= CLEAR_ANIM_MS) this._finishClear();
    } else {
      this.dropTimer += dt;
      if (this.dropTimer > this.dropInterval) {
        this._gravity();
        this.dropTimer = 0;
      }
    }

    this._draw();
    this._raf = requestAnimationFrame((n) => this._loop(n));
  }

  _draw() {
    let anim = null;
    if (this.clearAnim) {
      anim = { rows: this.clearAnim.rows, progress: Math.min(1, this.clearAnim.elapsed / CLEAR_ANIM_MS) };
    }
    if (this.current || anim) {
      this.renderer.render(this.board, this.current, this.current ? this.ghostY() : 0, anim);
    }
  }

  _emitStats() {
    this.onStats({ score: this.score, lines: this.lines, level: this.level });
  }
}

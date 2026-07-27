// Core game orchestration: owns state, the gravity loop, scoring, and the
// running/paused/over state machine. Exposes semantic commands (moveLeft,
// rotate, hardDrop, ...) that the input layer drives.

import {
  SCORE_TABLE, SOFT_DROP_POINT, HARD_DROP_POINT, COMBO_POINT, CLEAR_ANIM_MS,
  TSPIN_SCORE, TSPIN_MINI_SCORE, B2B_MULTIPLIER,
  LINES_PER_LEVEL, BASE_DROP_MS, MIN_DROP_MS, SPEED_STEP_MS,
  JLSTZ_KICKS, I_KICKS, COLS, ROWS,
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
    this.b2b = false;    // last difficult clear active? drives back-to-back bonus
    this.clearAnim = null; // { rows, elapsed, info } while a clear plays out
    // T-spin detection needs to know the last action was a rotation (not a
    // slide/drop) and whether a tall wall-kick was used.
    this.lastMoveRotation = false;
    this.lastKickBig = false;
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
    if (!this.board.collides(this.current, dx, 0)) {
      this.current.x += dx;
      this.lastMoveRotation = false; // a slide clears any pending T-spin
    }
    this._draw();
  }

  softDrop() {
    if (!this._active()) return;
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y += 1;
      this.score += SOFT_DROP_POINT;
      this.lastMoveRotation = false;
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
    for (let k = 0; k < tests.length; k++) {
      const [kx, ky] = tests[k];
      if (!this.board.collides(piece, kx, -ky, rotated)) {
        piece.shape = rotated;
        piece.x += kx;
        piece.y += -ky;
        piece.rotation = to;
        this.lastMoveRotation = true;
        this.lastKickBig = Math.abs(ky) === 2; // tall kick → T-spin (not mini)
        break;
      }
    }
    this._draw();
  }

  hardDrop() {
    if (!this._active()) return;
    let dist = 0;
    while (!this.board.collides(this.current, 0, dist + 1)) dist++;
    if (dist > 0) {
      this.current.y += dist;
      this.score += dist * HARD_DROP_POINT;
      this.lastMoveRotation = false; // dropping through space isn't a spin
      this._emitStats();
    }
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
    this.lastMoveRotation = false; // swapped piece hasn't been rotated yet
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
    if (!this.board.collides(this.current, 0, 1)) {
      this.current.y += 1;
      this.lastMoveRotation = false;
    } else {
      // Locking after a rotation that couldn't fall further is the T-spin case,
      // so leave lastMoveRotation intact here.
      this._lock();
    }
  }

  // Classic "3-corner T" test: it's a T-spin only if the last action was a
  // rotation and 3+ of the four cells diagonally around the T's center are
  // blocked (by a wall, the floor, or a settled block). Which two corners are
  // "front" (on the side the T points) decides full vs. mini.
  _detectTSpin() {
    const p = this.current;
    if (p.type !== 'T' || !this.lastMoveRotation) return 'none';

    const cx = p.x + 1;
    const cy = p.y + 1; // center of the T's 3x3 box
    const blocked = (dx, dy) => {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true; // wall / floor
      if (y < 0) return false; // above the field is open
      return !!this.board.grid[y][x];
    };
    const tl = blocked(-1, -1);
    const tr = blocked(1, -1);
    const bl = blocked(-1, 1);
    const br = blocked(1, 1);
    if (tl + tr + bl + br < 3) return 'none';

    // Front corners by facing: 0 up, 1 right, 2 down, 3 left.
    const front = { 0: [tl, tr], 1: [tr, br], 2: [bl, br], 3: [tl, bl] }[p.rotation];
    if (front[0] && front[1]) return 'full';
    // Only one front corner blocked → mini, unless a tall kick pulled it in.
    return this.lastKickBig ? 'full' : 'mini';
  }

  _lock() {
    const tspin = this._detectTSpin();
    this.board.merge(this.current);
    const rows = this.board.fullRows();

    if (rows.length > 0) {
      // Defer removal: flash the rows, then collapse and score in _finishClear.
      this.clearAnim = { rows, elapsed: 0, info: { cleared: rows.length, tspin } };
      return;
    }

    if (tspin !== 'none') {
      this._score({ cleared: 0, tspin }); // a spin with no lines still scores
    } else {
      this.combo = -1; // a plain lock that clears nothing breaks the streak
    }
    this._spawnNext();
  }

  // Rows have finished flashing: collapse them, score the clear, then spawn.
  _finishClear() {
    const { rows, info } = this.clearAnim;
    this.board.removeRows(rows);
    this.clearAnim = null;
    this._score(info);
    this._spawnNext();
  }

  _spawnNext() {
    this.current = this.next;
    this.next = this.bag.next();
    this.renderer.drawNext(this.next);
    this.lastMoveRotation = false;
    this.lastKickBig = false;

    this.canHold = true;
    this.renderer.drawHold(this.heldPiece, this.canHold);

    if (this.board.collides(this.current, 0, 0)) this._gameOver();
  }

  _score({ cleared, tspin }) {
    const level = this.level;

    // Base line points depend on whether it was a normal clear or a T-spin.
    let base;
    if (tspin === 'full') base = TSPIN_SCORE[cleared];
    else if (tspin === 'mini') base = TSPIN_MINI_SCORE[cleared];
    else base = SCORE_TABLE[cleared];

    // "Difficult" clears (Tetris or a line-clearing T-spin) chain for B2B.
    const difficult = cleared === 4 || (tspin !== 'none' && cleared > 0);
    const b2bBonus = difficult && this.b2b;
    let points = base * level;
    if (b2bBonus) points = Math.floor(points * B2B_MULTIPLIER);
    this.score += points;

    // Combo counts only line clears; a spin with no lines breaks it.
    if (cleared > 0) {
      this.combo += 1;
      if (this.combo > 0) this.score += COMBO_POINT * this.combo * level;
    } else {
      this.combo = -1;
    }

    // Update the back-to-back flag only on line clears: a difficult clear keeps
    // it alive, a normal clear resets it, a no-line spin leaves it untouched.
    if (cleared > 0) this.b2b = difficult;

    if (cleared > 0) {
      this.lines += cleared;
      this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
      this.dropInterval = Math.max(MIN_DROP_MS, BASE_DROP_MS - (this.level - 1) * SPEED_STEP_MS);
    }

    this._emitStats();
    this.onClear({ cleared, tspin, combo: this.combo, b2b: b2bBonus });
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

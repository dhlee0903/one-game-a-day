// Game orchestration: a small state machine (idle → swap → clearing → falling →
// cascade …), gem tweening, special-block activation with chain reactions,
// scoring, and the 10-stage move-budget/target loop. Reads/writes the Board;
// the renderer only reads.

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_H, SP, COLOR_GEM, POINTS_PER_GEM, STAGES,
} from './config.js';
import { Board } from './board.js';

const EASE = 0.3;
const CLEAR_LIFE = 16; // long enough to read the monster's dying face

export class Game {
  constructor({ onHud, onState } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.board = new Board();
    this.clearing = [];
    this.effects = [];
    this.selected = null;
    this._raf = 0;
    this.reset(0);
  }

  reset(stageIndex) {
    this.stageIndex = stageIndex;
    const stage = STAGES[stageIndex];
    this.board.reset();
    this.score = 0;
    this.movesLeft = stage.moves;
    this.target = stage.target;
    this.cascade = 0;
    this.clearing = [];
    this.effects = [];
    this.selected = null;
    this.phase = 'idle';
    this._sync(true);
    this._emit();
  }

  start() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ---- pixel helpers ----

  static px(c) { return PAD + c * CELL; }

  static py(r) { return HUD_H + PAD + r * CELL; }

  _sync(instant) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const g = this.board.grid[r][c];
        if (!g) continue;
        g.tx = Game.px(c); g.ty = Game.py(r);
        if (g.x === null) {
          g.x = g.tx;
          g.y = g.isNew ? g.ty - BOARD_H : g.ty;
          g.isNew = false;
        }
        if (instant) { g.x = g.tx; g.y = g.ty; }
      }
    }
  }

  // ---- input ----

  cellAt(px, py) {
    const c = Math.floor((px - PAD) / CELL);
    const r = Math.floor((py - HUD_H - PAD) / CELL);
    return this.board.inBounds(r, c) ? { r, c } : null;
  }

  click(cell) {
    if (this.phase !== 'idle' || !cell) return;
    if (!this.selected) { this.selected = cell; return; }
    if (this.selected.r === cell.r && this.selected.c === cell.c) { this.selected = null; return; }
    if (this._adjacent(this.selected, cell)) {
      const a = this.selected; this.selected = null;
      this.trySwap(a, cell);
    } else {
      this.selected = cell;
    }
  }

  _adjacent(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; }

  // Double-tap / double-click a special block to detonate it in place.
  activateSpecial(cell) {
    if (this.phase !== 'idle' || !cell) return;
    const g = this.board.at(cell.r, cell.c);
    if (!g || g.special === SP.NONE) return;
    this.selected = null;
    this.movesLeft -= 1; this._emit();
    this.cascade = 0;
    this._beginClear(new Set([this.board.key(cell.r, cell.c)]), new Map());
  }

  // Cell set cleared when two specials (or a rainbow) are swapped together.
  _comboCells(a, ga, b, gb) {
    const S = new Set();
    const add = (r, c) => { if (this.board.inBounds(r, c)) S.add(this.board.key(r, c)); };
    const addRow = (r) => { for (let c = 0; c < COLS; c += 1) add(r, c); };
    const addCol = (c) => { for (let r = 0; r < ROWS; r += 1) add(r, c); };
    const addBox = (r, c, rad) => { for (let dr = -rad; dr <= rad; dr += 1) for (let dc = -rad; dc <= rad; dc += 1) add(r + dr, c + dc); };
    const addColor = (color) => { for (const p of this.board.cellsOfColor(color)) add(p.r, p.c); };
    const line = (s) => s === SP.ROW || s === SP.COL;
    const aS = ga.special; const bS = gb.special;
    add(a.r, a.c); add(b.r, b.c);

    if (aS === SP.COLOR && bS === SP.COLOR) {
      for (let r = 0; r < ROWS; r += 1) addRow(r); // whole board
    } else if (aS === SP.COLOR || bS === SP.COLOR) {
      const other = aS === SP.COLOR ? gb : ga;
      if (other.special === SP.NONE) addColor(other.color);
      else if (line(other.special)) for (const p of this.board.cellsOfColor(other.color)) { addRow(p.r); addCol(p.c); }
      else if (other.special === SP.BOMB) for (const p of this.board.cellsOfColor(other.color)) addBox(p.r, p.c, 1);
    } else if (aS === SP.BOMB && bS === SP.BOMB) {
      addBox(a.r, a.c, 2); // 5x5
    } else if (line(aS) && line(bS)) {
      addRow(a.r); addCol(a.c); addRow(b.r); addCol(b.c); // cross
    } else { // line + bomb → 3-wide cross
      const cr = a.r; const cc = a.c;
      addRow(cr - 1); addRow(cr); addRow(cr + 1);
      addCol(cc - 1); addCol(cc); addCol(cc + 1);
    }
    return S;
  }

  trySwap(a, b) {
    if (this.phase !== 'idle' || !this._adjacent(a, b)) return;
    const ga = this.board.at(a.r, a.c); const gb = this.board.at(b.r, b.c);
    if (!ga || !gb) return;

    // Special activation swap: a rainbow can swap with anything, and any two
    // specials combine. A single line/bomb + a normal gem is a plain swap
    // (it activates only when the swap forms a match).
    const comboSwap = ga.special === SP.COLOR || gb.special === SP.COLOR
      || (ga.special !== SP.NONE && gb.special !== SP.NONE);
    if (comboSwap) {
      this.movesLeft -= 1; this._emit();
      this.cascade = 0;
      this._beginClear(this._comboCells(a, ga, b, gb), new Map());
      return;
    }

    this.board.swap(a, b);
    this._sync(false);
    this._swapPair = [a, b];
    this.phase = 'swap';
  }

  // ---- resolution ----

  _onSwapArrived() {
    const [a, b] = this._swapPair;
    const res = this.board.detect([a, b]);
    if (res.matched.size > 0) {
      this.movesLeft -= 1; this._emit();
      this.cascade = 0;
      this._beginClear(res.matched, res.specials);
    } else {
      this.board.swap(a, b); // revert
      this._sync(false);
      this.phase = 'swapback';
    }
  }

  _beginClear(matched, specials) {
    const anchors = new Set(specials.keys());
    const remove = new Set();
    for (const k of matched) if (!anchors.has(k)) remove.add(k);

    // chain: any existing special caught in the removal detonates (+ its effect)
    const queue = [...remove];
    while (queue.length) {
      const k = queue.shift();
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.board.grid[r][c];
      if (g && g.special !== SP.NONE) {
        this._detonateFx(r, c, g);
        for (const cell of this.board.effectCells(r, c, g)) {
          const kk = this.board.key(cell.r, cell.c);
          if (!anchors.has(kk) && !remove.has(kk)) { remove.add(kk); queue.push(kk); }
        }
      }
    }

    // remove gems → clearing animation + pop effect
    for (const k of remove) {
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.board.grid[r][c];
      if (g) {
        this.clearing.push({ gem: g, t: 0 });
        this.effects.push({ type: 'pop', x: Game.px(c) + CELL / 2, y: Game.py(r) + CELL / 2, color: g.color, t: 0, life: 14 });
        this.board.grid[r][c] = null;
      }
    }

    // create the new special blocks at their anchors
    for (const [k, sp] of specials) {
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.board.grid[r][c];
      if (g) { g.special = sp.type; if (sp.type === SP.COLOR) g.color = COLOR_GEM; }
    }

    const mult = Math.min(3, 1 + this.cascade * 0.3);
    this.score += Math.round(remove.size * POINTS_PER_GEM * mult);
    if (this.cascade >= 1) this.effects.push({ type: 'combo', n: this.cascade + 1, t: 0, life: 36 });
    this._emit();
    this.phase = 'clearing';
  }

  // Visual burst for a detonating special block.
  _detonateFx(r, c, g) {
    const cx = Game.px(c) + CELL / 2;
    const cy = Game.py(r) + CELL / 2;
    if (g.special === SP.ROW) this.effects.push({ type: 'beam', axis: 'row', r, c, color: g.color, t: 0, life: 18 });
    else if (g.special === SP.COL) this.effects.push({ type: 'beam', axis: 'col', r, c, color: g.color, t: 0, life: 18 });
    else if (g.special === SP.BOMB) this.effects.push({ type: 'ring', x: cx, y: cy, color: g.color, t: 0, life: 20 });
    else if (g.special === SP.COLOR) this.effects.push({ type: 'flash', t: 0, life: 26 });
  }

  _afterClear() {
    this.board.applyGravity();
    this._sync(false);
    this.phase = 'falling';
  }

  _afterFall() {
    const res = this.board.detect(null);
    if (res.matched.size > 0) {
      this.cascade += 1;
      this._beginClear(res.matched, res.specials);
    } else {
      this.cascade = 0;
      if (!this.board.hasMoves()) { this.board.reshuffle(); this._sync(false); return; }
      this._settle();
    }
  }

  _settle() {
    this.phase = 'idle';
    if (this.score >= this.target) {
      this.phase = 'won';
      this.onState('won', { stage: this.stageIndex + 1, score: this.score, last: this.stageIndex === STAGES.length - 1 });
    } else if (this.movesLeft <= 0) {
      this.phase = 'lost';
      this.onState('lost', { stage: this.stageIndex + 1, score: this.score, target: this.target });
    }
  }

  nextStage() {
    if (this.stageIndex < STAGES.length - 1) this.reset(this.stageIndex + 1);
    else this.reset(0);
  }

  retryStage() { this.reset(this.stageIndex); }

  // ---- loop ----

  _allArrived() {
    if (this.clearing.length) return false;
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.board.grid[r][c];
      if (g && (Math.abs(g.x - g.tx) > 0.6 || Math.abs(g.y - g.ty) > 0.6)) return false;
    }
    return true;
  }

  _tween() {
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.board.grid[r][c];
      if (!g) continue;
      g.x += (g.tx - g.x) * EASE;
      g.y += (g.ty - g.y) * EASE;
      if (Math.abs(g.x - g.tx) < 0.5) g.x = g.tx;
      if (Math.abs(g.y - g.ty) < 0.5) g.y = g.ty;
    }
    for (const cl of this.clearing) cl.t += 1;
    this.clearing = this.clearing.filter((cl) => cl.t < CLEAR_LIFE);
    for (const fx of this.effects) fx.t += 1;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
  }

  _loop() {
    this._tween();
    if (this.phase === 'swap' && this._allArrived()) this._onSwapArrived();
    else if (this.phase === 'swapback' && this._allArrived()) this.phase = 'idle';
    else if (this.phase === 'clearing' && this.clearing.length === 0) this._afterClear();
    else if (this.phase === 'falling' && this._allArrived()) this._afterFall();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _emit() {
    this.onHud({
      stage: this.stageIndex + 1,
      score: this.score,
      target: this.target,
      moves: this.movesLeft,
    });
  }
}

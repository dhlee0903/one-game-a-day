// Game orchestration: a small state machine (idle → swap → clearing → falling →
// cascade …), gem tweening, special-block activation with chain reactions,
// scoring, and the 10-stage move-budget/target loop. Reads/writes the Board;
// the renderer only reads.

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_H, SP, COLOR_GEM, POINTS_PER_GEM, STAGES,
  ITEMS, ITEM_START, START_GOLD, STAGE_GOLD, HINT_DELAY, stageColors,
} from './config.js';
import { Board } from './board.js';

const EASE = 0.3;
const CLEAR_LIFE = 16; // long enough to read the monster's dying face

export class Game {
  constructor({ onHud, onState, onItems, sound } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.onItems = onItems || (() => {});
    this.sound = sound || null;
    this.board = new Board();
    this.clearing = [];
    this.effects = [];
    this.selected = null;
    this.armed = null;   // armed active item id (targeted)
    this.hint = null;    // idle match hint [a, b]
    this.idle = 0;
    this.tick = 0;
    this.gold = START_GOLD;
    this.items = {};
    this._raf = 0;
    this.reset(0, true);
  }

  reset(stageIndex, fresh) {
    this.stageIndex = stageIndex;
    const stage = STAGES[stageIndex];
    this.board.colorCount = stageColors(stageIndex); // difficulty rises per stage
    this.board.reset();
    this.score = 0;
    this.movesLeft = stage.moves;
    this.target = stage.target;
    this.cascade = 0;
    this.clearing = [];
    this.effects = [];
    this.selected = null;
    this.armed = null;
    this.hint = null;
    this.idle = 0;
    if (fresh) {
      this.gold = START_GOLD;
      this.items = {};
      for (const it of ITEMS) this.items[it.id] = ITEM_START;
    }
    this.phase = 'idle';
    this._sync(true);
    this._emit();
    this._emitItems();
  }

  _act() { this.idle = 0; this.hint = null; }

  _emitItems() { this.onItems({ items: { ...this.items }, armed: this.armed, gold: this.gold }); }

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
    this._act();
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

  // ---- active items ----

  useItem(id) {
    if (this.phase !== 'idle') return;
    const def = ITEMS.find((i) => i.id === id);
    if (!def) return;
    this._act();
    if ((this.items[id] || 0) <= 0) {
      // out of stock → buy one with gold (per-item price)
      if (this.gold >= def.price) {
        this.gold -= def.price; this.items[id] += 1;
        if (this.sound) this.sound.special();
      } else {
        if (this.sound) this.sound.invalid();
        this._emitItems();
        return;
      }
    }
    if (this.armed === id) { this.armed = null; this._emitItems(); return; } // toggle off
    if (def.target) { this.armed = id; this._emitItems(); return; }
    // instant: shuffle
    this.items[id] -= 1; this.armed = null;
    this.board.reshuffle(); this._sync(true);
    this.effects.push({ type: 'swirl', t: 0, life: 26 });
    if (this.sound) this.sound.special();
    this._emitItems();
  }

  cancelArm() { if (this.armed) { this.armed = null; this._emitItems(); } }

  applyItemAt(cell) {
    if (this.phase !== 'idle' || !this.armed || !cell) return;
    const g = this.board.at(cell.r, cell.c);
    if (!g) return;
    const id = this.armed;
    this._act();
    const matched = new Set();
    const add = (r, c) => { if (this.board.inBounds(r, c)) matched.add(this.board.key(r, c)); };
    if (id === 'hammer') {
      add(cell.r, cell.c);
    } else if (id === 'bomb') {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) add(cell.r + dr, cell.c + dc);
    } else if (id === 'cross') {
      for (let c = 0; c < COLS; c += 1) add(cell.r, c);
      for (let r = 0; r < ROWS; r += 1) add(r, cell.c);
    } else if (id === 'color') {
      const color = g.color < 0 ? this.board._commonColor() : g.color;
      for (const p of this.board.cellsOfColor(color)) add(p.r, p.c);
    }
    // item-signature effect at the target
    const cx = Game.px(cell.c) + CELL / 2;
    const cy = Game.py(cell.r) + CELL / 2;
    if (id === 'hammer') this.effects.push({ type: 'smash', x: cx, y: cy, t: 0, life: 18 });
    else if (id === 'bomb') this.effects.push({ type: 'ring', x: cx, y: cy, color: -1, t: 0, life: 22 });
    else if (id === 'cross') {
      this.effects.push({ type: 'beam', axis: 'row', r: cell.r, c: cell.c, color: -1, t: 0, life: 20 });
      this.effects.push({ type: 'beam', axis: 'col', r: cell.r, c: cell.c, color: -1, t: 0, life: 20 });
    } else if (id === 'color') this.effects.push({ type: 'flash', t: 0, life: 26 });

    this.items[id] -= 1;
    this.armed = null;
    this.cascade = 0;
    if (this.sound) this.sound.boom();
    this._emitItems();
    this._beginClear(matched, new Map());
  }

  // Double-tap / double-click a special block to detonate it in place.
  activateSpecial(cell) {
    if (this.phase !== 'idle' || !cell) return;
    const g = this.board.at(cell.r, cell.c);
    if (!g || g.special === SP.NONE) return;
    this.selected = null;
    this._act();
    this.movesLeft -= 1; this._emit();
    this.cascade = 0;
    if (this.sound) this.sound.boom();
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
    this._act();

    // Special activation swap: a rainbow can swap with anything, and any two
    // specials combine. A single line/bomb + a normal gem is a plain swap
    // (it activates only when the swap forms a match).
    const comboSwap = ga.special === SP.COLOR || gb.special === SP.COLOR
      || (ga.special !== SP.NONE && gb.special !== SP.NONE);
    if (comboSwap) {
      this.movesLeft -= 1; this._emit();
      this.cascade = 0;
      if (this.sound) { this.sound.special(); this.sound.boom(); }
      this._beginClear(this._comboCells(a, ga, b, gb), new Map());
      return;
    }

    this.board.swap(a, b);
    this._sync(false);
    if (this.sound) this.sound.swap();
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
      if (this.sound) this.sound.invalid();
      this.phase = 'swapback';
    }
  }

  _beginClear(matched, specials) {
    const anchors = new Set(specials.keys());
    const remove = new Set();
    for (const k of matched) if (!anchors.has(k)) remove.add(k);

    // chain: any existing special caught in the removal detonates (+ its effect)
    let detonated = false;
    const queue = [...remove];
    while (queue.length) {
      const k = queue.shift();
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.board.grid[r][c];
      if (g && g.special !== SP.NONE) {
        detonated = true;
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
    if (this.sound) {
      this.sound.clear(this.cascade);
      if (specials.size > 0) this.sound.special();
      if (detonated) this.sound.boom();
      if (this.cascade >= 1) this.sound.combo(this.cascade + 1);
    }
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
      const reward = STAGE_GOLD + Math.max(0, this.movesLeft) * 10;
      this.gold += reward;
      // bonus: a random active item
      const bonus = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      this.items[bonus.id] += 1;
      this._emitItems();
      if (this.sound) this.sound.win();
      this.onState('won', {
        stage: this.stageIndex + 1, score: this.score, reward, gold: this.gold,
        bonusItem: bonus.name,
        last: this.stageIndex === STAGES.length - 1,
      });
    } else if (this.movesLeft <= 0) {
      this.phase = 'lost';
      if (this.sound) this.sound.lose();
      this.onState('lost', { stage: this.stageIndex + 1, score: this.score, target: this.target });
    }
  }

  nextStage() {
    if (this.stageIndex < STAGES.length - 1) this.reset(this.stageIndex + 1, false); // keep gold + items
    else this.reset(0, true); // full restart
  }

  retryStage() { this.reset(this.stageIndex, false); }

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
    this.tick += 1;
    this._tween();
    if (this.phase === 'swap' && this._allArrived()) this._onSwapArrived();
    else if (this.phase === 'swapback' && this._allArrived()) this.phase = 'idle';
    else if (this.phase === 'clearing' && this.clearing.length === 0) this._afterClear();
    else if (this.phase === 'falling' && this._allArrived()) this._afterFall();
    else if (this.phase === 'idle') this._maybeHint();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // After a stretch of inactivity, surface a possible match to nudge the player.
  _maybeHint() {
    if (this.armed || this.hint) return;
    this.idle += 1;
    if (this.idle >= HINT_DELAY) this.hint = this.board.findMove();
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

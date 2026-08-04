// Game orchestration: a small state machine (idle → swap → clearing → falling →
// cascade …), gem tweening, special-block activation with chain reactions,
// scoring, and the 10-stage move-budget/target loop. Reads/writes the Board;
// the renderer only reads.

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_H, SP, COLOR_GEM, POINTS_PER_GEM, STAGES,
  ITEMS, ITEM_START, START_GOLD, STAGE_GOLD, HINT_DELAY, stageColors,
  CONTINUE_MOVES, CONTINUE_BASE, LOW_MOVES, CLEAR_LIFE,
} from './config.js';
import { Board } from './board.js';

const EASE = 0.42; // gem tween speed — higher settles swaps/falls faster

export class Game {
  constructor({ onHud, onState, onItems, sound, haptic } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.onItems = onItems || (() => {});
    this.sound = sound || null;
    this.haptic = haptic || (() => {}); // 'match' (weak) | 'boom' (strong)
    this.board = new Board();
    this.clearing = [];
    this.effects = [];
    this.missiles = [];       // in-flight guided missiles (BOMB special)
    this._missileKind = null; // 'single' | 'deliver'
    this._missileDeliver = null; // special type carried by a deliver missile
    this._missileTargets = null;
    this.autoBats = [];       // bats cleared in a match, flying concurrently
    this._pendingSpecials = []; // new specials waiting to appear after the clear
    this.selected = null;
    this.armed = null;   // armed active item id (targeted)
    this.preview = null; // cell under the pointer while an item is armed
    this.hint = null;    // idle match hint [a, b]
    this.idle = 0;
    this.tick = 0;
    this.paused = false;
    this.warned = false;   // low-moves alarm fired this stage
    this.seqActive = false; // rainbow+special sequential detonation in progress
    this.convertedGems = null;
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
    this.missiles = [];
    this._missileKind = null;
    this._missileDeliver = null;
    this._missileTargets = null;
    this.autoBats = [];       // bats cleared in a match, flying concurrently
    this._pendingSpecials = []; // new specials waiting to appear after the clear
    this.selected = null;
    this.armed = null;
    this.preview = null;
    this.hint = null;
    this.idle = 0;
    this.warned = false;
    this.seqActive = false;
    this.convertedGems = null;
    this.continues = 0; // times continued (paid) this stage attempt
    if (fresh) {
      this.gold = START_GOLD;
      this.items = {};
      for (const it of ITEMS) this.items[it.id] = ITEM_START;
    }
    this.phase = 'idle';
    if (this.sound) this.sound.setStageGroup(Math.floor(stageIndex / 2)); // BGM per 2 stages
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
    if (this.armed === id) { this.armed = null; this.preview = null; this._emitItems(); return; } // toggle off
    if (def.target) { this.armed = id; this._emitItems(); return; }
    // instant: shuffle
    this.items[id] -= 1; this.armed = null;
    this.board.reshuffle(); this._sync(true);
    this.effects.push({ type: 'swirl', t: 0, life: 66 });
    if (this.sound) this.sound.special();
    this.haptic('match');
    this._emitItems();
  }

  cancelArm() { if (this.armed) { this.armed = null; this.preview = null; this._emitItems(); } }

  setPreview(cell) { this.preview = (this.armed && cell) ? cell : null; }

  // Cells an item would affect if used on `cell` (shared by preview + apply).
  itemCells(id, cell) {
    const out = [];
    const push = (r, c) => { if (this.board.inBounds(r, c)) out.push({ r, c }); };
    if (id === 'hammer') {
      push(cell.r, cell.c);
    } else if (id === 'bomb') {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) push(cell.r + dr, cell.c + dc);
    } else if (id === 'cross') {
      for (let c = 0; c < COLS; c += 1) push(cell.r, c);
      for (let r = 0; r < ROWS; r += 1) push(r, cell.c);
    } else if (id === 'color') {
      const g = this.board.at(cell.r, cell.c);
      const color = g ? (g.color < 0 ? this.board._commonColor() : g.color) : -1;
      for (const p of this.board.cellsOfColor(color)) push(p.r, p.c);
    }
    return out;
  }

  applyItemAt(cell) {
    if (this.phase !== 'idle' || !this.armed || !cell) return;
    const g = this.board.at(cell.r, cell.c);
    if (!g) return;
    const id = this.armed;
    this._act();
    this.preview = null;
    const matched = new Set();
    for (const p of this.itemCells(id, cell)) matched.add(this.board.key(p.r, p.c));
    // item-signature effect at the target
    const cx = Game.px(cell.c) + CELL / 2;
    const cy = Game.py(cell.r) + CELL / 2;
    if (id === 'hammer') this.effects.push({ type: 'smash', x: cx, y: cy, t: 0, life: 56 });
    else if (id === 'bomb') this.effects.push({ type: 'ring', x: cx, y: cy, color: -1, t: 0, life: 62 });
    else if (id === 'cross') {
      this.effects.push({ type: 'beam', axis: 'row', r: cell.r, c: cell.c, color: -1, t: 0, life: 60 });
      this.effects.push({ type: 'beam', axis: 'col', r: cell.r, c: cell.c, color: -1, t: 0, life: 60 });
    } else if (id === 'color') this.effects.push({ type: 'flash', t: 0, life: 70 });

    this.items[id] -= 1;
    this.armed = null;
    this.cascade = 0;
    if (this.sound) this.sound.boom();
    this._emitItems();
    this._beginClear(matched, new Map(), (id === 'bomb' || id === 'cross' || id === 'color') ? 'boom' : 'match');
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
    if (g.special === SP.MISSILE) { this._launchMissiles([cell], 1); return; }
    if (this.sound) this.sound.boom();
    this._beginClear(new Set([this.board.key(cell.r, cell.c)]), new Map(), 'boom');
  }

  // ---- guided missiles (MISSILE special: a bat auto-aims at the best cascade) ----

  // Up to n distinct target cells, ranked by the cascade they would trigger.
  _bestTargets(n, exclude) {
    const ex = exclude || new Set();
    const out = [];
    for (let k = 0; k < n; k += 1) {
      let best = null; let bestScore = -1;
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
        const g = this.board.grid[r][c];
        if (!g || ex.has(this.board.key(r, c))) continue;
        const score = this.board.simulateRemoveScore(r, c);
        if (score > bestScore) { bestScore = score; best = { r, c }; }
      }
      if (!best) break;
      if (bestScore <= 0) best = this._fallbackTarget(ex) || best; // no cascade → fallback
      ex.add(this.board.key(best.r, best.c));
      out.push(best);
    }
    return out;
  }

  // When no removal makes a match: prefer another special block, else the cell
  // of the most common colour nearest the board centre.
  _fallbackTarget(ex) {
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.board.grid[r][c];
      if (g && g.special !== SP.NONE && !ex.has(this.board.key(r, c))) return { r, c };
    }
    const color = this.board._commonColor();
    let best = null; let bestD = Infinity;
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.board.grid[r][c];
      if (!g || g.color !== color || ex.has(this.board.key(r, c))) continue;
      const d = (r - 3.5) ** 2 + (c - 3.5) ** 2;
      if (d < bestD) { bestD = d; best = { r, c }; }
    }
    return best;
  }

  // Consume `sources` (the missile blocks) and fire `count` bats at the best
  // targets; each removes one block on arrival. (missile+missile → count 3.)
  _launchMissiles(sources, count) {
    const ex = new Set(sources.map((s) => this.board.key(s.r, s.c)));
    const targets = this._bestTargets(count, ex);
    if (!targets.length) { if (this.sound) this.sound.boom(); this._beginClear(new Set(sources.map((s) => this.board.key(s.r, s.c))), new Map(), 'boom'); return; }
    const cols = sources.map((s) => { const g = this.board.at(s.r, s.c); return g ? g.color : 0; });
    this._consumeCells(sources);
    for (let i = 0; i < count; i += 1) {
      const src = sources[i % sources.length];
      this._spawnMissile(src, targets[i % targets.length], i * 8, cols[i % cols.length]); // staggered launch
    }
    this._missileKind = 'single';
    this._missileDeliver = null;
    this._missileTargets = targets;
    this.phase = 'missile';
  }

  // missile + another special: the bat carries that special to the best cell,
  // then it detonates there (deliver = the other special's type).
  _launchDeliverMissile(sources, deliver) {
    const ex = new Set(sources.map((s) => this.board.key(s.r, s.c)));
    const targets = this._bestTargets(1, ex);
    if (!targets.length) { if (this.sound) this.sound.boom(); this._beginClear(new Set([...ex]), new Map(), 'boom'); return; }
    const mgem = sources.map((s) => this.board.at(s.r, s.c)).find((g) => g && g.special === SP.MISSILE);
    const color = mgem ? mgem.color : 0;
    this._consumeCells(sources);
    const mid = { r: (sources[0].r + sources[sources.length - 1].r) / 2, c: (sources[0].c + sources[sources.length - 1].c) / 2 };
    this._spawnMissile(mid, targets[0], 0, color);
    this._missileKind = 'deliver';
    this._missileDeliver = deliver;
    this._missileTargets = targets;
    this.phase = 'missile';
  }

  // rainbow + bat: every gem of `color` becomes a homing bat aimed at the best
  // cells (each removes one block on arrival), fired in a quick stagger.
  _launchColorMissiles(rainbowCell, color) {
    const sources = this.board.cellsOfColor(color);
    const ex = new Set(sources.map((s) => this.board.key(s.r, s.c)));
    ex.add(this.board.key(rainbowCell.r, rainbowCell.c));
    const targets = this._bestTargets(sources.length, ex);
    if (!sources.length || !targets.length) {
      if (this.sound) this.sound.boom();
      this._consumeCells([rainbowCell]);
      this._beginClear(new Set(sources.map((s) => this.board.key(s.r, s.c))), new Map(), 'boom');
      return;
    }
    this._consumeCells([rainbowCell, ...sources]);
    for (let i = 0; i < sources.length; i += 1) {
      this._spawnMissile(sources[i], targets[i % targets.length], i * 4, color);
    }
    this._missileKind = 'single';
    this._missileDeliver = null;
    this._missileTargets = targets;
    if (this.sound) this.sound.special();
    this.phase = 'missile';
  }

  _consumeCells(cells) {
    for (const s of cells) {
      const g = this.board.at(s.r, s.c);
      if (!g) continue;
      this.clearing.push({ gem: g, t: 0 });
      this.effects.push({ type: 'pop', x: Game.px(s.c) + CELL / 2, y: Game.py(s.r) + CELL / 2, color: g.color, t: 0, life: 32 });
      this.board.grid[s.r][s.c] = null;
    }
  }

  _spawnMissile(src, tgt, delay = 0, color = 0) {
    this.missiles.push({
      sx: Game.px(src.c) + CELL / 2, sy: Game.py(src.r) + CELL / 2,
      tx: Game.px(tgt.c) + CELL / 2, ty: Game.py(tgt.r) + CELL / 2,
      x: Game.px(src.c) + CELL / 2, y: Game.py(src.r) + CELL / 2,
      t: 0, dur: 18, delay, fired: false, color, trail: [],
    });
  }

  _missilesLanded() { return this.missiles.length > 0 && this.missiles.every((m) => m.t >= m.delay + m.dur); }

  _resolveMissiles() {
    const S = new Set();
    const add = (r, c) => { if (this.board.inBounds(r, c)) S.add(this.board.key(r, c)); };
    const addRow = (r) => { for (let c = 0; c < COLS; c += 1) add(r, c); };
    const addCol = (c) => { for (let r = 0; r < ROWS; r += 1) add(r, c); };
    const addBox = (r, c, rad) => { for (let dr = -rad; dr <= rad; dr += 1) for (let dc = -rad; dc <= rad; dc += 1) add(r + dr, c + dc); };
    const targets = this._missileTargets || [];
    if (this._missileKind === 'single') {
      for (const t of targets) { add(t.r, t.c); this.effects.push({ type: 'ring', x: Game.px(t.c) + CELL / 2, y: Game.py(t.r) + CELL / 2, color: -1, t: 0, life: 40 }); }
    } else if (this._missileKind === 'deliver' && targets[0]) {
      // the carried special detonates at the guided position
      const t = targets[0]; const sp = this._missileDeliver;
      if (sp === SP.ROW) addRow(t.r);
      else if (sp === SP.COL) addCol(t.c);
      else if (sp === SP.BOMB) addBox(t.r, t.c, 1);
      else add(t.r, t.c);
      this._detonateFxAt(t.r, t.c, sp);
    }
    this.missiles = [];
    this._missileKind = null; this._missileTargets = null; this._missileDeliver = null;
    if (this.sound) this.sound.boom();
    this.haptic('boom');
    this._beginClear(S, new Map(), 'boom');
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
      addRow(a.r); addCol(a.c); // 십자 (한 줄 가로 + 한 줄 세로) at the swap cell
    } else { // line + bomb → 3-wide cross
      const cr = a.r; const cc = a.c;
      addRow(cr - 1); addRow(cr); addRow(cr + 1);
      addCol(cc - 1); addCol(cc); addCol(cc + 1);
    }
    return S;
  }

  // Burst visuals matching _comboCells — fired all at once with the combo.
  _comboFx(a, ga, b, gb) {
    const line = (s) => s === SP.ROW || s === SP.COL;
    const aS = ga.special; const bS = gb.special;
    const beamRow = (r) => { if (r >= 0 && r < ROWS) this.effects.push({ type: 'beam', axis: 'row', r, c: 0, color: -1, t: 0, life: 46 }); };
    const beamCol = (c) => { if (c >= 0 && c < COLS) this.effects.push({ type: 'beam', axis: 'col', r: 0, c, color: -1, t: 0, life: 46 }); };
    if (aS === SP.COLOR || bS === SP.COLOR) { this.effects.push({ type: 'flash', t: 0, life: 70 }); return; }
    if (aS === SP.BOMB && bS === SP.BOMB) { // 5x5
      this.effects.push({ type: 'ring', x: Game.px(a.c) + CELL / 2, y: Game.py(a.r) + CELL / 2, color: -1, t: 0, life: 62 });
      return;
    }
    if (line(aS) && line(bS)) { beamRow(a.r); beamCol(a.c); return; } // 십자
    // line + bomb → 3 rows + 3 cols, all at once
    beamRow(a.r - 1); beamRow(a.r); beamRow(a.r + 1);
    beamCol(a.c - 1); beamCol(a.c); beamCol(a.c + 1);
  }

  trySwap(a, b) {
    if (this.phase !== 'idle' || !this._adjacent(a, b)) return;
    const ga = this.board.at(a.r, a.c); const gb = this.board.at(b.r, b.c);
    if (!ga || !gb) return;
    this._act();

    // 1) Rainbow + special → convert every gem of that colour into the combined
    //    special, then detonate them one by one (fall between each).
    const aC = ga.special === SP.COLOR; const bC = gb.special === SP.COLOR;
    if (aC || bC) {
      const other = aC ? gb : ga;
      const os = other.special;
      if (os === SP.MISSILE) { // rainbow + bat → every gem of that colour becomes a homing bat
        this.movesLeft -= 1; this._emit();
        this.cascade = 0;
        this._launchColorMissiles(aC ? a : b, other.color);
        return;
      }
      if (os === SP.ROW || os === SP.COL || os === SP.BOMB) {
        this.movesLeft -= 1; this._emit();
        this.cascade = 0;
        this._startColorConvert(aC ? a : b, other);
        return;
      }
      // rainbow+rainbow / rainbow+normal fall through to the combo swap below
    }

    // 2) Missile (bat) combos with ANOTHER special — swapping a bat onto a normal
    //    gem is just a plain swap (the bat only fires on double-tap, or when it
    //    ends up in a match). Only bat+special combos trigger on the swap.
    const aM = ga.special === SP.MISSILE; const bM = gb.special === SP.MISSILE;
    if ((aM || bM) && ga.special !== SP.NONE && gb.special !== SP.NONE) {
      const other = aM ? gb : ga;
      this.movesLeft -= 1; this._emit();
      this.cascade = 0;
      if (aM && bM) { // 유도탄 + 유도탄 → 3발
        this._launchMissiles([a, b], 3);
      } else if (other.special === SP.BOMB) { // 유도탄 + 폭탄 → 폭탄이 제자리서 터지며 박쥐를 휩쓸고, 그 박쥐가 발동
        const bombCell = ga.special === SP.BOMB ? a : b;
        if (this.sound) this.sound.boom();
        this._beginClear(new Set([this.board.key(bombCell.r, bombCell.c)]), new Map(), 'boom');
      } else { // 줄 + 유도탄 → 유도 위치서 그 줄 발동
        this._launchDeliverMissile([a, b], other.special);
      }
      return;
    }

    // 3) Two non-colour specials (line/bomb) combine in place: line+line=십자,
    //    line+bomb=3열 십자, bomb+bomb=5x5. (rainbow+rainbow / rainbow+normal too)
    const comboSwap = ga.special === SP.COLOR || gb.special === SP.COLOR
      || (ga.special !== SP.NONE && gb.special !== SP.NONE);
    if (comboSwap) {
      this.movesLeft -= 1; this._emit();
      this.cascade = 0;
      if (this.sound) { this.sound.special(); this.sound.boom(); }
      const cells = this._comboCells(a, ga, b, gb);
      this._comboFx(a, ga, b, gb);
      // the combo REPLACES the two blocks' own effects — clear them as plain gems
      // so they don't also fire their individual row/col/bomb detonation.
      ga.special = SP.NONE; gb.special = SP.NONE;
      this._beginClear(cells, new Map(), 'boom');
      return;
    }

    this.board.swap(a, b);
    this._sync(false);
    if (this.sound) this.sound.swap();
    this._swapPair = [a, b];
    this.phase = 'swap';
  }

  // ---- rainbow + special: convert a colour to that special, pop in sequence ----

  _startColorConvert(bombCell, otherGem) {
    const type = otherGem.special;
    const color = otherGem.color;
    // consume the rainbow gem
    const bg = this.board.at(bombCell.r, bombCell.c);
    if (bg) {
      this.clearing.push({ gem: bg, t: 0 });
      this.effects.push({ type: 'pop', x: Game.px(bombCell.c) + CELL / 2, y: Game.py(bombCell.r) + CELL / 2, color: -1, t: 0, life: 32 });
      this.board.grid[bombCell.r][bombCell.c] = null;
    }
    // convert every gem of that colour into the special
    this.convertedGems = new Set();
    for (const p of this.board.cellsOfColor(color)) {
      const g = this.board.at(p.r, p.c);
      if (g) { g.special = type; this.convertedGems.add(g); }
    }
    this.seqActive = true;
    if (this.sound) this.sound.special();
    // settle the rainbow hole first; _afterFall drives the sequential pops
    this.board.applyGravity();
    this._sync(false);
    this.phase = 'falling';
  }

  _nextConverted() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const g = this.board.grid[r][c];
        if (g && this.convertedGems.has(g)) return { r, c };
      }
    }
    return null;
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

  _beginClear(matched, specials, hapticHint = null) {
    const anchors = new Set(specials.keys());
    const remove = new Set();
    // a special made earlier THIS move (justMade) is protected — it neither
    // detonates nor gets swept up by the same move's clear/cascade.
    for (const k of matched) {
      if (anchors.has(k)) continue;
      const g = this.board.grid[Math.floor(k / COLS)][k % COLS];
      if (g && g.justMade) continue;
      remove.add(k);
    }

    // chain: any existing special caught in the removal detonates (+ its effect)
    let detonated = false;
    const queue = [...remove];
    while (queue.length) {
      const k = queue.shift();
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.board.grid[r][c];
      if (g && g.special !== SP.NONE && !g.justMade) {
        detonated = true;
        this._detonateFx(r, c, g);
        // a bat cleared any which way (3-match, item, another blast) fires at
        // once — it flies off WHILE the match is still clearing.
        if (g.special === SP.MISSILE) this._spawnAutoBat(r, c, g.color, remove);
        for (const cell of this.board.effectCells(r, c, g)) {
          const kk = this.board.key(cell.r, cell.c);
          const cg = this.board.grid[cell.r][cell.c];
          if (cg && cg.justMade) continue; // don't sweep up a freshly-made special
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
        this.effects.push({ type: 'pop', x: Game.px(c) + CELL / 2, y: Game.py(r) + CELL / 2, color: g.color, t: 0, life: 32 });
        this.board.grid[r][c] = null;
      }
    }

    // queue the new special blocks — applied after this clear's pop finishes
    // (_afterClear), so a freshly made block appears only after the effect.
    for (const [k, sp] of specials) {
      const g = this.board.grid[Math.floor(k / COLS)][k % COLS];
      if (g) this._pendingSpecials.push({ gem: g, type: sp.type });
    }

    const mult = Math.min(3, 1 + this.cascade * 0.3);
    this.score += Math.round(remove.size * POINTS_PER_GEM * mult);
    if (this.cascade >= 1) {
      // one combo banner at a time: replacing it makes the previous vanish at
      // once when the next chain connects, and the last one lingers ~1.7s then
      // fades slowly (no separate re-pop when the chain ends).
      this.effects = this.effects.filter((e) => e.type !== 'combo');
      this.effects.push({ type: 'combo', n: this.cascade + 1, t: 0, life: 105 });
    }
    if (this.sound) {
      this.sound.clear(this.cascade);
      if (specials.size > 0) this.sound.special();
      if (detonated) this.sound.boom();
      if (this.cascade >= 1) this.sound.combo(this.cascade + 1);
    }
    // haptics: strong for detonations/big items, weak for a plain first match
    const h = hapticHint || (detonated ? 'boom' : (this.cascade === 0 ? 'match' : null));
    if (h) this.haptic(h);
    this._emit();
    this.phase = 'clearing';
  }

  // Visual burst for a detonating special block.
  _detonateFx(r, c, g) {
    const cx = Game.px(c) + CELL / 2;
    const cy = Game.py(r) + CELL / 2;
    if (g.special === SP.ROW) this.effects.push({ type: 'beam', axis: 'row', r, c, color: g.color, t: 0, life: 58 });
    else if (g.special === SP.COL) this.effects.push({ type: 'beam', axis: 'col', r, c, color: g.color, t: 0, life: 58 });
    else if (g.special === SP.BOMB) this.effects.push({ type: 'ring', x: cx, y: cy, color: g.color, t: 0, life: 62 });
    else if (g.special === SP.COLOR) this.effects.push({ type: 'flash', t: 0, life: 70 });
  }

  // Same burst, but for a special the missile just delivered to (r,c).
  _detonateFxAt(r, c, sp) { this._detonateFx(r, c, { special: sp, color: -1 }); }

  _afterClear() {
    // the new specials appear now (after the clearing pop), then fall; justMade
    // keeps them from firing during the rest of this move.
    for (const ps of this._pendingSpecials) {
      if (!ps.gem) continue;
      ps.gem.special = ps.type; ps.gem.justMade = true;
      if (ps.type === SP.COLOR) ps.gem.color = COLOR_GEM;
    }
    this._pendingSpecials = [];
    this.board.applyGravity();
    this._sync(false);
    this.phase = 'falling';
  }

  _afterFall() {
    // sequential rainbow+special detonations: one per settle, with falls between
    if (this.seqActive) {
      const next = this._nextConverted();
      if (next) { this._beginClear(new Set([this.board.key(next.r, next.c)]), new Map(), 'boom'); return; }
      this.seqActive = false;
      this.convertedGems = null;
    }

    // bats that finished flying now hit their target (clears it in place)
    const landed = this.autoBats.filter((m) => m.landed);
    if (landed.length) {
      this.autoBats = this.autoBats.filter((m) => !m.landed);
      const S = new Set();
      for (const m of landed) {
        S.add(this.board.key(m.tr, m.tc));
        this.effects.push({ type: 'ring', x: m.tx, y: m.ty, color: -1, t: 0, life: 24 });
      }
      if (this.sound) this.sound.boom();
      this._beginClear(S, new Map(), 'boom');
      return;
    }

    const res = this.board.detect(null);
    if (res.matched.size > 0) {
      this.cascade += 1;
      this._beginClear(res.matched, res.specials);
    } else {
      if (this.autoBats.length) return; // bats still in flight — hold until they land
      // chain ended — the last combo banner keeps fading on its own (see above)
      this.cascade = 0;
      if (!this.board.hasMoves()) { this.board.reshuffle(); this._sync(false); return; }
      this._settle();
    }
  }

  // A bat cleared in a match/blast flies off immediately toward the best cell.
  _spawnAutoBat(r, c, color, exclude) {
    const t = this._bestTargets(1, new Set(exclude))[0];
    if (!t) return;
    this.autoBats.push({
      sx: Game.px(c) + CELL / 2, sy: Game.py(r) + CELL / 2,
      tx: Game.px(t.c) + CELL / 2, ty: Game.py(t.r) + CELL / 2,
      x: Game.px(c) + CELL / 2, y: Game.py(r) + CELL / 2,
      t: 0, dur: 18, color, tr: t.r, tc: t.c, landed: false, trail: [],
    });
    if (this.sound) this.sound.special();
  }

  _settle() {
    // move fully resolved — freshly-made specials become normal (fireable next move)
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.board.grid[r][c]; if (g) g.justMade = false;
    }
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
      this.onState('lost', {
        stage: this.stageIndex + 1, score: this.score, target: this.target,
        gold: this.gold, continueCost: this.continueCost(),
      });
    }
  }

  continueCost() { return CONTINUE_BASE * (2 ** this.continues); } // 100, 200, 400 …

  // Pay gold for extra moves after running out. Returns true if it succeeded.
  continueStage() {
    if (this.phase !== 'lost') return false;
    const cost = this.continueCost();
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.movesLeft += CONTINUE_MOVES;
    this.continues += 1;
    this.phase = 'idle';
    this.idle = 0; this.hint = null;
    if (this.sound) this.sound.special();
    this._emit();
    this._emitItems();
    return true;
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
    for (const m of this.missiles) { // guided missiles home in on their target
      m.t += 1;
      if (m.t < m.delay) continue; // staggered launch: wait its turn
      if (!m.fired) { m.fired = true; if (this.sound) this.sound.special(); }
      const p = Math.min(1, (m.t - m.delay) / m.dur);
      const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2; // easeInOut
      m.x = m.sx + (m.tx - m.sx) * e;
      m.y = m.sy + (m.ty - m.sy) * e;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 24) m.trail.shift();
    }
    for (const m of this.autoBats) { // bats flying concurrently with the clear
      m.t += 1;
      const p = Math.min(1, m.t / m.dur);
      const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      m.x = m.sx + (m.tx - m.sx) * e;
      m.y = m.sy + (m.ty - m.sy) * e;
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 24) m.trail.shift();
      if (m.t >= m.dur) m.landed = true;
    }
  }

  setPaused(p) { this.paused = p; }

  _loop() {
    if (this.paused) { this._raf = requestAnimationFrame(() => this._loop()); return; }
    this.tick += 1;
    this._tween();
    if (this.phase === 'swap' && this._allArrived()) this._onSwapArrived();
    else if (this.phase === 'swapback' && this._allArrived()) this.phase = 'idle';
    else if (this.phase === 'clearing' && this.clearing.length === 0) this._afterClear();
    else if (this.phase === 'falling' && this._allArrived()) this._afterFall();
    else if (this.phase === 'missile' && this._missilesLanded()) this._resolveMissiles();
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
    if (this.sound) this.sound.setTempo(this.movesLeft <= LOW_MOVES); // urgent BGM
    if (this.movesLeft <= LOW_MOVES && !this.warned && this.phase !== 'won' && this.phase !== 'lost') {
      this.warned = true;
      if (this.sound) this.sound.alarm();
      this.effects.push({ type: 'warn', text: `${this.movesLeft}회 남음!`, t: 0, life: 210 });
    }
    this.onHud({
      stage: this.stageIndex + 1,
      score: this.score,
      target: this.target,
      moves: this.movesLeft,
    });
  }
}

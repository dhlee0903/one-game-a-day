// World update: fixed-step loop across multiple stages, block bumps (?, bricks,
// coin-bricks), power-up items, enemy stomps/hits with small/big states, the
// flag-pole slide, camera, and lives/score.

import {
  VIEW_W, START_LIVES, CELL, STOMP_BOUNCE, TILE, COINBRICK_COINS,
} from './config.js';
import { buildStages } from './level.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Item } from './item.js';

const STEP = 1000 / 60;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Game {
  constructor(renderer, { onHud, onState } = {}) {
    this.renderer = renderer;
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.input = { left: false, right: false, jump: false };
    this.stages = buildStages();
    this._raf = 0;
    this.reset();
  }

  reset() {
    this.stageIndex = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.coinsGot = 0;
    this.player = null;
    this._loadStage(false);
    this.phase = 'ready';
  }

  _loadStage(keepPower) {
    const s = this.stages[this.stageIndex];
    this.level = {
      cols: s.cols, rows: s.rows, width: s.width, height: s.height,
      tiles: s.tiles.map((r) => r.slice()),
      coins: s.coins.map((c) => ({ ...c })),
      enemies: s.enemies, spawn: s.spawn, goal: s.goal,
    };
    if (keepPower && this.player) this.player.reset(this.level.spawn, true);
    else this.player = new Player(this.level.spawn);
    this.enemies = this.level.enemies.map((e) => new Enemy(e));
    this.items = [];
    this.effects = [];
    this.bumps = [];
    this.flag = null;
    this.coinBrick = new Map();
    for (let y = 0; y < this.level.rows; y += 1) {
      for (let x = 0; x < this.level.cols; x += 1) {
        if (this.level.tiles[y][x] === TILE.COINBRICK) this.coinBrick.set(`${x},${y}`, COINBRICK_COINS);
      }
    }
    this.camera = { x: 0 };
    this.acc = 0;
    this.last = 0;
  }

  start() {
    if (this.phase === 'dead' || this.phase === 'win') this.reset();
    this.phase = 'playing';
    this.onState('playing');
    this._emit();
    cancelAnimationFrame(this._raf);
    this.last = 0;
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  // ----- per-step update -----

  _step() {
    if (this.flag) { this._flagStep(); return; }

    this.player.update(this.input, this.level);
    if (this.player.bump) this._bump(this.player.bump);
    this.enemies.forEach((e) => e.update(this.level));
    this.items.forEach((it) => it.update(this.level));
    this._advanceEffects();
    this._collisions();
    this._camera();
    if (this.player.y > this.level.height + 80) this._hurt(true);
  }

  _bump({ tx, ty }) {
    const t = this.level.tiles[ty][tx];
    if (t === TILE.QCOIN) {
      this.level.tiles[ty][tx] = TILE.USED;
      this._popCoin(tx, ty); this._bumpAnim(tx, ty);
    } else if (t === TILE.QITEM) {
      this.level.tiles[ty][tx] = TILE.USED;
      this.items.push(new Item(tx * CELL + 3, ty * CELL));
      this._bumpAnim(tx, ty);
    } else if (t === TILE.COINBRICK) {
      const k = `${tx},${ty}`;
      const n = (this.coinBrick.get(k) || 0) - 1;
      this._popCoin(tx, ty); this._bumpAnim(tx, ty);
      if (n <= 0) this.level.tiles[ty][tx] = TILE.USED; else this.coinBrick.set(k, n);
    } else if (t === TILE.BRICK) {
      if (this.player.big) {
        this.level.tiles[ty][tx] = TILE.EMPTY;
        this._brickBreak(tx, ty);
        this.score += 20; this._emit();
      } else {
        this._bumpAnim(tx, ty);
      }
    }
  }

  _popCoin(tx, ty) {
    this.score += 50; this.coinsGot += 1; this._emit();
    this.effects.push({ type: 'coin', x: tx * CELL + CELL / 2, y: ty * CELL, t: 0, life: 22 });
  }

  _bumpAnim(tx, ty) { this.bumps.push({ tx, ty, t: 0, life: 10 }); }

  _brickBreak(tx, ty) {
    const cx = tx * CELL + CELL / 2;
    const cy = ty * CELL + CELL / 2;
    for (let i = 0; i < 4; i += 1) {
      this.effects.push({
        type: 'shard', x: cx, y: cy, t: 0, life: 26,
        vx: (i % 2 ? 1 : -1) * (1.5 + Math.random()), vy: -4 - Math.random() * 2,
      });
    }
  }

  _advanceEffects() {
    this.effects.forEach((e) => {
      e.t += 1;
      if (e.type === 'coin') e.y -= 2.2;
      if (e.type === 'shard') { e.x += e.vx; e.y += e.vy; e.vy += 0.5; }
    });
    this.effects = this.effects.filter((e) => e.t < e.life);
    this.bumps.forEach((b) => { b.t += 1; });
    this.bumps = this.bumps.filter((b) => b.t < b.life);
  }

  _collisions() {
    const p = this.player;

    this.level.coins.forEach((c) => {
      if (c.taken) return;
      if (Math.abs((p.x + p.w / 2) - c.x) < p.w / 2 + 8 && Math.abs((p.y + p.h / 2) - c.y) < p.h / 2 + 8) {
        c.taken = true; this.coinsGot += 1; this.score += 50; this._emit();
      }
    });

    this.items.forEach((it) => {
      if (!it.dead && overlap(p, it)) { it.dead = true; p.grow(); this.score += 1000; this._emit(); }
    });
    this.items = this.items.filter((it) => !it.dead);

    for (const e of this.enemies) {
      if (e.dead || !overlap(p, e)) continue;
      if (p.vy > 0 && (p.y + p.h) - e.y < 18) {
        e.dead = true; e.deadTimer = 26; p.vy = -STOMP_BOUNCE; this.score += 100; this._emit();
      } else {
        this._hurt(false);
        break;
      }
    }

    const g = this.level.goal;
    if (this.phase === 'playing' && p.x + p.w > g.x) this.flag = { t: 0 };
  }

  _hurt(fell) {
    if (this.phase !== 'playing' || this.flag) return;
    if (!fell && this.player.invuln > 0) return;
    if (!fell && this.player.big) { this.player.shrink(); return; }
    this.lives -= 1;
    this._emit();
    if (this.lives <= 0) {
      this.phase = 'dead';
      this.onState('dead', { score: this.score });
    } else {
      this._loadStage(false); // restart current stage, small
    }
  }

  _flagStep() {
    const p = this.player;
    const g = this.level.goal;
    p.x = g.x - p.w / 2;
    p.vx = 0;
    const groundY = 13 * CELL - p.h;
    if (p.y < groundY) { p.y = Math.min(groundY, p.y + 4); this.flag.t = 0; } else { this.flag.t += 1; }
    if (this.flag.t > 34) this._stageClear();
  }

  _stageClear() {
    this.stageIndex += 1;
    if (this.stageIndex >= this.stages.length) {
      this.phase = 'win';
      this.onState('win', { score: this.score });
    } else {
      this._loadStage(true); // next stage, keep power
    }
  }

  _camera() {
    const target = this.player.x + this.player.w / 2 - VIEW_W / 2;
    this.camera.x = Math.max(0, Math.min(this.level.width - VIEW_W, target));
  }

  _loop(t) {
    if (this.phase !== 'playing') return;
    if (!this.last) this.last = t;
    let dt = t - this.last;
    this.last = t;
    if (dt > 60) dt = 60;
    this.acc += dt;
    while (this.acc >= STEP) {
      this._step();
      this.acc -= STEP;
      if (this.phase !== 'playing') break;
    }
    this.renderer.render(this);
    this._raf = requestAnimationFrame((n) => this._loop(n));
  }

  _emit() {
    this.onHud({
      score: this.score, lives: this.lives, coins: this.coinsGot, stage: this.stageIndex + 1,
    });
  }
}

// World update: fixed-step loop, player/enemy updates, entity collisions
// (coins, stomps, hits, goal), camera follow, and lives/score/state.

import {
  VIEW_W, START_LIVES, CELL, STOMP_BOUNCE,
} from './config.js';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';

const STEP = 1000 / 60;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Game {
  constructor(renderer, { onHud, onState } = {}) {
    this.renderer = renderer;
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.input = { left: false, right: false, jump: false };
    this._raf = 0;
    this.reset();
  }

  reset() {
    this.level = buildLevel();
    this.player = new Player(this.level.spawn);
    this.enemies = this.level.enemies.map((s) => new Enemy(s));
    this.coins = this.level.coins.map((c) => ({ ...c, taken: false }));
    this.camera = { x: 0 };
    this.score = 0;
    this.lives = START_LIVES;
    this.coinsGot = 0;
    this.phase = 'ready';
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

  _step() {
    this.player.update(this.input, this.level);
    this.enemies.forEach((e) => e.update(this.level));
    this._collisions();
    this._camera();
    if (this.player.y > this.level.height + 80) this._hurt();
  }

  _collisions() {
    const p = this.player;

    this.coins.forEach((c) => {
      if (c.taken) return;
      if (Math.abs((p.x + p.w / 2) - c.x) < p.w / 2 + 8 && Math.abs((p.y + p.h / 2) - c.y) < p.h / 2 + 8) {
        c.taken = true;
        this.coinsGot += 1;
        this.score += 50;
        this._emit();
      }
    });

    for (const e of this.enemies) {
      if (e.dead || !overlap(p, e)) continue;
      if (p.vy > 0 && (p.y + p.h) - e.y < 16) {
        e.dead = true;
        e.deadTimer = 26;
        p.vy = -STOMP_BOUNCE;
        this.score += 100;
        this._emit();
      } else {
        this._hurt();
        break;
      }
    }

    const g = this.level.goal;
    if (this.phase === 'playing' && p.x + p.w > g.x && p.x < g.x + CELL) this._win();
  }

  _hurt() {
    if (this.phase !== 'playing') return;
    this.lives -= 1;
    this._emit();
    if (this.lives <= 0) {
      this.phase = 'dead';
      this.onState('dead', { score: this.score });
    } else {
      this.player.reset(this.level.spawn);
      this.camera.x = 0;
    }
  }

  _win() {
    this.phase = 'win';
    this.onState('win', { score: this.score });
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
    if (dt > 60) dt = 60; // avoid huge catch-up after a tab stall
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
    this.onHud({ score: this.score, lives: this.lives, coins: this.coinsGot });
  }
}

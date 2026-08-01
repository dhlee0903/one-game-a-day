// World update: fixed-step loop that scrolls the road, advances entities toward
// the camera, resolves collisions in the near depth window, and tracks score,
// coins, speed and lives. The renderer only reads this state.

import {
  START_SPEED, MAX_SPEED, SPEED_RAMP, HIT_DEPTH, LANE_HIT, PASS_D,
  ROW_FRAMES_START, ROW_FRAMES_MIN, ROW_FRAMES_RAMP,
  START_LIVES, COIN_SCORE, DIST_SCORE, OB, BEST_KEY,
} from './config.js';
import { Player } from './player.js';
import { Spawner } from './spawner.js';

const STEP = 1000 / 60;

export class Game {
  constructor(renderer, { onHud, onState } = {}) {
    this.renderer = renderer;
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.input = { left: false, right: false, up: false, down: false };
    this.player = new Player();
    this.spawner = new Spawner();
    this.best = this._loadBest();
    this._raf = 0;
    this._prev = { left: false, right: false, up: false, down: false };
    this.reset();
  }

  reset() {
    this.player.reset();
    this.spawner.reset();
    this.entities = [];
    this.coins = 0;
    this.distance = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.speed = START_SPEED;
    this.frames = 0;      // elapsed play frames → time
    this.shake = 0;       // screen-shake frames left
    this.nextSpawn = 5;   // first row a little ahead
    this.effects = [];
    this.acc = 0;
    this.last = 0;
    this.phase = 'ready';
    this._emit();
  }

  _loadBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }

  _saveBest() {
    try { localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* ignore */ }
  }

  start() {
    if (this.phase === 'dead') this.reset();
    this.phase = 'playing';
    this.onState('playing');
    this._emit();
    cancelAnimationFrame(this._raf);
    this.last = 0;
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  // ----- per-step update -----

  _step() {
    this._consumeInput();
    this.player.update();
    this.frames += 1;
    if (this.shake > 0) this.shake -= 1;

    // ramp speed with distance, then scroll the world toward the camera
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.distance * SPEED_RAMP);
    this.distance += this.speed;
    this.score += this.speed * DIST_SCORE;

    for (const e of this.entities) e.d -= this.speed;

    this._spawn();
    this._collisions();
    this._advanceEffects();

    // keep entities until they have slid well past the camera, so they flow off
    // the bottom of the screen instead of popping out at the edge
    this.entities = this.entities.filter((e) => e.d > PASS_D);
    this._emit();
  }

  _consumeInput() {
    const i = this.input;
    const p = this._prev;
    if (i.left && !p.left) this.player.moveLeft();
    if (i.right && !p.right) this.player.moveRight();
    if (i.up && !p.up) this.player.jump();
    if (i.down && !p.down) this.player.slide();
    this._prev = { left: i.left, right: i.right, up: i.up, down: i.down };
  }

  _spawn() {
    if (this.distance < this.nextSpawn) return;
    const row = this.spawner.buildRow();
    for (const e of row) this.entities.push(e);
    // space rows by a shrinking frame budget, converted to distance via speed,
    // so the reaction time between rows never collapses at high speed
    const frames = Math.max(ROW_FRAMES_MIN, ROW_FRAMES_START - this.distance * ROW_FRAMES_RAMP);
    this.nextSpawn = this.distance + this.speed * frames;
  }

  _collisions() {
    const p = this.player;
    for (const e of this.entities) {
      if (e.resolved || Math.abs(e.d) > HIT_DEPTH) continue;
      // overlap by the player's *visual* lane position, so what you see is what
      // you get — a glancing, off-centre hit still counts.
      if (Math.abs(e.lane - p.laneX) > LANE_HIT) continue;

      if (e.kind === OB.COIN) {
        e.resolved = true; e.taken = true;
        this.coins += 1; this.score += COIN_SCORE;
        this.effects.push({ type: 'spark', lane: e.lane, t: 0, life: 20 });
        continue;
      }

      // obstacle: check whether the current action avoids it
      const avoided =
        (e.kind === OB.LOW && p.jumping) ||
        (e.kind === OB.HIGH && p.sliding);
      if (avoided) { e.resolved = true; continue; }

      e.resolved = true;
      this._hit();
    }
  }

  _hit() {
    if (this.player.invuln > 0) return;
    this.player.hurt();
    this.lives -= 1;
    this.shake = 16;
    this.effects.push({ type: 'flash', t: 0, life: 16 });
    if (this.lives <= 0) {
      this.phase = 'dead';
      if (Math.floor(this.score) > this.best) { this.best = Math.floor(this.score); this._saveBest(); }
      this.onState('dead', { score: Math.floor(this.score), coins: this.coins, best: this.best });
    }
  }

  _advanceEffects() {
    for (const fx of this.effects) fx.t += 1;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
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
      score: Math.floor(this.score),
      coins: this.coins,
      speed: Math.round((this.speed / START_SPEED) * 100) / 100,
      best: this.best,
      lives: this.lives,
    });
  }
}

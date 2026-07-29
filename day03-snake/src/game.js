// Game orchestration: the tick loop, food, collision rules, scoring, and the
// ready/playing/paused/over state machine. Rendering happens via a callback;
// the game never touches the DOM.

import {
  COLS, ROWS, BASE_TICK_MS, MIN_TICK_MS, SPEEDUP_MS, CRASH_DELAY_MS,
} from './config.js';
import { Snake } from './snake.js';

export class Game {
  constructor(renderer, { onScore, onState } = {}) {
    this.renderer = renderer;
    this.onScore = onScore || (() => {});
    this.onState = onState || (() => {});
    this.snake = new Snake();
    this._raf = 0;
    this._resetState();
  }

  _resetState() {
    this.score = 0;
    this.tickMs = BASE_TICK_MS;
    this.acc = 0;
    this.last = 0;
    this.effects = []; // transient eat/grow bursts { x, y, age, dur }
    this.crash = null; // { x, y } where the snake died
    this.phase = 'ready'; // ready | playing | paused | dying | over
  }

  start() {
    cancelAnimationFrame(this._raf);
    this.snake.reset();
    this._resetState();
    this.food = this._spawnFood();
    this.phase = 'playing';
    this.onScore(0);
    this.onState('playing');
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  setDir(dir) {
    if (this.phase !== 'playing') return;
    this.snake.setDir(dir);
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.onState('paused');
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.last = 0;
      this.onState('playing');
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  _spawnFood() {
    const free = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!this.snake.occupies(x, y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null; // board full — perfect game
    return free[Math.floor(Math.random() * free.length)];
  }

  _tick() {
    const nh = this.snake.nextHead();

    // Wall collision.
    if (nh.x < 0 || nh.x >= COLS || nh.y < 0 || nh.y >= ROWS) return this._crash(nh);

    const willGrow = this.food && nh.x === this.food.x && nh.y === this.food.y;

    // Self collision — the tail cell is free next step unless we grow into it.
    if (this.snake.occupies(nh.x, nh.y, !willGrow)) return this._crash(nh);

    if (willGrow) this.snake.grow(1);
    this.snake.step();

    if (willGrow) {
      this.score += 1;
      this.onScore(this.score);
      this.tickMs = Math.max(MIN_TICK_MS, this.tickMs - SPEEDUP_MS);
      this.effects.push({ x: nh.x, y: nh.y, age: 0, dur: 420 }); // eat/grow burst
      this.food = this._spawnFood();
      if (!this.food) return this._gameOver(); // filled the whole board
    }
    return undefined;
  }

  // Show the fatal move before ending: drive the head into the cell it hit,
  // pointed the right way, so it's clear what killed you.
  _crash(nh) {
    this.snake.dir = this.snake._pending(); // orient the head toward the crash
    this.snake.body.unshift(nh);
    this.crash = { x: nh.x, y: nh.y };
    this.phase = 'dying';
    this.renderer.render(this);
    setTimeout(() => this._gameOver(), CRASH_DELAY_MS);
  }

  _gameOver() {
    this.phase = 'over';
    this.onState('over', { score: this.score });
  }

  _loop(t) {
    if (this.phase !== 'playing') return;
    if (!this.last) this.last = t;
    const dt = t - this.last;
    this.acc += dt;
    this.last = t;

    // advance transient effects
    if (this.effects.length) {
      this.effects.forEach((e) => { e.age += dt; });
      this.effects = this.effects.filter((e) => e.age < e.dur);
    }

    while (this.acc >= this.tickMs) {
      this._tick();
      this.acc -= this.tickMs;
      if (this.phase !== 'playing') break;
    }

    this.renderer.render(this);
    this._raf = requestAnimationFrame((n) => this._loop(n));
  }
}

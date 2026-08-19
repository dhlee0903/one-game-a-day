// 게임 규칙: 이동 판정, 통나무 타기, 사망, 카메라·독수리 압박.

import {
  LANE, HALF_COLS, ROWS_AHEAD, ROWS_BEHIND, CAM,
  IDLE_LIMIT, IDLE_WARN, EAGLE_TIME, SCROLL_BASE, SCROLL_GAIN,
} from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FACE } from './models.js';

const BEHIND = 5;          // 카메라 뒤로 이만큼 처지면 독수리
const DEATH_HOLD = 0.75;   // 깔린 뒤 결과창까지의 여유

export class Game {
  constructor({ onHud, onState, sound, store } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.sound = sound || null;
    this.store = store || null;

    this.world = new World();
    this.player = new Player();
    this.state = 'title';
    this.charIndex = 0;
    this.reset();
  }

  reset() {
    this.world.reset();
    this.player.reset();
    this.score = 0;
    this.coins = 0;
    this.camZ = 0;
    this.edge = -BEHIND;
    this.idle = 0;
    this.deathT = 0;
    this.cause = null;
    this.eagle = null;
    this.pending = null;
    this.shake = 0;
    this.splash = 0;
  }

  start() {
    this.reset();
    this.state = 'play';
    this.emitHud();
  }

  emitHud() {
    this.onHud({ score: this.score, coins: this.coins, danger: this.idle >= IDLE_WARN && this.state === 'play' });
  }

  // ---- 입력 ----

  move(dir) {
    if (this.state !== 'play') return;
    this.pending = dir;
  }

  tryMove(dir) {
    const p = this.player;
    const w = this.world;
    const here = Math.round(p.z);
    let dx = 0; let dz = 0; let yaw = FACE.fwd;
    if (dir === 'fwd') { dz = 1; yaw = FACE.fwd; }
    else if (dir === 'back') { dz = -1; yaw = FACE.back; }
    else if (dir === 'left') { dx = -1; yaw = FACE.left; }
    else { dx = 1; yaw = FACE.right; }

    const tz = here + dz;
    const dest = w.laneAt(tz);
    const onWater = dest && dest.type === LANE.RIVER;
    // 물 위에서는 통나무에 맞춰 소수 좌표를 유지하고, 뭍에 오르면 칸에 맞춘다.
    const baseX = onWater ? p.x : Math.round(p.x);
    const tx = baseX + dx;

    if (Math.abs(tx) > HALF_COLS + 0.001 || w.blocked(Math.round(tx), tz)) {
      p.bumpTo(yaw);
      if (this.sound) this.sound.bump();
      return;
    }
    p.hopTo(tx, tz, yaw);
    if (this.sound) this.sound.hop();
  }

  // ---- 루프 ----

  update(dt) {
    const p = this.player;
    const w = this.world;

    if (this.state === 'title') {
      w.update(dt, Math.floor(this.camZ) - ROWS_BEHIND, Math.floor(this.camZ) + ROWS_AHEAD);
      this.camZ += (0 - this.camZ) * Math.min(1, dt * 4);
      return;
    }

    if (this.state === 'dying') {
      this.stepDeath(dt);
      w.update(dt, Math.floor(this.camZ) - ROWS_BEHIND, Math.floor(this.camZ) + ROWS_AHEAD);
      this.stepCamera(dt, true);
      return;
    }

    if (this.state !== 'play') return;

    // 1) 세계
    w.ensure(Math.round(p.z) + ROWS_AHEAD);
    w.prune(Math.floor(this.edge) - ROWS_BEHIND);
    w.update(dt, Math.floor(this.camZ) - ROWS_BEHIND, Math.floor(this.camZ) + ROWS_AHEAD);

    // 2) 입력 → 점프
    if (this.pending && !p.hopping && p.bump <= 0) {
      const dir = this.pending;
      this.pending = null;
      this.tryMove(dir);
    }

    // 3) 애니메이션 + 착지
    const wasHopping = p.hopping;
    p.update(dt);
    if (wasHopping && !p.hopping) this.onLand();

    // 4) 통나무를 타고 흘러간다
    if (p.ride && !p.hopping) {
      p.x = p.ride.x + p.rideOffset;
      if (Math.abs(p.x) > HALF_COLS + 1.4) { this.die('water'); return; }
    }

    // 5) 차·기차
    const hz = p.hopping
      ? Math.round(p.t < 0.5 ? p.fromZ : p.toZ)
      : p.gz;
    const hit = w.hazardAt(p.x, hz, 0.24);
    if (hit) { this.die(hit); return; }

    // 6) 독수리 압박
    this.idle += dt;
    this.edge += (SCROLL_BASE + this.score * SCROLL_GAIN) * dt;
    if (this.edge < p.z - BEHIND) this.edge = p.z - BEHIND;
    if (this.idle > IDLE_LIMIT || p.z < this.edge - 0.2) { this.die('eagle'); return; }

    this.stepCamera(dt, false);
    if (this.splash > 0) this.splash = Math.max(0, this.splash - dt * 2.4);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
    this.emitHud();
  }

  stepCamera(dt, dead) {
    const p = this.player;
    const target = dead ? this.camZ : Math.max(p.z, this.edge + BEHIND * 0.5);
    this.camZ += (target - this.camZ) * (1 - Math.exp(-CAM.follow * dt));
  }

  onLand() {
    const p = this.player;
    const w = this.world;
    const gz = p.gz;

    if (gz > this.score) {
      this.score = gz;
      this.idle = 0;
      if (this.sound) this.sound.step();
    }
    if (w.takeCoin(Math.round(p.x), gz)) {
      this.coins += 1;
      if (this.sound) this.sound.coin();
    }

    const lane = w.laneAt(gz);
    if (lane && lane.type === LANE.RIVER) {
      const log = w.logUnder(p.x, gz);
      if (!log) { this.die('water'); return; }
      p.ride = log;
      p.rideLane = lane;
      p.rideOffset = p.x - log.x;
    } else {
      p.ride = null;
      p.rideLane = null;
      p.x = Math.round(p.x);
    }
    this.emitHud();
  }

  // ---- 사망 ----

  die(cause) {
    if (this.state !== 'play') return;
    this.state = 'dying';
    this.cause = cause;
    this.deathT = 0;
    this.player.hopping = false;
    this.player.ride = null;
    if (cause === 'eagle') {
      this.eagle = { t: 0, x: this.player.x, z: this.player.z - 5, y: 9 };
    }
    if (cause === 'water') this.splash = 1;
    if (cause === 'car' || cause === 'train') this.shake = 1;
    if (this.sound) this.sound.die(cause);
  }

  stepDeath(dt) {
    const p = this.player;
    this.deathT += dt;
    if (this.cause === 'car' || this.cause === 'train') {
      p.flat = Math.min(1, p.flat + dt / 0.09);
    } else if (this.cause === 'water') {
      p.sink = Math.min(1, p.sink + dt / 0.55);
      this.splash = Math.max(0, this.splash - dt * 1.6);
    } else if (this.cause === 'eagle') {
      const e = this.eagle;
      e.t = Math.min(1, e.t + dt / EAGLE_TIME);
      const k = e.t;
      if (k < 0.5) {
        // 급강하: 뒤 위쪽에서 플레이어에게 내려온다.
        const u = k / 0.5;
        e.x = p.x;
        e.z = p.z - 5 * (1 - u);
        e.y = 9 * (1 - u) + 0.55 * u;
      } else {
        const u = (k - 0.5) / 0.5;
        e.x = p.x;
        e.z = p.z + u * 1.2;
        e.y = 0.55 + u * 9;
        p.lifted = u * 9;
      }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
    const done = this.cause === 'eagle' ? EAGLE_TIME : DEATH_HOLD;
    if (this.deathT >= done) this.finish();
  }

  finish() {
    this.state = 'over';
    let best = this.score;
    let totalCoins = this.coins;
    if (this.store) {
      best = this.store.saveBest(this.score);
      totalCoins = this.store.addCoins(this.coins);
    }
    this.onState('over', { score: this.score, best, coins: this.coins, totalCoins, cause: this.cause });
  }
}

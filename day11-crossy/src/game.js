// 게임 규칙: 이동 판정, 통나무 타기, 사망, 카메라·독수리 압박.

import {
  LANE, HALF_COLS, ROWS_AHEAD, ROWS_BEHIND, CAM,
  BEHIND_LIMIT, BEHIND_WARN, EAGLE_TIME, SCROLL_BASE, SCROLL_GAIN, COIN_PER_ROWS,
} from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FACE } from './models.js';

const DEATH_HOLD = 0.75;   // 깔린 뒤 결과 화면까지의 여유
const RESTART_LOCK = 0.4;  // 죽자마자 눌린 키로 넘어가지 않게 잠그는 시간
const BELL_GAP = 0.42;     // 건널목 종 "땡" 간격
const CUE_NEAR = 8;        // 소리를 낼 앞쪽 줄 범위

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
    this.deathT = 0;
    this.overT = 0;
    this.bellT = 0;
    this.honkT = 4;
    this.cause = null;
    this.bonus = 0;
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
    this.onHud({ score: this.score, coins: this.coins, danger: this.behind() > BEHIND_WARN });
  }

  // 플레이어가 카메라 초점 뒤로 얼마나 처졌는지(칸). 화면 아래로 밀려난 정도.
  behind() { return this.camZ - this.player.z; }

  // ---- 입력 ----

  move(dir) {
    if (this.state === 'over') { this.restart(); return; }
    if (this.state !== 'play') return;
    this.pending = dir;
  }

  // 결과 화면에서는 아무 버튼이나 누르면 다시 시작한다.
  anyKey() {
    if (this.state === 'over') this.restart();
  }

  restart() {
    if (this.overT < RESTART_LOCK) return;
    this.start();
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

    if (this.state === 'dying' || this.state === 'over') {
      // 결과 화면에서도 세계는 계속 움직인다 — 멈춘 그림보다 살아 있다.
      if (this.state === 'dying') this.stepDeath(dt);
      else this.overT += dt;
      w.update(dt, Math.floor(this.camZ) - ROWS_BEHIND, Math.floor(this.camZ) + ROWS_AHEAD);
      return;
    }

    if (this.state !== 'play') return;

    // 1) 세계
    w.ensure(Math.round(p.z) + ROWS_AHEAD);
    w.prune(Math.floor(this.camZ) - ROWS_BEHIND - 4);
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

    // 6) 시점 전진 → 화면 바닥까지 밀리면 독수리
    this.stepCamera(dt);
    if (this.behind() > BEHIND_LIMIT) { this.die('eagle'); return; }

    this.audioCues(dt);
    if (this.splash > 0) this.splash = Math.max(0, this.splash - dt * 2.4);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
    this.emitHud();
  }

  // 시점은 늘 앞으로 천천히 밀리고, 플레이어가 그보다 앞서면 부드럽게 따라붙는다.
  // 뒤로 처지는 만큼 플레이어는 화면 아래로 내려간다.
  stepCamera(dt) {
    const p = this.player;
    this.camZ += (SCROLL_BASE + this.score * SCROLL_GAIN) * dt;
    if (p.z > this.camZ) this.camZ += (p.z - this.camZ) * (1 - Math.exp(-CAM.follow * dt));
  }

  // 주변 상황에 맞춰 소리를 낸다(건널목 종 · 기차 · 경적).
  audioCues(dt) {
    if (!this.sound) return;
    const w = this.world;
    const z0 = Math.round(this.player.z);
    let warning = false;
    for (let z = z0 - 2; z <= z0 + CUE_NEAR; z += 1) {
      const lane = w.laneAt(z);
      if (!lane || lane.type !== LANE.RAIL) continue;
      if (lane.phase === 'warn') warning = true;
      // 기차가 나타나는 순간 한 번만 "슈우우웅"
      if (lane.train && !lane.whooshed) { lane.whooshed = true; this.sound.whoosh(); }
    }
    if (warning) {
      this.bellT -= dt;
      if (this.bellT <= 0) { this.sound.bell(); this.bellT = BELL_GAP; }
    } else {
      this.bellT = 0;
    }

    // 경적은 가끔만. 근처에 차가 없으면 조금 뒤에 다시 본다.
    this.honkT -= dt;
    if (this.honkT > 0) return;
    const px = this.player.x;
    let near = false;
    for (let z = z0 - 1; z <= z0 + 5 && !near; z += 1) {
      const lane = w.laneAt(z);
      if (!lane || lane.type !== LANE.ROAD) continue;
      for (const car of lane.cars) {
        if (Math.abs(car.x - px) < 6) { near = true; break; }
      }
    }
    if (near) { this.sound.honk(); this.honkT = 9 + Math.random() * 13; }
    else this.honkT = 2;
  }

  onLand() {
    const p = this.player;
    const w = this.world;
    const gz = p.gz;

    if (gz > this.score) {
      this.score = gz;
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
    this.overT = 0;
    // 간 거리만큼 코인 보너스. 주운 코인과 합쳐 HUD에 바로 반영된다.
    this.bonus = Math.floor(this.score / COIN_PER_ROWS);
    this.coins += this.bonus;
    this.emitHud();
    let best = this.score;
    let totalCoins = this.coins;
    if (this.store) {
      best = this.store.saveBest(this.score);
      totalCoins = this.store.addCoins(this.coins);
    }
    this.onState('over', { score: this.score, best, coins: this.coins, bonus: this.bonus, totalCoins, cause: this.cause });
  }
}

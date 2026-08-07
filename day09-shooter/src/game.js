// 게임 진행: 편대 스폰, 플레이어·적·탄·아이템 갱신, 충돌, 보스전, 승패.
// 캔버스를 모른다(렌더러가 이 상태를 읽어서 그린다).

import {
  W, H, PLAYER, START_LIVES, START_BOMBS, MAX_BOMBS, MAX_POWER, MAX_OPTIONS,
  P_BULLET, E_BULLET, BOMB, SCORE, ENEMY, BOSS,
} from './config.js';
import { STAGE, expand } from './waves.js';
import { submitScore, getBest } from './storage.js';

const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Game {
  constructor({ onHud, onState, sfx } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.sfx = sfx || (() => {});
    this.best = getBest();
    this.reset();
  }

  reset() {
    this.t = 0;
    this.scroll = 0;
    this.phase = 'ready';
    this.player = { x: W / 2, y: PLAYER.startY, invul: 0, fireCd: 0 };
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.power = 1;
    this.options = 0;
    this.score = 0;
    this.enemies = [];
    this.pb = [];        // 플레이어 탄
    this.eb = [];        // 적 탄
    this.pickups = [];
    this.fx = [];
    this.boss = null;
    this.waveIdx = 0;
    this.queue = [];     // 지연 스폰 대기열
    this.bombFlash = 0;
    this.keys = { l: 0, r: 0, u: 0, d: 0 };
    this.endTimer = 0;
    this._emit();
  }

  start() {
    if (this.phase === 'ready' || this.phase === 'dead' || this.phase === 'clear') {
      this.reset();
      this.phase = 'playing';
      this.onState('playing');
    }
  }

  _emit() {
    this.onHud({
      score: this.score, best: Math.max(this.best, this.score),
      lives: this.lives, bombs: this.bombs, power: this.power, options: this.options,
    });
  }

  // ---- 입력 ----

  movePlayerBy(dx, dy) {
    if (this.phase !== 'playing') return;
    const p = this.player;
    p.x = clamp(p.x + dx, 12, W - 12);
    p.y = clamp(p.y + dy, 40, H - 20);
  }

  setKey(k, on) { this.keys[k] = on ? 1 : 0; }

  useBomb() {
    if (this.phase !== 'playing' || this.bombs <= 0) return;
    this.bombs -= 1;
    this.bombFlash = BOMB.flash;
    this.player.invul = Math.max(this.player.invul, BOMB.invul);
    this.eb.length = 0;                       // 화면의 적 탄을 모두 지운다
    for (const e of this.enemies) this._hurt(e, BOMB.dmg);
    if (this.boss) this._hurtBoss(BOMB.dmg);
    this.sfx('bomb');
    this._emit();
  }

  // ---- 프레임 ----

  update() {
    if (this.phase !== 'playing') { this.scroll += 1; return; }
    this.t += 1;
    this.scroll += 2.2;
    if (this.bombFlash > 0) this.bombFlash -= 1;

    this._spawnWaves();
    this._player();
    this._enemies();
    this._boss();
    this._bullets();
    this._pickups();
    this._collide();
    this._fx();

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pb = this.pb.filter((b) => !b.dead);
    this.eb = this.eb.filter((b) => !b.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);

    if (this.endTimer > 0 && --this.endTimer === 0) this._finish(this._pendingWin);
  }

  // ---- 스폰 ----

  _spawnWaves() {
    while (this.waveIdx < STAGE.length && STAGE[this.waveIdx].t <= this.t) {
      const entry = STAGE[this.waveIdx];
      this.waveIdx += 1;
      if (entry.kind === 'boss') { this._spawnBoss(); continue; }
      for (const s of expand(entry)) this.queue.push({ ...s, at: this.t + (s.delay || 0) });
    }
    for (const q of this.queue) if (q.at <= this.t && !q.done) { q.done = true; this._spawnEnemy(q); }
    this.queue = this.queue.filter((q) => !q.done);
  }

  _spawnEnemy({ type, x, y, drop, sway }) {
    const def = ENEMY[type];
    const e = {
      type, x, y, r: def.r, hp: def.hp, maxHp: def.hp, score: def.score,
      fire: def.fire, fireCd: 50 + Math.floor(Math.random() * 50),
      drop: drop || null, t: 0, vx: 0, vy: def.speed, hit: 0, dead: false,
    };
    if (type === 'diver') {  // 등장 시점의 플레이어를 향해 돌진
      const a = Math.atan2(this.player.y - y, this.player.x - x);
      e.vx = Math.cos(a) * def.speed;
      e.vy = Math.sin(a) * def.speed;
    }
    if (sway) { e.vx = sway * 1.6; e.vy = def.speed * 0.75; }
    if (type === 'gunner') e.holdY = 110 + Math.random() * 70;
    this.enemies.push(e);
  }

  _spawnBoss() {
    this.boss = {
      x: W / 2, y: -70, r: BOSS.r, hp: BOSS.hp, maxHp: BOSS.hp,
      state: 'enter', t: 0, hit: 0, atkCd: 90, pattern: 0,
    };
    this.sfx('boss');
    this.onState('boss');
  }

  // ---- 플레이어 ----

  _player() {
    const p = this.player;
    if (p.invul > 0) p.invul -= 1;
    const k = this.keys;
    if (k.l || k.r || k.u || k.d) {
      this.movePlayerBy((k.r - k.l) * PLAYER.speed, (k.d - k.u) * PLAYER.speed);
    }
    if (--p.fireCd <= 0) { p.fireCd = PLAYER.fireEvery; this._fire(); }
  }

  // 무기 강화 단계에 따라 탄을 뿌린다. 보조기는 항상 직선탄 1발씩.
  _fire() {
    const { x, y } = this.player;
    const shot = (sx, sy, ang = 0, dmg = P_BULLET.dmg) => this.pb.push({
      x: sx, y: sy, vx: Math.sin(ang) * P_BULLET.speed, vy: -Math.cos(ang) * P_BULLET.speed,
      r: P_BULLET.r, dmg, dead: false,
    });
    const L = this.power;
    if (L === 1) shot(x, y - 14);
    else if (L === 2) { shot(x - 7, y - 12); shot(x + 7, y - 12); }
    else if (L === 3) { shot(x, y - 14); shot(x - 8, y - 10, -0.18); shot(x + 8, y - 10, 0.18); }
    else { shot(x - 6, y - 14); shot(x + 6, y - 14); shot(x - 12, y - 8, -0.26); shot(x + 12, y - 8, 0.26); }
    for (let i = 0; i < this.options; i += 1) {
      const ox = x + (i === 0 ? -26 : 26);
      shot(ox, y + 6);
    }
    this.sfx('shot');
  }

  // ---- 적 ----

  _enemies() {
    for (const e of this.enemies) {
      e.t += 1;
      if (e.hit > 0) e.hit -= 1;
      if (e.type === 'zig') {
        e.y += e.vy;
        e.x += Math.sin(e.t / 20) * 1.9 + e.vx;
      } else if (e.type === 'gunner') {
        if (e.y < e.holdY) e.y += e.vy;
        else e.x += Math.sin(e.t / 45) * 1.3;
      } else {
        e.x += e.vx; e.y += e.vy;
      }
      if (e.x < 14 || e.x > W - 14) e.vx *= -1;

      if (e.fire && --e.fireCd <= 0) {
        e.fireCd = e.fire;
        if (e.type === 'gunner') this._aimedSpread(e, 3, 0.26);
        else this._aimed(e);
      }
      if (e.y > H + 40 || e.t > 1400) e.dead = true;
    }
  }

  _aimed(from, speed = E_BULLET.speed) {
    const a = Math.atan2(this.player.y - from.y, this.player.x - from.x);
    this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: E_BULLET.r, dead: false });
  }

  _aimedSpread(from, n, spread, speed = E_BULLET.speed) {
    const base = Math.atan2(this.player.y - from.y, this.player.x - from.x);
    for (let i = 0; i < n; i += 1) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: E_BULLET.r, dead: false });
    }
  }

  _ring(from, n, speed, offset = 0) {
    for (let i = 0; i < n; i += 1) {
      const a = offset + (i / n) * Math.PI * 2;
      this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: E_BULLET.r, dead: false });
    }
  }

  // ---- 보스 ----

  _boss() {
    const b = this.boss;
    if (!b) return;
    b.t += 1;
    if (b.hit > 0) b.hit -= 1;

    if (b.state === 'enter') {
      b.y += 1.4;
      if (b.y >= BOSS.enterY) { b.y = BOSS.enterY; b.state = 'fight'; }
      return;
    }
    if (b.state === 'dying') {
      if (b.t % 6 === 0) {
        this.fx.push({
          x: b.x + (Math.random() - 0.5) * 70, y: b.y + (Math.random() - 0.5) * 50,
          t: 0, life: 26, r: 22, kind: 'boom',
        });
        this.sfx('boom');
      }
      return;
    }

    const ratio = b.hp / b.maxHp;
    const ph = ratio <= BOSS.phase3 ? 3 : (ratio <= BOSS.phase2 ? 2 : 1);
    b.x = W / 2 + Math.sin(b.t / (ph === 3 ? 40 : 62)) * (W / 2 - 60);

    if (--b.atkCd <= 0) {
      b.pattern = (b.pattern + 1) % 3;
      if (ph === 1) {
        if (b.pattern === 0) this._aimedSpread(b, 5, 0.2);
        else if (b.pattern === 1) { this._ring(b, 10, 2.2, b.t / 40); }
        else this._aimedSpread(b, 3, 0.5);
        b.atkCd = 78;
      } else if (ph === 2) {
        if (b.pattern === 0) this._aimedSpread(b, 7, 0.18);
        else if (b.pattern === 1) this._ring(b, 14, 2.4, b.t / 30);
        else { this._aimed(b, 3.4); this._aimedSpread(b, 4, 0.34); }
        b.atkCd = 62;
      } else {
        if (b.pattern === 0) this._aimedSpread(b, 9, 0.16, 3);
        else if (b.pattern === 1) { this._ring(b, 18, 2.6, b.t / 22); this._ring(b, 18, 1.8, -b.t / 22); }
        else this._aimedSpread(b, 5, 0.28, 3.2);
        b.atkCd = 48;
      }
    }
  }

  _hurtBoss(dmg) {
    const b = this.boss;
    if (!b || b.state === 'dying') return;
    b.hp -= dmg;
    b.hit = 4;
    if (b.hp <= 0) {
      b.hp = 0; b.state = 'dying'; b.t = 0;
      this.score += BOSS.score;
      this.eb.length = 0;
      this.endTimer = 90; this._pendingWin = true;
      this._emit();
    }
  }

  _hurt(e, dmg) {
    e.hp -= dmg;
    e.hit = 3;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.score += e.score;
      this.fx.push({ x: e.x, y: e.y, t: 0, life: 18, r: e.r + 6, kind: 'boom' });
      this.sfx('boom');
      if (e.drop) this._drop(e.x, e.y, e.drop);
      else if (Math.random() < 0.04) this._drop(e.x, e.y, 'P');
      this._emit();
    }
  }

  _drop(x, y, kind) {
    this.pickups.push({ x, y, kind, vy: 1.15, t: 0, dead: false });
  }

  // ---- 탄·아이템 ----

  _bullets() {
    for (const b of this.pb) {
      b.x += b.vx; b.y += b.vy;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) b.dead = true;
    }
    for (const b of this.eb) {
      b.x += b.vx; b.y += b.vy;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) b.dead = true;
    }
  }

  _pickups() {
    for (const p of this.pickups) {
      p.t += 1;
      p.y += p.vy;
      if (p.y > H + 20) p.dead = true;
    }
  }

  _fx() {
    for (const f of this.fx) f.t += 1;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  // ---- 충돌 ----

  _collide() {
    const p = this.player;

    // 플레이어 탄 → 적 / 보스
    for (const b of this.pb) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(b, e) < (b.r + e.r) ** 2) { b.dead = true; this._hurt(e, b.dmg); break; }
      }
      if (b.dead) continue;
      const bo = this.boss;
      if (bo && bo.state === 'fight' && dist2(b, bo) < (b.r + bo.r) ** 2) {
        b.dead = true; this._hurtBoss(b.dmg);
      }
    }

    // 아이템 획득
    for (const it of this.pickups) {
      if (it.dead) continue;
      if (dist2(it, p) < (12 + PLAYER.r) ** 2) { it.dead = true; this._take(it.kind); }
    }

    if (p.invul > 0 || this.phase !== 'playing') return;

    // 적 탄 → 플레이어
    for (const b of this.eb) {
      if (!b.dead && dist2(b, p) < (b.r + PLAYER.r) ** 2) { b.dead = true; this._die(); return; }
    }
    // 적 몸통 → 플레이어
    for (const e of this.enemies) {
      if (!e.dead && dist2(e, p) < (e.r + PLAYER.r) ** 2) { this._hurt(e, 999); this._die(); return; }
    }
    const bo = this.boss;
    if (bo && bo.state === 'fight' && dist2(bo, p) < (bo.r + PLAYER.r) ** 2) this._die();
  }

  _take(kind) {
    if (kind === 'P') {
      if (this.power < MAX_POWER) this.power += 1; else this.score += 200;
    } else if (kind === 'O') {
      if (this.options < MAX_OPTIONS) this.options += 1; else this.score += 200;
    } else if (kind === 'B') {
      if (this.bombs < MAX_BOMBS) this.bombs += 1; else this.score += 200;
    } else if (kind === 'L') {
      this.lives += 1;
    }
    this.score += SCORE.pickup;
    this.sfx('pickup');
    this._emit();
  }

  // 피격: 목숨 하나를 잃고 무기 한 단계 하락, 보조기는 사라진다.
  _die() {
    const p = this.player;
    this.fx.push({ x: p.x, y: p.y, t: 0, life: 26, r: 22, kind: 'boom' });
    this.sfx('hit');
    this.lives -= 1;
    this.power = Math.max(1, this.power - 1);
    this.options = 0;
    p.invul = PLAYER.respawnInvul;
    p.x = W / 2; p.y = PLAYER.startY;
    this._emit();
    if (this.lives < 0) { this.endTimer = 55; this._pendingWin = false; }
  }

  _finish(win) {
    this.phase = win ? 'clear' : 'dead';
    if (win) this.score += this.bombs * SCORE.bombLeft + Math.max(0, this.lives) * SCORE.lifeLeft;
    const { best, isNewBest } = submitScore(this.score);
    this.best = best;
    this._emit();
    this.onState(this.phase, { score: this.score, best, isNewBest });
  }
}

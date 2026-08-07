// 게임 진행: 편대 스폰, 플레이어·적·탄·아이템 갱신, 충돌, 보스전, 승패.
// 캔버스를 모른다(렌더러가 이 상태를 읽어서 그린다).

import {
  W, H, PLAYER, START_LIVES, START_BOMBS, MAX_BOMBS, MAX_POWER, MAX_OPTIONS,
  P_BULLET, E_BULLET, BOMB, SCORE, ENEMY, BOSS,
} from './config.js';
import { STAGES, expand } from './waves.js';
import { submitScore, getBest } from './storage.js';

const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Game {
  constructor({ onHud, onState, sfx } = {}) {
    this.onHud = onHud || (() => {});
    this.onState = onState || (() => {});
    this.sfx = sfx || (() => {});
    this.best = getBest();
    this.stageGen = 0;   // 스테이지가 바뀔 때마다 올라간다(입력 세대 구분). 리셋해도 되돌리지 않는다
    this.reset();
  }

  reset() {
    this.t = 0;
    this.scroll = 0;
    this.phase = 'ready';
    // wantX/wantY = 드래그로 쌓인 이동 요청(스텝마다 상한만큼 소화한다)
    // dead = 격추 후 사라져 있는 프레임, enter = 아래에서 복귀 진입하는 프레임
    // bank = 최근 좌우 이동량(부호 포함) — 기울기 스프라이트 선택에 쓴다
    this.player = {
      x: W / 2, y: PLAYER.startY, invul: 0, fireCd: 0,
      wantX: 0, wantY: 0, dead: 0, enter: 0, bank: 0,
    };
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
    this.parts = [];         // 불꽃·파편·연기
    this.shake = { mag: 0, t: 0 };
    this.boss = null;
    this.bombFlash = 0;
    this.keys = { l: 0, r: 0, u: 0, d: 0 };
    this.endTimer = 0;
    this.paused = false;
    this.stageIdx = 0;
    this.banner = null;      // 화면 가운데 크게 뜨는 안내(스테이지 표시)
    this.stageWait = 0;      // 다음 스테이지로 넘어가기까지 남은 프레임
    this._enterStage(0);
    this._emit();
  }

  // 스테이지 하나를 연다. 무기·보조기·폭탄·목숨은 그대로 이어간다.
  _enterStage(i) {
    this.stageIdx = i;
    this.stage = STAGES[i];
    this.t = 0;
    this.waveIdx = 0;
    this.queue = [];
    // 맵에 남아 있던 것들을 모두 치운다 — 안 그러면 대기 중에 얼어붙은 채로 떠 있는다
    this.enemies = [];
    this.eb = [];
    this.pb = [];
    this.fx = [];
    this.parts = [];
    this.boss = null;
    this.stageWait = 0;
    // pickups만 남긴다 — 보스가 떨군 보상을 다음 스테이지에서 주울 수 있게.
    // (아이템은 대기 중에도 계속 내려오므로 얼어붙지 않는다)
    // 조작이 들어올 때까지 편대를 내보내지 않는다 — 배경만 흐르는 제자리 비행 상태.
    // 세대를 올려서, 넘어오기 전부터 이어지던 드래그로는 시작되지 않게 한다
    // (손을 뗐다가 다시 잡아야 한다).
    this.armed = false;
    this.stageGen += 1;
    this._flyIn();
    this.banner = {
      text: `STAGE ${i + 1}`, sub: this.stage.name, hint: 'MOVE TO START',
      t: 0, life: 130, hold: true,
    };
  }

  // 첫 조작이 들어오면 스테이지를 연다.
  arm() {
    if (this.armed || this.phase !== 'playing' || this.paused) return;
    this.armed = true;
    if (this.banner) { this.banner.hold = false; this.banner.life = this.banner.t + 22; }
  }

  start() {
    if (this.phase === 'ready' || this.phase === 'dead' || this.phase === 'clear') {
      this.reset();
      this.paused = false;
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

  // 드래그가 직접 좌표를 옮기지 않는다 — 요청만 쌓고 _player()가 상한을 걸어 소화한다.
  // (손가락에 1:1로 붙이면 플릭 한 번에 순간이동해 키보드와 체감이 크게 갈렸다)
  movePlayerBy(dx, dy) {
    if (this.phase !== 'playing' || this.paused) return;
    this.arm();
    const p = this.player;
    p.wantX = clamp(p.wantX + dx, -PLAYER.dragMax, PLAYER.dragMax);
    p.wantY = clamp(p.wantY + dy, -PLAYER.dragMax, PLAYER.dragMax);
  }

  // 새 터치가 시작되면 이전 플릭의 잔량을 버린다
  resetDrag() { this.player.wantX = 0; this.player.wantY = 0; }

  setKey(k, on) { this.keys[k] = on ? 1 : 0; if (on) this.arm(); }

  // 일시정지 — 진행 중일 때만. 풀 때 눌린 키·드래그 잔량이 남아 튀지 않게 비운다.
  setPaused(on) {
    if (this.phase !== 'playing') { this.paused = false; return false; }
    this.paused = !!on;
    this.keys = { l: 0, r: 0, u: 0, d: 0 };
    this.resetDrag();
    return this.paused;
  }

  togglePause() { return this.setPaused(!this.paused); }

  useBomb() {
    if (this.phase !== 'playing' || this.paused || this.bombs <= 0) return;
    this.arm();
    this.bombs -= 1;
    this.bombFlash = BOMB.flash;
    this._shake(8);
    this.player.invul = Math.max(this.player.invul, BOMB.invul);
    this.eb.length = 0;                       // 화면의 적 탄을 모두 지운다
    for (const e of this.enemies) this._hurt(e, BOMB.dmg);
    if (this.boss) this._hurtBoss(BOMB.dmg);
    this.sfx('bomb');
    this._emit();
  }

  // ---- 연출 ----

  // 화면 흔들림. 렌더러가 game.shake만 읽어 화면 전체를 밀어 그린다.
  // 세기는 프레임마다 줄고, 흔드는 방향은 t로 정해 렌더 횟수와 무관하게 같다.
  _shake(mag) { this.shake.mag = Math.min(14, Math.max(this.shake.mag, mag)); }

  // 파편 한 뭉치. kind: spark(불꽃) / shard(금속 조각) / smoke(연기)
  _burst(x, y, n, kind, sp = 2.2, life = 26) {
    if (this.parts.length > 340) return;      // 폭주 방지
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.35 + Math.random());
      this.parts.push({
        x, y, kind,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        t: 0, life: Math.round(life * (0.6 + Math.random() * 0.7)),
      });
    }
  }

  // 격추 규모에 맞춰 불꽃 + 금속 조각 + 연기를 한 번에
  _debris(x, y, scale = 1) {
    this._burst(x, y, Math.round(7 * scale), 'spark', 2.4 * scale, 22);
    this._burst(x, y, Math.round(4 * scale), 'shard', 1.9 * scale, 34);
    this._burst(x, y, Math.round(2 * scale), 'smoke', 0.7, 40);
  }

  _parts() {
    for (const p of this.parts) {
      p.t += 1;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.93;
      if (p.kind === 'shard') p.vy = p.vy * 0.94 + 0.16;        // 조각은 떨어진다
      else if (p.kind === 'smoke') { p.vy = p.vy * 0.9 + 0.5; } // 연기는 뒤로 흘러간다
      else p.vy *= 0.93;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  }

  // ---- 프레임 ----

  update() {
    if (this.paused) return;
    if (this.phase !== 'playing') { this.scroll += 1; return; }
    this.scroll += 2.2;                    // 대기 중에도 배경은 흐른다(제자리 비행)
    if (this.banner) {
      this.banner.t += 1;
      if (!this.banner.hold && this.banner.t >= this.banner.life) this.banner = null;
    }

    // 첫 조작 전에는 편대·타이머가 멈춰 있다.
    // 다만 떨어지는 아이템(보스 보상)은 계속 내려오고 주울 수 있다.
    if (!this.armed) {
      this._glide();                    // 대기 중에도 기체는 아래에서 올라온다
      this._pickups();
      this._collide();
      this._fx();
      this._parts();
      this.pickups = this.pickups.filter((p) => !p.dead);
      this.fx = this.fx.filter((f) => f.t < f.life);
      return;
    }

    this.t += 1;
    if (this.bombFlash > 0) this.bombFlash -= 1;
    if (this.stageWait > 0 && --this.stageWait === 0) this._enterStage(this.stageIdx + 1);

    this._spawnWaves();
    this._player();
    this._enemies();
    this._boss();
    this._bullets();
    this._pickups();
    this._collide();
    this._fx();
    this._parts();
    if (this.shake.mag > 0) {
      this.shake.t += 1;
      this.shake.mag *= 0.86;
      if (this.shake.mag < 0.4) this.shake.mag = 0;
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pb = this.pb.filter((b) => !b.dead);
    this.eb = this.eb.filter((b) => !b.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);

    if (this.endTimer > 0 && --this.endTimer === 0) this._finish(this._pendingWin);
  }

  // ---- 스폰 ----

  _spawnWaves() {
    if (this.stageWait > 0) return;         // 스테이지 사이에는 새 편대를 내보내지 않는다
    const line = this.stage.timeline;
    while (this.waveIdx < line.length && line[this.waveIdx].t <= this.t) {
      const entry = line[this.waveIdx];
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
      type, x, y, r: def.r, hp: def.hp + this.stage.hpBonus, maxHp: def.hp + this.stage.hpBonus,
      score: def.score,
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
    const st = this.stage;
    this.boss = {
      x: W / 2, y: -70, r: st.bossR || BOSS.r, hp: st.bossHp, maxHp: st.bossHp,
      sprite: st.bossSprite, kind: st.bossKind || 'bomber', cd: st.bossCd,
      state: 'enter', t: 0, hit: 0, atkCd: 90, pattern: 0,
      spin: 0, burst: 0, burstCd: 0,
    };
    this.sfx('boss');
    this.onState('boss');
  }

  // ---- 플레이어 ----

  _player() {
    const p = this.player;
    if (p.invul > 0) p.invul -= 1;

    // 격추 직후 — 기체가 사라져 있다가 화면 아래에서 다시 날아 들어온다
    if (p.dead > 0) {
      p.dead -= 1;
      p.bank = 0;
      if (p.dead === 0 && this.lives >= 0) this._respawn();
      return;
    }

    if (this._glide()) {
      // 진입 활공 중에는 조작을 받지 않는다
    } else {
      // 키보드와 드래그를 한 벡터로 합치고 **같은 상한**으로 자른다.
      // 대각선이 빨라지지 않도록 축별이 아니라 크기로 자른다.
      const k = this.keys;
      let dx = (k.r - k.l) * PLAYER.speed + p.wantX;
      let dy = (k.d - k.u) * PLAYER.speed + p.wantY;
      const len = Math.hypot(dx, dy);
      if (len > PLAYER.speed) {
        const s = PLAYER.speed / len;
        dx *= s; dy *= s;
        p.wantX *= 1 - s; p.wantY *= 1 - s;   // 소화한 만큼만 덜어내고 나머지는 다음 스텝에
      } else {
        p.wantX = 0; p.wantY = 0;
      }
      const nx = clamp(p.x + dx, 16, W - 16);
      p.bank = p.bank * 0.6 + (nx - p.x) * 0.4;   // 부드럽게 — 한 프레임 떨림으로 스프라이트가 깜빡이지 않게
      p.x = nx;
      p.y = clamp(p.y + dy, 40, H - 20);
    }

    if (--p.fireCd <= 0) { p.fireCd = PLAYER.fireEvery; this._fire(); }
  }

  // 화면 밖 아래에서 시작 위치까지 날아 들어온다(스테이지 시작·격추 복귀 공용)
  _flyIn() {
    const p = this.player;
    p.x = W / 2;
    p.y = H + 24;
    p.enter = PLAYER.respawnLock;
    p.wantX = 0; p.wantY = 0; p.bank = 0;
  }

  // 진입 활공 한 스텝 — 조작 대기 중에도 돌려야 기체가 실제로 올라온다
  _glide() {
    const p = this.player;
    if (p.enter <= 0) return false;
    p.enter -= 1;
    p.y += (PLAYER.startY - p.y) * 0.16;
    if (p.enter === 0) p.y = PLAYER.startY;
    p.wantX = 0; p.wantY = 0; p.bank = 0;
    return true;
  }

  _respawn() {
    this._flyIn();
    this.player.invul = PLAYER.respawnInvul;
  }

  // 무기 강화 단계에 따라 탄을 뿌린다. 보조기는 항상 직선탄 1발씩.
  _fire() {
    const { x, y } = this.player;
    const shot = (sx, sy, ang = 0, dmg = P_BULLET.dmg) => this.pb.push({
      x: sx, y: sy, vx: Math.sin(ang) * P_BULLET.speed, vy: -Math.cos(ang) * P_BULLET.speed,
      r: P_BULLET.r, dmg, dead: false,
    });
    // 1 단발 → 2 2연 → 3 3방향 → 4 4연 → 5 5방향 → 6 6방향(넓은 부채)
    const L = this.power;
    if (L === 1) {
      shot(x, y - 18);
    } else if (L === 2) {
      shot(x - 8, y - 16); shot(x + 8, y - 16);
    } else if (L === 3) {
      shot(x, y - 18);
      shot(x - 10, y - 13, -0.18); shot(x + 10, y - 13, 0.18);
    } else if (L === 4) {
      shot(x - 7, y - 18); shot(x + 7, y - 18);
      shot(x - 16, y - 11, -0.26); shot(x + 16, y - 11, 0.26);
    } else if (L === 5) {
      shot(x, y - 19);
      shot(x - 9, y - 16); shot(x + 9, y - 16);
      shot(x - 18, y - 10, -0.34); shot(x + 18, y - 10, 0.34);
    } else {
      shot(x - 4, y - 19); shot(x + 4, y - 19);
      shot(x - 12, y - 15, -0.16); shot(x + 12, y - 15, 0.16);
      shot(x - 20, y - 9, -0.42); shot(x + 20, y - 9, 0.42);
    }
    for (let i = 0; i < this.options; i += 1) {
      const ox = x + (i === 0 ? -32 : 32);
      shot(ox, y + 8);
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

  // 스테이지가 올라갈수록 적 탄이 조금씩 빨라진다
  _aimed(from, speed = E_BULLET.speed) {
    speed *= this.stage.bulletMul;
    const a = Math.atan2(this.player.y - from.y, this.player.x - from.x);
    this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: E_BULLET.r, dead: false });
  }

  _aimedSpread(from, n, spread, speed = E_BULLET.speed) {
    speed *= this.stage.bulletMul;
    const base = Math.atan2(this.player.y - from.y, this.player.x - from.x);
    for (let i = 0; i < n; i += 1) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: E_BULLET.r, dead: false });
    }
  }

  // 회전하는 팔에서 한 발씩 — 여러 프레임에 걸쳐 나선을 그린다
  _spiralShot(from, arms, angle, speed) {
    const sp = speed * this.stage.bulletMul;
    for (let i = 0; i < arms; i += 1) {
      const a = angle + (i / arms) * Math.PI * 2;
      this.eb.push({ x: from.x, y: from.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: E_BULLET.r, dead: false });
    }
  }

  // 가로 탄막 — 한 곳만 비워 그 틈으로 빠져나가게 한다
  _wall(from, speed, gapX, gapW = 46) {
    const sp = speed * this.stage.bulletMul;
    for (let x = 14; x < W - 10; x += 22) {
      if (Math.abs(x - gapX) < gapW / 2) continue;
      this.eb.push({ x, y: from.y + 10, vx: 0, vy: sp, r: E_BULLET.r, dead: false });
    }
  }

  // 좌우 엔진 포드에서 조준탄 — 발사 위치가 갈라져 사이가 위험하다
  _pods(from, speed, spread = 0) {
    for (const sgn of [-1, 1]) {
      this._aimed({ x: from.x + sgn * 25, y: from.y + 12 }, speed);
      if (spread) this._aimedSpread({ x: from.x + sgn * 25, y: from.y + 12 }, 3, spread, speed);
    }
  }

  _ring(from, n, speed, offset = 0) {
    speed *= this.stage.bulletMul;
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
        const ex = b.x + (Math.random() - 0.5) * b.r * 2.6;
        const ey = b.y + (Math.random() - 0.5) * b.r * 2;
        this.fx.push({ x: ex, y: ey, t: 0, life: 26, r: 22, kind: 'boom' });
        this._debris(ex, ey, 1.6);
        this._shake(7);
        this.sfx('boom');
      }
      return;
    }

    const ratio = b.hp / b.maxHp;
    const ph = ratio <= BOSS.phase3 ? 3 : (ratio <= BOSS.phase2 ? 2 : 1);
    if (b.kind === 'airship') { this._airship(b, ph); return; }   // 라스트 보스는 패턴이 따로다
    if (b.kind === 'wing') { this._wingBoss(b, ph); return; }

    b.x = W / 2 + Math.sin(b.t / (ph === 3 ? 40 : 62)) * (W / 2 - 60);

    if (--b.atkCd <= 0) {
      b.pattern = (b.pattern + 1) % 3;
      if (ph === 1) {
        if (b.pattern === 0) this._aimedSpread(b, 5, 0.2);
        else if (b.pattern === 1) { this._ring(b, 10, 2.2, b.t / 40); }
        else this._aimedSpread(b, 3, 0.5);
        b.atkCd = Math.round(78 * b.cd);
      } else if (ph === 2) {
        if (b.pattern === 0) this._aimedSpread(b, 7, 0.18);
        else if (b.pattern === 1) this._ring(b, 14, 2.4, b.t / 30);
        else { this._aimed(b, 3.4); this._aimedSpread(b, 4, 0.34); }
        b.atkCd = Math.round(62 * b.cd);
      } else {
        if (b.pattern === 0) this._aimedSpread(b, 9, 0.16, 3);
        else if (b.pattern === 1) { this._ring(b, 18, 2.6, b.t / 22); this._ring(b, 18, 1.8, -b.t / 22); }
        else this._aimedSpread(b, 5, 0.28, 3.2);
        b.atkCd = Math.round(48 * b.cd);
      }
    }
  }

  // 2스테이지 보스(전익기) — 빠르게 횡단하며 넓게 뿌린다.
  // 폭격기가 제자리에서 쏜다면 이쪽은 이동 자체가 압박이다.
  _wingBoss(b, ph) {
    const sweep = ph === 3 ? 44 : (ph === 2 ? 54 : 66);
    b.x = W / 2 + Math.sin(b.t / sweep) * (W / 2 - 52);
    b.y = BOSS.enterY + Math.sin(b.t / 51) * 6;

    if (--b.atkCd > 0) return;
    const P = ph === 1 ? 3 : (ph === 2 ? 4 : 5);
    b.pattern = (b.pattern + 1) % P;
    const cd = (n) => Math.round(n * b.cd);

    if (b.pattern === 0) {                       // 넓은 부채
      this._aimedSpread(b, ph === 3 ? 9 : 7, 0.19);
      b.atkCd = cd(ph === 3 ? 48 : 64);
    } else if (b.pattern === 1) {                // 날개 끝 교차 사격
      for (const sgn of [-1, 1]) {
        this._aimed({ x: b.x + sgn * 34, y: b.y + 8 }, 2.9);
        this._aimedSpread({ x: b.x + sgn * 34, y: b.y + 8 }, 3, 0.26);
      }
      b.atkCd = cd(ph === 3 ? 44 : 58);
    } else if (b.pattern === 2) {                // 흡입구 넷에서 동시에
      for (const d of [-26, -13, 13, 26]) {
        this._aimed({ x: b.x + d, y: b.y + 10 }, 2.5);
      }
      b.atkCd = cd(ph === 3 ? 50 : 68);
    } else if (b.pattern === 3) {                // 링 + 조준탄
      this._ring(b, ph === 3 ? 18 : 14, 2.2, b.t / 26);
      this._aimed(b, 3.2);
      b.atkCd = cd(66);
    } else {                                     // 3페이즈 — 벽 + 부채
      this._wall(b, 2.4, this.player.x, 52);
      this._aimedSpread(b, 5, 0.3, 3.1);
      b.atkCd = cd(72);
    }
  }

  // 라스트 보스(비공정) — 느리게 떠다니며 패턴을 길게 끈다.
  // 나선·탄막벽·포드 조준탄이 섞여서 폭격기와 결이 다르다.
  _airship(b, ph) {
    // 육중하게 좌우로 미끄러지며 위아래로 조금 흔들린다
    b.x = W / 2 + Math.sin(b.t / (ph === 3 ? 96 : 128)) * (W / 2 - 74);
    b.y = BOSS.enterY + 12 + Math.sin(b.t / 74) * 9;

    // 나선은 여러 프레임에 걸쳐 흩뿌린다
    if (b.burst > 0) {
      b.burst -= 1;
      if (--b.burstCd <= 0) {
        b.burstCd = ph === 3 ? 3 : 4;
        b.spin += ph === 3 ? 0.42 : 0.34;
        this._spiralShot(b, ph === 3 ? 3 : 2, b.spin, 2.0);
      }
      return;
    }

    if (--b.atkCd > 0) return;
    const P = ph === 1 ? 3 : (ph === 2 ? 4 : 5);
    b.pattern = (b.pattern + 1) % P;
    const cd = (n) => Math.round(n * b.cd);

    if (b.pattern === 0) {                       // 포드 조준탄
      this._pods(b, 2.6, ph >= 2 ? 0.22 : 0);
      b.atkCd = cd(ph === 3 ? 46 : 60);
    } else if (b.pattern === 1) {                // 나선
      b.burst = ph === 3 ? 70 : 52;
      b.burstCd = 1;
      b.atkCd = cd(70);
    } else if (b.pattern === 2) {                // 탄막벽 — 틈으로 빠져나간다
      this._wall(b, 2.2, this.player.x, ph === 3 ? 40 : 56);
      b.atkCd = cd(ph === 3 ? 62 : 82);
    } else if (b.pattern === 3) {                // 링 + 조준 확산
      this._ring(b, ph === 3 ? 20 : 16, 2.0, b.t / 30);
      this._aimedSpread(b, 5, 0.22);
      b.atkCd = cd(72);
    } else {                                     // 3페이즈 마무리 — 역방향 이중 링
      this._ring(b, 22, 2.3, b.t / 24);
      this._ring(b, 22, 1.5, -b.t / 24);
      this._pods(b, 3.0);
      b.atkCd = cd(78);
    }
  }

  _hurtBoss(dmg) {
    const b = this.boss;
    if (!b || b.state === 'dying') return;
    b.hp -= dmg;
    b.hit = 4;
    if (b.hp <= 0) {
      b.hp = 0; b.state = 'dying'; b.t = 0;
      this.score += SCORE.boss[this.stageIdx];
      this.eb.length = 0;
      this._drop(b.x - 16, b.y, 'P');       // 보스 격파 보상
      this._drop(b.x + 16, b.y, 'B');
      const last = this.stageIdx >= STAGES.length - 1;
      if (last) {
        this.endTimer = 90; this._pendingWin = true;
      } else {
        this.stageWait = 110;                 // 잠깐 뜸을 들였다가 다음 스테이지
        this.banner = { text: 'STAGE CLEAR', sub: `+${SCORE.stageClear}`, t: 0, life: 110 };
        this.score += SCORE.stageClear;
      }
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
      const big = e.type === 'gunner';
      this._debris(e.x, e.y, big ? 1.8 : 1);
      if (big) this._shake(3);
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

    // 아이템 획득 — 사라져 있는 동안은 줍지 않는다
    if (p.dead === 0) {
      for (const it of this.pickups) {
        if (it.dead) continue;
        if (dist2(it, p) < (12 + PLAYER.r) ** 2) { it.dead = true; this._take(it.kind); }
      }
    }

    if (this.debugInvul || p.invul > 0 || p.dead > 0 || this.phase !== 'playing') return;

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
  // 그 자리에서 즉시 부활하지 않고 잠시 사라졌다가 시작 위치로 복귀한다.
  _die() {
    const p = this.player;
    if (p.dead > 0) return;
    this.fx.push({ x: p.x, y: p.y, t: 0, life: 26, r: 22, kind: 'boom' });
    this._debris(p.x, p.y, 2.4);
    this._shake(10);
    this.sfx('hit');
    this.lives -= 1;
    this.power = Math.max(1, this.power - 1);
    this.options = 0;
    p.dead = PLAYER.deadPause;
    p.invul = 0;
    p.wantX = 0; p.wantY = 0;
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

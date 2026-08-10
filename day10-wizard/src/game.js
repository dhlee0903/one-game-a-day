// 게임 상태와 규칙. 그리기는 하지 않는다(renderer.js가 읽기만 한다).
//
// 뱀서 규칙을 그대로 따른다.
//   · 조작은 이동뿐 — 공격은 전부 자동
//   · 적은 화면 밖에서 계속 밀려오고, 죽으면 경험치 보석을 떨군다
//   · 보석을 먹어 레벨이 오르면 시간이 멈추고 카드 세 장 중 하나를 고른다
//   · 15분을 버티면 클리어

import {
  W, H, PLAYER, RUN_SEC, ENEMY, SCALE, GEM, gemTier, GEM_DRIFT, GEM_CAP,
  DROP, HEART_HEAL, xpNeed, MAX_LV, MAX_WEAPONS, MAX_PASSIVES, PICK_COUNT, FX,
} from './config.js';
import { WEAPONS, WEAPON_IDS, statsOf } from './weapons.js';
import { modsOf, rollChoices } from './upgrades.js';
import { Spawner } from './spawner.js';
import { Animator } from './anim.js';
import { submitScore } from './storage.js';

const TAU = Math.PI * 2;
const RECYCLE_D = 620;    // 이보다 멀어진 적은 앞쪽 테두리로 다시 세운다

// 시드 난수 — 같은 판에서 나오는 무작위를 한 군데로 모은다
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor({ onState } = {}) {
    this.onState = onState || (() => {});
    this.spawner = new Spawner();
    this.reset();
  }

  reset(seed = (Date.now() & 0x7fffffff)) {
    this.rnd = mulberry32(seed);
    this.phase = 'title';
    this.paused = false;
    this.t = 0;

    this.px = 0;
    this.py = 0;
    this.vx = 0;
    this.vy = 0;
    this.faceX = 1;
    this.faceHold = 0;
    this.moving = false;
    this.anim = new Animator('wizard.idle');

    this.maxHp = PLAYER.hp;
    this.hp = PLAYER.hp;
    this.hurtCd = 0;
    this.regenBank = 0;

    this.level = 1;
    this.xp = 0;
    this.xpNext = xpNeed(1);
    this.kills = 0;

    // 시작 무기는 뱀서처럼 하나만 — 나머지는 레벨업으로 얻는다
    this.weapons = { bolt: 1 };
    this.passives = {};
    this.wcd = { bolt: 24 };
    this.mods = modsOf(this.passives);

    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    this.drops = [];
    this.zaps = [];
    this.patches = [];
    this.parts = [];
    this.orbs = [];
    this.runeA = 0;
    this.auraPulse = 0;

    this.stick = null;      // input.js가 채운다(가상 스틱 표시용)
    this.inx = 0;
    this.iny = 0;
    this.shake = 0;
    this.bannerText = '';
    this.bannerT = 0;
    this.choices = [];
    this.eid = 1;

    this.spawner.reset();
    this.emit();
  }

  start() {
    if (this.phase === 'over' || this.phase === 'clear') this.reset();
    this.phase = 'playing';
    this.emit();
  }

  setPaused(on) {
    if (this.phase !== 'playing') return;
    this.paused = on;
  }

  emit() {
    this.onState(this.phase, this.summary());
  }

  summary() {
    return {
      sec: Math.floor(this.t / 60),
      kills: this.kills,
      level: this.level,
      choices: this.choices,
    };
  }

  get sec() { return Math.floor(this.t / 60); }

  // ---- 입력 ----
  // input.js가 매 스텝 -1~1 방향을 넣어준다
  setMove(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.inx = dx;
    this.iny = dy;
  }

  // ---- 갱신 ----
  update() {
    if (this.phase !== 'playing' || this.paused) return;
    this.t += 1;

    this.movePlayer();
    this.tickWeapons();
    this.tickRunes();
    this.tickProjectiles();
    this.tickZaps();
    this.tickPatches();
    this.spawner.update(this);
    this.tickEnemies();
    this.tickPickups();
    this.tickParts();

    if (this.bannerT > 0) this.bannerT -= 1;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.35);
    if (this.auraPulse > 0) this.auraPulse -= 1;
    if (this.hurtCd > 0) this.hurtCd -= 1;

    // 재생
    if (this.mods.regen > 0 && this.hp > 0) {
      this.regenBank += this.mods.regen / 60;
      if (this.regenBank >= 1) {
        const heal = Math.floor(this.regenBank);
        this.regenBank -= heal;
        this.hp = Math.min(this.maxHp, this.hp + heal);
      }
    }

    if (this.xp >= this.xpNext) this.levelUp();
    if (this.hp <= 0) this.finish('over');
    else if (this.t >= RUN_SEC * 60) this.finish('clear');
  }

  movePlayer() {
    const sp = PLAYER.speed * this.mods.speed;
    const dx = (this.inx || 0) * sp;
    const dy = (this.iny || 0) * sp;
    this.px += dx;
    this.py += dy;
    this.moving = dx !== 0 || dy !== 0;

    if (dx !== 0) { this.faceX = dx > 0 ? 1 : -1; this.faceHold = PLAYER.faceKeep; } else if (this.faceHold > 0) this.faceHold -= 1;

    this.anim.set(this.moving ? 'wizard.walk' : 'wizard.idle');
    this.anim.step(1);
  }

  tickWeapons() {
    for (const id of Object.keys(this.weapons)) {
      const def = WEAPONS[id];
      if (def.passive) continue;
      const s = statsOf(id, this.weapons[id], this.mods);
      this.wcd[id] = (this.wcd[id] || 0) - 1;
      if (this.wcd[id] > 0) continue;
      this.wcd[id] = s.cd;
      def.fire(this, s);
    }
  }

  // 수호 룬 — 발사가 아니라 항상 돌고 있다
  tickRunes() {
    const lv = this.weapons.rune;
    if (!lv) { this.orbs.length = 0; return; }
    const s = statsOf('rune', lv, this.mods);
    this.runeA = (this.runeA + s.spin) % TAU;
    this.orbs.length = 0;
    for (let i = 0; i < s.n; i += 1) {
      const a = this.runeA + (i / s.n) * TAU;
      this.orbs.push({ x: this.px + Math.cos(a) * s.rad, y: this.py - 6 + Math.sin(a) * s.rad * 0.72, r: 7 });
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.runeCd > 0) { e.runeCd -= 1; continue; }
      for (const o of this.orbs) {
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const rr = o.r + e.r;
        if (dx * dx + dy * dy <= rr * rr) {
          this.damageEnemy(e, s.dmg, { knock: 2.4, kx: dx, ky: dy });
          e.runeCd = 26;
          break;
        }
      }
    }
  }

  addProjectile(p) {
    this.projectiles.push({
      x: p.x, y: p.y,
      vx: Math.cos(p.a) * p.speed,
      vy: Math.sin(p.a) * p.speed,
      r: p.r, dmg: p.dmg, pierce: p.pierce || 0,
      clip: p.clip || null, spr: p.spr || null, flip: !!p.flip,
      life: p.life, t: 0, hits: null,
    });
  }

  tickProjectiles() {
    const keep = [];
    for (const p of this.projectiles) {
      p.x += p.vx;
      p.y += p.vy;
      p.t += 1;
      p.life -= 1;
      let alive = p.life > 0;
      if (alive) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (p.hits && p.hits.has(e.id)) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const rr = p.r + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          this.damageEnemy(e, p.dmg, { knock: 2.6, kx: p.vx, ky: p.vy });
          if (p.pierce > 0) {
            p.pierce -= 1;
            if (!p.hits) p.hits = new Set();
            p.hits.add(e.id);
          } else { alive = false; break; }
        }
      }
      // 화면에서 한참 벗어나면 버린다
      if (alive && (Math.abs(p.x - this.px) > W || Math.abs(p.y - this.py) > H)) alive = false;
      if (alive) keep.push(p);
    }
    this.projectiles = keep;
  }

  tickZaps() {
    const keep = [];
    for (const z of this.zaps) {
      if (!z.done) {
        z.done = true;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - z.x;
          const dy = e.y - z.y;
          const rr = z.splash + e.r;
          if (dx * dx + dy * dy <= rr * rr) this.damageEnemy(e, z.dmg, { knock: 3, kx: dx, ky: dy });
        }
        this.spark(z.x, z.y, 6, '#cfe9ff');
      }
      z.t += 1;
      if (z.t < z.life) keep.push(z);
    }
    this.zaps = keep;
  }

  tickPatches() {
    const keep = [];
    for (const f of this.patches) {
      f.t += 1;
      f.life -= 1;
      f.tick -= 1;
      if (f.tick <= 0) {
        f.tick = 20;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - f.x;
          const dy = (e.y - f.y) / 0.7;
          const rr = f.r + e.r;
          if (dx * dx + dy * dy <= rr * rr) this.damageEnemy(e, f.dmg, { knock: 0 });
        }
      }
      if (f.life > 0) keep.push(f);
    }
    this.patches = keep;
  }

  // ---- 적 ----
  spawn(kind, at) {
    const def = ENEMY[kind];
    const min = this.t / 3600;
    const hp = Math.round(def.hp * SCALE.hp(min));
    this.enemies.push({
      id: this.eid += 1,
      kind,
      x: at.x,
      y: at.y,
      hp,
      maxHp: hp,
      r: def.r,
      speed: def.speed * SCALE.speed(min),
      dmg: Math.round(def.dmg * SCALE.dmg(min)),
      boss: !!def.boss,
      elite: !!def.elite,
      face: -1,
      kx: 0,
      ky: 0,
      flash: 0,
      flashCd: 0,
      runeCd: 0,
      t: Math.floor(this.rnd() * 60),
      dead: false,
    });
  }

  tickEnemies() {
    const alive = [];
    // 서로 겹쳐 한 점에 뭉치지 않게 격자에 담아 이웃끼리만 밀어낸다
    const CELL = 18;
    const grid = new Map();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const key = `${Math.floor(e.x / CELL)},${Math.floor(e.y / CELL)}`;
      const cell = grid.get(key);
      if (cell) cell.push(e); else grid.set(key, [e]);
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += 1;
      if (e.flash > 0) e.flash -= 1;
      if (e.flashCd > 0) e.flashCd -= 1;

      let dx = this.px - e.x;
      let dy = this.py - e.y;
      let d = Math.hypot(dx, dy) || 1;
      // 한참 뒤로 처진 적은 버리지 않고 앞쪽 테두리로 돌려세운다.
      // 안 그러면 달아나는 동안 적이 화면 밖에 끝없이 늘어서기만 한다.
      if (d > RECYCLE_D && !e.boss) {
        const p = this.spawner.edgePoint(this);
        e.x = p.x;
        e.y = p.y;
        e.kx = 0;
        e.ky = 0;
        dx = this.px - e.x;
        dy = this.py - e.y;
        d = Math.hypot(dx, dy) || 1;
      }
      e.face = dx >= 0 ? 1 : -1;
      e.x += (dx / d) * e.speed + e.kx;
      e.y += (dy / d) * e.speed + e.ky;
      e.kx *= 0.82;
      e.ky *= 0.82;
      if (Math.abs(e.kx) < 0.02) e.kx = 0;
      if (Math.abs(e.ky) < 0.02) e.ky = 0;

      // 이웃 밀어내기(같은 칸과 오른쪽·아래 칸만 봐서 쌍마다 한 번씩)
      const cx = Math.floor(e.x / CELL);
      const cy = Math.floor(e.y / CELL);
      for (let ox = 0; ox <= 1; ox += 1) {
        for (let oy = ox === 0 ? 0 : -1; oy <= 1; oy += 1) {
          const cell = grid.get(`${cx + ox},${cy + oy}`);
          if (!cell) continue;
          for (const o of cell) {
            if (o === e || o.dead || o.boss) continue;
            const ddx = o.x - e.x;
            const ddy = o.y - e.y;
            const min = e.r + o.r;
            const dd = ddx * ddx + ddy * ddy;
            if (dd >= min * min || dd === 0) continue;
            const dist = Math.sqrt(dd) || 1;
            const push = (min - dist) * 0.22;
            const ux = ddx / dist;
            const uy = ddy / dist;
            o.x += ux * push;
            o.y += uy * push;
            e.x -= ux * push;
            e.y -= uy * push;
          }
        }
      }

      // 접촉 피해
      if (this.hurtCd === 0) {
        const rr = e.r + PLAYER.r;
        const hx = this.px - e.x;
        const hy = this.py - 6 - e.y;
        if (hx * hx + hy * hy <= rr * rr) this.hurt(e.dmg);
      }

      alive.push(e);
    }
    this.enemies = alive;
  }

  damageEnemy(e, dmg, opt = {}) {
    if (e.dead) return;
    e.hp -= dmg;
    // 오라·룬처럼 계속 때리는 무기 안에 있으면 매 프레임 흰색으로 타 실루엣만 남는다.
    // 번쩍인 뒤에는 잠깐 쉬게 해서 원래 그림이 보이게 한다.
    if (e.flashCd <= 0) { e.flash = FX.hitFlash; e.flashCd = FX.hitFlash + 10; }
    const kn = (opt.knock || 0) * (ENEMY[e.kind].knock ?? 1);
    if (kn > 0) {
      const d = Math.hypot(opt.kx || 0, opt.ky || 0) || 1;
      e.kx += ((opt.kx || 0) / d) * kn;
      e.ky += ((opt.ky || 0) / d) * kn;
    }
    if (e.hp > 0) return;
    e.dead = true;
    this.kills += 1;
    this.killDrop(e);
  }

  addGem(x, y, xp, spread = 0) {
    this.gems.push({
      x, y, xp, tier: gemTier(xp), t: 0,
      vx: (this.rnd() - 0.5) * spread, vy: (this.rnd() - 0.5) * spread,
    });
    if (this.gems.length > GEM_CAP) this.mergeFarGem();
  }

  // 보석이 너무 많이 깔리면 화면도 지저분하고 처리도 무겁다.
  // 가장 먼 보석을 그 다음으로 먼 보석에 합친다 — 경험치 총량은 그대로다.
  mergeFarGem() {
    let far = -1;
    let second = -1;
    let d1 = -1;
    let d2 = -1;
    for (let i = 0; i < this.gems.length; i += 1) {
      const g = this.gems[i];
      const d = (g.x - this.px) ** 2 + (g.y - this.py) ** 2;
      if (d > d1) { d2 = d1; second = far; d1 = d; far = i; } else if (d > d2) { d2 = d; second = i; }
    }
    if (far < 0 || second < 0) return;
    const g = this.gems[second];
    g.xp += this.gems[far].xp;
    g.tier = gemTier(g.xp);
    this.gems.splice(far, 1);
  }

  killDrop(e) {
    const def = ENEMY[e.kind];
    this.addGem(e.x, e.y, GEM[def.gem].xp, 1.2);
    this.spark(e.x, e.y, e.boss ? 40 : e.elite ? 16 : 6, e.boss ? '#b06bff' : '#ffd6a0');

    if (e.boss) {
      this.shake = Math.max(this.shake, FX.shakeBoss);
      this.banner('보스 격파', 110);
      this.drops.push({ kind: 'chest', x: e.x, y: e.y, life: DROP.life });
      // 보스는 보석을 여러 개 떨군다
      for (let i = 0; i < 6; i += 1) {
        const a = this.rnd() * TAU;
        this.addGem(e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, GEM[2].xp);
      }
      return;
    }
    if (e.elite && DROP.chestFromElite) {
      this.drops.push({ kind: 'chest', x: e.x, y: e.y, life: DROP.life });
      return;
    }
    const r = this.rnd();
    if (r < DROP.heartChance) this.drops.push({ kind: 'heart', x: e.x, y: e.y, life: DROP.life });
    else if (r < DROP.heartChance + DROP.magnetChance) this.drops.push({ kind: 'magnet', x: e.x, y: e.y, life: DROP.life });
  }

  hurt(dmg) {
    this.hp -= dmg;
    this.hurtCd = PLAYER.hurtCd;
    this.shake = Math.max(this.shake, FX.shakeHurt);
    this.spark(this.px, this.py - 8, 5, '#ff5a63');
  }

  // ---- 획득물 ----
  tickPickups() {
    const pull = PLAYER.pickR * this.mods.magnet;
    const keepGems = [];
    for (const g of this.gems) {
      g.t += 1;
      g.x += g.vx;
      g.y += g.vy;
      g.vx *= 0.9;
      g.vy *= 0.9;
      const dx = this.px - g.x;
      const dy = this.py - 6 - g.y;
      const d = Math.hypot(dx, dy) || 1;
      if (g.magnet || d < pull) {
        g.magnet = true;
        const sp = Math.min(7, 1.6 + (pull - d) * 0.12 + g.t * 0.02);
        g.x += (dx / d) * sp;
        g.y += (dy / d) * sp;
      } else if (d < GEM_DRIFT) {
        // 흘리고 지나간 보석이 화면 밖에 쌓이지 않게 천천히 따라온다
        g.x += (dx / d) * 0.5;
        g.y += (dy / d) * 0.5;
      }
      if (d < 8) {
        this.xp += Math.max(1, Math.round(g.xp * this.mods.wisdom));
        continue;
      }
      keepGems.push(g);
    }
    this.gems = keepGems;

    const keepDrops = [];
    for (const d of this.drops) {
      d.life -= 1;
      const dx = this.px - d.x;
      const dy = this.py - 6 - d.y;
      if (dx * dx + dy * dy < 12 * 12) { this.collect(d); continue; }
      if (d.life > 0) keepDrops.push(d);
    }
    this.drops = keepDrops;
  }

  collect(d) {
    if (d.kind === 'heart') {
      this.hp = Math.min(this.maxHp, this.hp + HEART_HEAL);
      this.banner('회복', 60);
    } else if (d.kind === 'magnet') {
      for (const g of this.gems) g.magnet = true;
      this.banner('보석 흡수', 60);
    } else if (d.kind === 'chest') {
      this.openChest();
    }
  }

  // 상자 — 가진 무기 하나가 즉시 한 단계 오른다(전부 만렙이면 회복)
  openChest() {
    const canLevel = Object.keys(this.weapons).filter((id) => this.weapons[id] < MAX_LV);
    const canLearn = Object.keys(this.weapons).length < MAX_WEAPONS
      ? WEAPON_IDS.filter((id) => !this.weapons[id]) : [];
    const pool = canLevel.concat(canLearn);
    if (!pool.length) {
      this.hp = Math.min(this.maxHp, this.hp + 50);
      this.banner('상자 · 회복 50', 100);
      return;
    }
    const id = pool[Math.floor(this.rnd() * pool.length)];
    this.grantWeapon(id);
    this.banner(`상자 · ${WEAPONS[id].name} Lv ${this.weapons[id]}`, 110);
  }

  // ---- 성장 ----
  levelUp() {
    this.xp -= this.xpNext;
    this.level += 1;
    this.xpNext = xpNeed(this.level);
    this.choices = rollChoices(
      { weapons: this.weapons, passives: this.passives },
      PICK_COUNT,
      this.rnd,
    );
    this.phase = 'levelup';
    this.emit();
  }

  choose(i) {
    const c = this.choices[i];
    if (!c) return;
    if (c.kind === 'weapon') this.grantWeapon(c.id);
    else if (c.kind === 'passive') this.grantPassive(c.id);
    else this.hp = Math.min(this.maxHp, this.hp + 40);
    this.choices = [];
    // 남은 경험치로 곧바로 또 오를 수 있다 — 카드를 이어서 띄운다
    if (this.xp >= this.xpNext) { this.levelUp(); return; }
    this.phase = 'playing';
    this.emit();
  }

  grantWeapon(id) {
    if (!this.weapons[id]) {
      if (Object.keys(this.weapons).length >= MAX_WEAPONS) return;
      this.weapons[id] = 1;
      this.wcd[id] = 12;
    } else {
      this.weapons[id] = Math.min(MAX_LV, this.weapons[id] + 1);
    }
  }

  grantPassive(id) {
    if (!this.passives[id]) {
      if (Object.keys(this.passives).length >= MAX_PASSIVES) return;
      this.passives[id] = 1;
    } else {
      this.passives[id] = Math.min(MAX_LV, this.passives[id] + 1);
    }
    const before = this.mods.hp;
    this.mods = modsOf(this.passives);
    // 최대 체력이 늘면 늘어난 만큼 바로 채워준다
    const gain = this.mods.hp - before;
    this.maxHp = PLAYER.hp + this.mods.hp;
    if (gain > 0) this.hp = Math.min(this.maxHp, this.hp + gain);
  }

  // ---- 조회 ----
  nearestEnemies(x, y, maxD, n) {
    const found = [];
    const max2 = maxD * maxD;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 <= max2) found.push({ e, d2 });
    }
    found.sort((a, b) => a.d2 - b.d2);
    return found.slice(0, n).map((f) => f.e);
  }

  enemiesOnScreen() {
    const out = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - this.px) < W / 2 && Math.abs(e.y - this.py) < H / 2) out.push(e);
    }
    return out;
  }

  // ---- 연출 ----
  spark(x, y, n, color) {
    if (this.parts.length > 300) return;
    for (let i = 0; i < n; i += 1) {
      const a = this.rnd() * TAU;
      const sp = 0.6 + this.rnd() * 1.9;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
        life: 16 + Math.floor(this.rnd() * 14), color,
      });
    }
  }

  tickParts() {
    const keep = [];
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.vx *= 0.94;
      p.life -= 1;
      if (p.life > 0) keep.push(p);
    }
    this.parts = keep;
  }

  banner(text, life) {
    this.bannerText = text;
    this.bannerT = life;
  }

  finish(phase) {
    this.phase = phase;
    this.result = submitScore(this.sec);
    this.emit();
  }
}

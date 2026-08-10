// 무기 — 뱀파이어 서바이벌처럼 **자동으로** 나간다. 조준도 발사도 플레이어가 하지 않는다.
// 무기마다 레벨 1~6의 수치표를 갖고, fire()에서 게임의 배열에 투사체·장판을 밀어 넣는다.
//
// 패시브 보정(mods)은 여기서 한 번에 먹인다.
//   dmg  = 표 값 × mods.might
//   cd   = 표 값 × mods.focus   (짧을수록 자주 나간다)
//   rad  = 표 값 × mods.area

import { MAX_LV } from './config.js';

const TAU = Math.PI * 2;

// 레벨 표는 1레벨부터 6레벨까지 6칸. 빠진 값은 앞 레벨에서 이어받는다.
function table(rows) {
  const out = [];
  let prev = {};
  for (let i = 0; i < MAX_LV; i += 1) {
    prev = { ...prev, ...(rows[i] || {}) };
    out.push(prev);
  }
  return out;
}

export const WEAPONS = {
  bolt: {
    name: '마력 화살',
    icon: 'bolt.0',
    desc: '가장 가까운 적에게 마력 덩어리를 쏜다',
    up: [
      '투사체 2개',
      '재사용 대기 감소 · 피해 증가',
      '투사체 3개',
      '재사용 대기 감소 · 피해 증가',
      '투사체 4개 · 관통',
    ],
    lv: table([
      { count: 1, cd: 52, dmg: 13, pierce: 0, speed: 4.6, r: 5 },
      { count: 2 },
      { cd: 44, dmg: 17 },
      { count: 3 },
      { cd: 38, dmg: 22 },
      { count: 4, cd: 32, dmg: 28, pierce: 1 },
    ]),
    fire(g, s) {
      const targets = g.nearestEnemies(g.px, g.py, 460, s.count);
      for (let i = 0; i < s.count; i += 1) {
        const t = targets[i % Math.max(1, targets.length)];
        // 적이 없으면 바라보는 쪽으로 그냥 쏜다
        const a = t ? Math.atan2(t.y - g.py, t.x - g.px) : (g.faceX >= 0 ? 0 : Math.PI);
        const jitter = targets.length ? 0 : (i - (s.count - 1) / 2) * 0.18;
        g.addProjectile({
          x: g.px, y: g.py - 8, a: a + jitter, speed: s.speed,
          dmg: s.dmg, pierce: s.pierce, r: s.r, clip: 'bolt', life: 150,
        });
      }
    },
  },

  shard: {
    name: '서리 파편',
    icon: 'shard',
    desc: '바라보는 방향으로 파편을 던진다 · 적을 뚫는다',
    up: [
      '파편 2개',
      '재사용 대기 감소 · 피해 증가',
      '파편 3개 · 관통 증가',
      '파편 4개',
      '파편 5개 · 관통 증가',
    ],
    lv: table([
      { count: 1, cd: 52, dmg: 9, pierce: 1, speed: 6.2, r: 5 },
      { count: 2 },
      { cd: 44, dmg: 12 },
      { count: 3, pierce: 2 },
      { count: 4, cd: 38, dmg: 15 },
      { count: 5, cd: 30, dmg: 19, pierce: 3 },
    ]),
    fire(g, s) {
      const a = g.faceX >= 0 ? 0 : Math.PI;
      for (let i = 0; i < s.count; i += 1) {
        // 위아래로 조금씩 벌려 던진다
        const off = (i - (s.count - 1) / 2) * 7;
        g.addProjectile({
          x: g.px, y: g.py - 8 + off, a, speed: s.speed,
          dmg: s.dmg, pierce: s.pierce, r: s.r, clip: null, spr: 'shard',
          flip: g.faceX < 0, life: 90,
        });
      }
    },
  },

  rune: {
    name: '수호 룬',
    icon: 'rune.0',
    desc: '몸 주위를 도는 룬 · 닿은 적에게 피해',
    up: ['룬 2개', '룬 3개', '피해 · 범위 증가', '룬 4개', '룬 5개 · 회전 가속'],
    lv: table([
      { n: 1, dmg: 12, rad: 34, spin: 0.055 },
      { n: 2, dmg: 14, rad: 36 },
      { n: 3, dmg: 17, rad: 38, spin: 0.06 },
      { n: 3, dmg: 21, rad: 42, spin: 0.07 },
      { n: 4, dmg: 25, rad: 44, spin: 0.075 },
      { n: 5, dmg: 30, rad: 46, spin: 0.085 },
    ]),
    // 룬은 발사가 아니라 항상 떠 있다 — game.js가 매 스텝 위치를 갱신한다
    passive: true,
  },

  aura: {
    name: '화염 오라',
    icon: 'flame.0',
    desc: '몸 주위를 태운다 · 적을 밀어낸다',
    up: ['범위 · 피해 증가', '범위 · 피해 증가', '주기 단축', '범위 · 피해 증가', '범위 대폭 증가'],
    lv: table([
      { rad: 30, dmg: 5, cd: 48 },
      { rad: 34, dmg: 7, cd: 46 },
      { rad: 40, dmg: 9, cd: 44 },
      { rad: 46, dmg: 11, cd: 40 },
      { rad: 52, dmg: 14, cd: 36 },
      { rad: 60, dmg: 18, cd: 32 },
    ]),
    fire(g, s) {
      let hit = 0;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.x - g.px;
        const dy = e.y - g.py + 6;
        const rr = s.rad + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        g.damageEnemy(e, s.dmg, { knock: 3.2, kx: dx, ky: dy });
        hit += 1;
      }
      g.auraPulse = 14;
      return hit;
    },
  },

  zap: {
    name: '연쇄 번개',
    icon: 'zap.0',
    desc: '화면 안의 적에게 번개를 떨어뜨린다',
    up: ['번개 2줄기', '번개 3줄기', '번개 4줄기', '번개 5줄기', '번개 7줄기 · 대기 단축'],
    lv: table([
      { n: 1, cd: 170, dmg: 24, splash: 16 },
      { n: 2, cd: 160, dmg: 26 },
      { n: 3, cd: 150, dmg: 30 },
      { n: 4, cd: 140, dmg: 34 },
      { n: 5, cd: 130, dmg: 40, splash: 20 },
      { n: 7, cd: 110, dmg: 48, splash: 22 },
    ]),
    fire(g, s) {
      const pool = g.enemiesOnScreen();
      if (!pool.length) return;
      for (let i = 0; i < s.n; i += 1) {
        const e = pool[Math.floor(g.rnd() * pool.length)];
        g.zaps.push({ x: e.x, y: e.y, t: 0, life: 16, dmg: s.dmg, splash: s.splash, done: false });
      }
    },
  },

  brand: {
    name: '불의 낙인',
    icon: 'flame.1',
    desc: '발밑에 불을 남긴다 · 지나가는 적이 탄다',
    up: ['지속 증가', '낙인 2개', '범위 · 피해 증가', '낙인 3개', '범위 대폭 증가'],
    lv: table([
      { n: 1, cd: 210, rad: 26, dmg: 5, life: 200 },
      { n: 1, life: 230 },
      { n: 2, cd: 195 },
      { n: 2, rad: 32, dmg: 8, cd: 180 },
      { n: 3, cd: 165, dmg: 11 },
      { n: 3, cd: 150, rad: 42, dmg: 14, life: 280 },
    ]),
    fire(g, s) {
      for (let i = 0; i < s.n; i += 1) {
        const a = g.rnd() * TAU;
        const d = i === 0 ? 0 : 22 + g.rnd() * 20;
        g.patches.push({
          x: g.px + Math.cos(a) * d,
          y: g.py + Math.sin(a) * d * 0.6,
          r: s.rad, dmg: s.dmg, life: s.life, t: 0, tick: 0,
        });
      }
    },
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

// 레벨 + 패시브 보정을 먹인 최종 수치
export function statsOf(id, level, mods) {
  const base = WEAPONS[id].lv[Math.min(level, MAX_LV) - 1];
  const s = { ...base };
  if (s.dmg) s.dmg = Math.max(1, Math.round(s.dmg * mods.might));
  if (s.cd) s.cd = Math.max(6, Math.round(s.cd * mods.focus));
  if (s.rad) s.rad = Math.round(s.rad * mods.area);
  if (s.splash) s.splash = Math.round(s.splash * mods.area);
  return s;
}

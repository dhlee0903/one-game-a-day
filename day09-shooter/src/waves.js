// 스테이지 편성: 프레임 타임라인에 편대를 배치한다. 마지막에 보스.
// 각 항목 { t, kind, type, n?, x?, drop? } — t는 스테이지 시작 후 프레임.
// drop을 지정하면 그 편대의 마지막 기체가 아이템을 떨군다.

import { W } from './config.js';

const col = (i, n) => (W * (i + 1)) / (n + 1); // 화면을 n등분한 x

// kind: 편대 모양
//  line   — 가로 한 줄로 동시에 등장
//  stream — 같은 x에서 일정 간격으로 줄줄이
//  vee    — V자 대형
//  sides  — 좌우 가장자리에서 대칭으로

// ---- 1스테이지 · 한낮 태평양 ----
const S1 = [
  { t: 40, kind: 'line', type: 'grunt', n: 4 },
  { t: 150, kind: 'stream', type: 'grunt', n: 5, x: W * 0.25 },
  { t: 190, kind: 'stream', type: 'grunt', n: 5, x: W * 0.75, drop: 'P' },
  { t: 330, kind: 'vee', type: 'zig', n: 5 },
  { t: 470, kind: 'sides', type: 'diver', n: 4 },
  { t: 560, kind: 'line', type: 'gunner', n: 2, drop: 'O' },
  { t: 700, kind: 'stream', type: 'diver', n: 6, x: W * 0.5 },
  { t: 780, kind: 'vee', type: 'grunt', n: 7, drop: 'P' },
  { t: 920, kind: 'sides', type: 'zig', n: 6 },
  { t: 1020, kind: 'line', type: 'gunner', n: 3, drop: 'B' },
  { t: 1160, kind: 'stream', type: 'diver', n: 8, x: W * 0.3 },
  { t: 1200, kind: 'stream', type: 'diver', n: 8, x: W * 0.7 },
  { t: 1340, kind: 'vee', type: 'zig', n: 7, drop: 'P' },
  { t: 1480, kind: 'line', type: 'gunner', n: 4, drop: 'L' },
  { t: 1660, kind: 'boss' },
];

// ---- 2스테이지 · 해질녘 해협 ----
// 지그재그·폭격기 비중이 늘고 편대가 겹쳐 들어온다.
const S2 = [
  { t: 40, kind: 'vee', type: 'grunt', n: 5 },
  { t: 130, kind: 'sides', type: 'zig', n: 4 },
  { t: 250, kind: 'stream', type: 'diver', n: 6, x: W * 0.35, drop: 'P' },
  { t: 290, kind: 'stream', type: 'grunt', n: 6, x: W * 0.72 },
  { t: 430, kind: 'line', type: 'gunner', n: 3, drop: 'O' },
  { t: 560, kind: 'vee', type: 'zig', n: 7 },
  { t: 650, kind: 'sides', type: 'diver', n: 6 },
  { t: 780, kind: 'stream', type: 'gunner', n: 3, x: W * 0.5, drop: 'B' },
  { t: 880, kind: 'line', type: 'grunt', n: 6 },
  { t: 960, kind: 'sides', type: 'zig', n: 8, drop: 'P' },
  { t: 1110, kind: 'stream', type: 'diver', n: 7, x: W * 0.22 },
  { t: 1150, kind: 'stream', type: 'diver', n: 7, x: W * 0.78 },
  { t: 1290, kind: 'line', type: 'gunner', n: 4 },
  { t: 1380, kind: 'vee', type: 'grunt', n: 9, drop: 'P' },
  { t: 1520, kind: 'sides', type: 'zig', n: 8 },
  { t: 1620, kind: 'stream', type: 'gunner', n: 4, x: W * 0.5, drop: 'L' },
  { t: 1760, kind: 'vee', type: 'diver', n: 7 },
  { t: 1880, kind: 'boss' },
];

// ---- 3스테이지 · 야간 강습 ----
// 급강하기와 폭격기가 쉼 없이 겹친다. 마지막 보스가 가장 강하다.
const S3 = [
  { t: 40, kind: 'sides', type: 'zig', n: 6 },
  { t: 140, kind: 'stream', type: 'diver', n: 7, x: W * 0.5 },
  { t: 250, kind: 'line', type: 'gunner', n: 3, drop: 'P' },
  { t: 370, kind: 'vee', type: 'zig', n: 7 },
  { t: 450, kind: 'sides', type: 'diver', n: 8 },
  { t: 590, kind: 'stream', type: 'gunner', n: 3, x: W * 0.28 },
  { t: 630, kind: 'stream', type: 'gunner', n: 3, x: W * 0.72, drop: 'O' },
  { t: 780, kind: 'vee', type: 'grunt', n: 9 },
  { t: 860, kind: 'sides', type: 'zig', n: 8, drop: 'B' },
  { t: 1000, kind: 'stream', type: 'diver', n: 8, x: W * 0.18 },
  { t: 1030, kind: 'stream', type: 'diver', n: 8, x: W * 0.5 },
  { t: 1060, kind: 'stream', type: 'diver', n: 8, x: W * 0.82 },
  { t: 1230, kind: 'line', type: 'gunner', n: 5, drop: 'P' },
  { t: 1360, kind: 'vee', type: 'zig', n: 9 },
  { t: 1470, kind: 'sides', type: 'diver', n: 10 },
  { t: 1620, kind: 'stream', type: 'gunner', n: 4, x: W * 0.4 },
  { t: 1660, kind: 'stream', type: 'gunner', n: 4, x: W * 0.6, drop: 'L' },
  { t: 1820, kind: 'vee', type: 'grunt', n: 11, drop: 'P' },
  { t: 1950, kind: 'sides', type: 'zig', n: 10 },
  { t: 2100, kind: 'boss' },
];

/**
 * 스테이지 정의.
 *  theme    — 배경 테마(backdrop.js)
 *  boss     — 체력·스프라이트·패턴 종류·피격 반지름·공격 주기 배율(작을수록 빠르다)
 *  hpBonus  — 잡몹 체력 가산
 *  bulletMul— 적 탄속 배율
 */
export const STAGES = [
  {
    name: 'PACIFIC', theme: 'day', timeline: S1,
    bossHp: 260, bossSprite: 'boss', bossKind: 'bomber', bossR: 21,
    bossCd: 1, hpBonus: 0, bulletMul: 1,
  },
  {
    name: 'SUNSET STRAIT', theme: 'dusk', timeline: S2,
    bossHp: 380, bossSprite: 'boss2', bossKind: 'bomber', bossR: 21,
    bossCd: 0.86, hpBonus: 1, bulletMul: 1.12,
  },
  {
    name: 'NIGHT RAID', theme: 'night', timeline: S3,
    bossHp: 640, bossSprite: 'airship', bossKind: 'airship', bossR: 30,
    bossCd: 0.74, hpBonus: 1, bulletMul: 1.24,
  },
];

// 편대 하나를 실제 스폰 목록으로 펼친다. 반환: [{ type, x, y, delay, drop, sway }]
export function expand(entry) {
  const { kind, type, n = 1, x = W / 2, drop } = entry;
  const out = [];
  if (kind === 'line') {
    for (let i = 0; i < n; i += 1) {
      out.push({ type, x: col(i, n), y: -30, delay: 0, drop: i === n - 1 ? drop : null });
    }
  } else if (kind === 'stream') {
    for (let i = 0; i < n; i += 1) {
      out.push({ type, x, y: -30, delay: i * 22, drop: i === n - 1 ? drop : null });
    }
  } else if (kind === 'vee') {
    const mid = (n - 1) / 2;
    for (let i = 0; i < n; i += 1) {
      const off = Math.abs(i - mid);
      out.push({ type, x: col(i, n), y: -30 - off * 26, delay: 0, drop: i === Math.round(mid) ? drop : null });
    }
  } else if (kind === 'sides') {
    for (let i = 0; i < n; i += 1) {
      const left = i % 2 === 0;
      out.push({
        type, x: left ? 26 : W - 26, y: -30, delay: Math.floor(i / 2) * 26,
        sway: left ? 1 : -1, drop: i === n - 1 ? drop : null,
      });
    }
  }
  return out;
}

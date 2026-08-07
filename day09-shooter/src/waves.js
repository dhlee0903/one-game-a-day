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
export const STAGE = [
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

// 스테이지 총 길이(보스 등장 시점)
export const BOSS_AT = STAGE[STAGE.length - 1].t;

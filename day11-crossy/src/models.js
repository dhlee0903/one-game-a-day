// 복셀 모델 정의. 모델은 로컬 좌표 박스 배열이고, 기본 방향은 +z(카메라 반대쪽,
// 플레이어가 나아가는 쪽)를 향한다. 그리기는 yaw로 돌려서 쓴다.
// 박스: { x, y, z, w, h, d, c } — y는 모델 바닥에서 잰 높이.

import { PAL } from './config.js';

// 모델이 향하는 방향(yaw). 회전은 x' = x·cos − z·sin, z' = x·sin + z·cos.
export const FACE = { fwd: 0, back: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 };

const WHITE = '#f7f9fc';
const DARK = '#20242c';

// ---- 플레이어 캐릭터 ----

function bird(bodyC, wingC, beakC, combC, combTall) {
  const m = [
    { x: -0.11, y: 0, z: 0.02, w: 0.08, h: 0.14, d: 0.08, c: beakC },
    { x: 0.11, y: 0, z: 0.02, w: 0.08, h: 0.14, d: 0.08, c: beakC },
    { x: 0, y: 0.12, z: 0, w: 0.46, h: 0.30, d: 0.42, c: bodyC },
    { x: 0, y: 0.30, z: -0.24, w: 0.26, h: 0.16, d: 0.10, c: bodyC },
    { x: -0.25, y: 0.16, z: 0, w: 0.06, h: 0.20, d: 0.30, c: wingC },
    { x: 0.25, y: 0.16, z: 0, w: 0.06, h: 0.20, d: 0.30, c: wingC },
    { x: 0, y: 0.40, z: 0.04, w: 0.34, h: 0.26, d: 0.30, c: bodyC },
    { x: 0, y: 0.46, z: 0.20, w: 0.11, h: 0.08, d: 0.12, c: beakC },
    { x: -0.14, y: 0.50, z: 0.15, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0.14, y: 0.50, z: 0.15, w: 0.06, h: 0.06, d: 0.05, c: DARK },
  ];
  if (combC) {
    m.push({ x: 0, y: 0.66, z: 0.02, w: 0.07, h: combTall, d: 0.20, c: combC });
    m.push({ x: 0, y: 0.40, z: 0.17, w: 0.07, h: 0.07, d: 0.07, c: combC });
  }
  return m;
}

// 네 발 짐승(고양이·강아지) — 몸통이 낮고 길다.
function beast(bodyC, bellyC, earC, noseC) {
  return [
    { x: -0.14, y: 0, z: 0.14, w: 0.09, h: 0.13, d: 0.09, c: bodyC },
    { x: 0.14, y: 0, z: 0.14, w: 0.09, h: 0.13, d: 0.09, c: bodyC },
    { x: -0.14, y: 0, z: -0.14, w: 0.09, h: 0.13, d: 0.09, c: bodyC },
    { x: 0.14, y: 0, z: -0.14, w: 0.09, h: 0.13, d: 0.09, c: bodyC },
    { x: 0, y: 0.11, z: -0.02, w: 0.42, h: 0.26, d: 0.52, c: bodyC },
    { x: 0, y: 0.13, z: 0.10, w: 0.30, h: 0.12, d: 0.30, c: bellyC },
    { x: 0, y: 0.24, z: -0.30, w: 0.10, h: 0.28, d: 0.10, c: bodyC },
    { x: 0, y: 0.33, z: 0.16, w: 0.38, h: 0.32, d: 0.34, c: bodyC },
    { x: -0.13, y: 0.63, z: 0.12, w: 0.10, h: 0.13, d: 0.08, c: earC },
    { x: 0.13, y: 0.63, z: 0.12, w: 0.10, h: 0.13, d: 0.08, c: earC },
    { x: -0.10, y: 0.44, z: 0.32, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0.10, y: 0.44, z: 0.32, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0, y: 0.36, z: 0.33, w: 0.09, h: 0.07, d: 0.06, c: noseC },
  ];
}

export const CHARS = [
  { id: 'chicken', name: '닭', cost: 0, model: bird(WHITE, '#e3e8ef', '#f0952e', '#e8453c', 0.10) },
  { id: 'duck', name: '오리', cost: 60, model: bird('#ffd84d', '#f2c53d', '#f0952e', null, 0) },
  { id: 'cat', name: '고양이', cost: 150, model: beast('#8b93a3', '#e6ebf2', '#f0a3b4', '#f0a3b4') },
  { id: 'pug', name: '강아지', cost: 300, model: beast('#c99a63', '#f2e3cc', '#7a5433', '#3a3026') },
];

// ---- 차량 ----

const carCache = new Map();

export function carModel(kind, color) {
  const key = kind + color;
  let m = carCache.get(key);
  if (m) return m;
  if (kind === 'truck') {
    m = [
      { x: 0, y: 0.06, z: -0.55, w: 0.76, h: 0.09, d: 1.70, c: '#4a5a70' },
      { x: 0, y: 0.15, z: -0.55, w: 0.80, h: 0.66, d: 1.62, c: color },
      { x: 0, y: 0.10, z: 0.85, w: 0.74, h: 0.36, d: 0.82, c: '#3f4a5c' },
      { x: 0, y: 0.46, z: 0.90, w: 0.66, h: 0.26, d: 0.62, c: PAL.glass },
      { x: 0, y: 0.72, z: 0.88, w: 0.62, h: 0.08, d: 0.58, c: '#3f4a5c' },
      { x: -0.22, y: 0.16, z: 1.28, w: 0.14, h: 0.10, d: 0.05, c: PAL.lamp },
      { x: 0.22, y: 0.16, z: 1.28, w: 0.14, h: 0.10, d: 0.05, c: PAL.lamp },
      { x: -0.38, y: 0, z: 0.86, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
      { x: 0.38, y: 0, z: 0.86, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
      { x: -0.38, y: 0, z: -0.30, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
      { x: 0.38, y: 0, z: -0.30, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
      { x: -0.38, y: 0, z: -1.05, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
      { x: 0.38, y: 0, z: -1.05, w: 0.10, h: 0.17, d: 0.22, c: PAL.tyre },
    ];
  } else {
    m = [
      { x: 0, y: 0.09, z: 0, w: 0.72, h: 0.27, d: 1.30, c: color },
      { x: 0, y: 0.35, z: -0.05, w: 0.65, h: 0.22, d: 0.66, c: PAL.glass },
      { x: 0, y: 0.55, z: -0.05, w: 0.59, h: 0.08, d: 0.60, c: color },
      { x: -0.20, y: 0.14, z: 0.63, w: 0.13, h: 0.10, d: 0.06, c: PAL.lamp },
      { x: 0.20, y: 0.14, z: 0.63, w: 0.13, h: 0.10, d: 0.06, c: PAL.lamp },
      { x: -0.20, y: 0.14, z: -0.63, w: 0.13, h: 0.10, d: 0.06, c: '#c0392b' },
      { x: 0.20, y: 0.14, z: -0.63, w: 0.13, h: 0.10, d: 0.06, c: '#c0392b' },
      { x: -0.35, y: 0, z: 0.42, w: 0.09, h: 0.16, d: 0.21, c: PAL.tyre },
      { x: 0.35, y: 0, z: 0.42, w: 0.09, h: 0.16, d: 0.21, c: PAL.tyre },
      { x: -0.35, y: 0, z: -0.42, w: 0.09, h: 0.16, d: 0.21, c: PAL.tyre },
      { x: 0.35, y: 0, z: -0.42, w: 0.09, h: 0.16, d: 0.21, c: PAL.tyre },
    ];
  }
  carCache.set(key, m);
  return m;
}

// ---- 나무 ----

const treeCache = new Map();

// tier 1~3: 위로 갈수록 작아지는 잎 덩어리.
export function treeModel(tier) {
  let m = treeCache.get(tier);
  if (m) return m;
  m = [{ x: 0, y: 0, z: 0, w: 0.30, h: 0.34, d: 0.30, c: PAL.trunk }];
  const leaf = [PAL.leafA, PAL.leafB, PAL.leafC];
  let y = 0.28;
  let w = 0.86;
  for (let i = 0; i < tier; i += 1) {
    m.push({ x: 0, y, z: 0, w, h: 0.46, d: w, c: leaf[i % 3] });
    y += 0.40;
    w -= 0.14;
  }
  treeCache.set(tier, m);
  return m;
}

// 바위(사막/풀밭의 또 다른 장애물)
export const ROCK = [
  { x: 0, y: 0, z: 0, w: 0.78, h: 0.34, d: 0.72, c: '#9aa3ad' },
  { x: 0.06, y: 0.30, z: -0.04, w: 0.50, h: 0.28, d: 0.46, c: '#aab3bd' },
];

// ---- 통나무 ----

const logCache = new Map();

export function logModel(len) {
  let m = logCache.get(len);
  if (m) return m;
  m = [
    { x: 0, y: 0, z: 0, w: 0.74, h: 0.26, d: len - 0.06, c: PAL.log },
    { x: 0, y: 0.26, z: 0, w: 0.60, h: 0.05, d: len - 0.20, c: '#9c6a3f' },
    { x: 0, y: 0.02, z: (len - 0.06) / 2, w: 0.66, h: 0.22, d: 0.07, c: PAL.logDark },
    { x: 0, y: 0.02, z: -(len - 0.06) / 2, w: 0.66, h: 0.22, d: 0.07, c: PAL.logDark },
  ];
  logCache.set(len, m);
  return m;
}

// ---- 기차 ----

export const TRAIN_CAR = [
  { x: 0, y: 0.10, z: 0, w: 0.94, h: 0.72, d: 3.30, c: PAL.trainA },
  { x: 0, y: 0.52, z: 0, w: 0.98, h: 0.20, d: 3.10, c: PAL.trainB },
  { x: 0, y: 0.82, z: 0, w: 0.88, h: 0.10, d: 3.16, c: '#9aa3ad' },
  { x: 0, y: 0, z: 0, w: 0.80, h: 0.12, d: 3.34, c: '#33373d' },
];

export const TRAIN_HEAD = [
  { x: 0, y: 0.10, z: -0.20, w: 0.94, h: 0.78, d: 2.90, c: PAL.trainA },
  { x: 0, y: 0.56, z: -0.30, w: 0.98, h: 0.22, d: 2.30, c: PAL.trainB },
  { x: 0, y: 0.30, z: 1.34, w: 0.86, h: 0.34, d: 0.30, c: PAL.glass },
  { x: 0, y: 0.88, z: -0.30, w: 0.86, h: 0.10, d: 2.40, c: '#9aa3ad' },
  { x: 0, y: 0.12, z: 1.44, w: 0.70, h: 0.16, d: 0.12, c: PAL.lamp },
  { x: 0, y: 0, z: 0, w: 0.80, h: 0.12, d: 3.10, c: '#33373d' },
];

// ---- 소품 ----

export const COIN = [
  { x: 0, y: 0, z: 0, w: 0.44, h: 0.44, d: 0.11, c: PAL.coin },
  { x: 0, y: 0.08, z: 0, w: 0.26, h: 0.26, d: 0.13, c: PAL.coinDark },
];

export const SIGNAL = [
  { x: 0, y: 0, z: 0, w: 0.18, h: 0.94, d: 0.18, c: '#5a6472' },
  { x: 0, y: 0.94, z: 0, w: 0.40, h: 0.34, d: 0.24, c: '#2f3640' },
];

export const EAGLE = [
  { x: 0, y: 0, z: 0, w: 0.46, h: 0.40, d: 0.86, c: PAL.eagle },
  { x: 0, y: 0.26, z: 0.44, w: 0.38, h: 0.34, d: 0.34, c: PAL.eagleHead },
  { x: 0, y: 0.30, z: 0.66, w: 0.16, h: 0.14, d: 0.16, c: '#f0b429' },
  { x: -0.11, y: 0.42, z: 0.56, w: 0.07, h: 0.07, d: 0.06, c: DARK },
  { x: 0.11, y: 0.42, z: 0.56, w: 0.07, h: 0.07, d: 0.06, c: DARK },
  { x: 0, y: 0.06, z: -0.54, w: 0.34, h: 0.14, d: 0.34, c: '#6b573f' },
];

// 날개는 퍼덕여야 해서 본체와 따로 그린다.
export const EAGLE_WING = { w: 0.86, h: 0.10, d: 0.52, c: '#5c4a37' };

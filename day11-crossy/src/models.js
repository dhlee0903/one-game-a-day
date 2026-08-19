// 복셀 모델 정의. 모델은 로컬 좌표 박스 배열이고, 기본 방향은 +z(카메라 반대쪽,
// 플레이어가 나아가는 쪽)를 향한다. 그리기는 yaw로 돌려서 쓴다.
// 박스: { x, y, z, w, h, d, c } — y는 모델 바닥에서 잰 높이.

import { PAL } from './config.js';

// 모델이 향하는 방향(yaw). 회전은 x' = x·cos − z·sin, z' = x·sin + z·cos.
export const FACE = { fwd: 0, back: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 };

const WHITE = '#f7f9fc';
const DARK = '#20242c';

// ---- 플레이어 캐릭터 ----
// 네 가지 골격에 색과 소품만 바꿔 30종을 만든다. 모두 대략 한 칸 높이.

// 두 발 새 — 닭·오리·펭귄 계열
function bird(o) {
  const leg = o.leg || o.beak;
  const m = [
    { x: -0.11, y: 0, z: 0.02, w: 0.08, h: 0.14, d: 0.08, c: leg },
    { x: 0.11, y: 0, z: 0.02, w: 0.08, h: 0.14, d: 0.08, c: leg },
    { x: 0, y: 0.12, z: 0, w: 0.46, h: 0.30, d: 0.42, c: o.body },
    { x: -0.25, y: 0.16, z: 0, w: 0.06, h: 0.20, d: 0.30, c: o.wing },
    { x: 0.25, y: 0.16, z: 0, w: 0.06, h: 0.20, d: 0.30, c: o.wing },
    { x: 0, y: 0.40, z: 0.04, w: 0.34, h: 0.26, d: 0.30, c: o.head || o.body },
    { x: 0, y: 0.46, z: 0.20, w: 0.11, h: 0.08, d: 0.12, c: o.beak },
    { x: -0.14, y: 0.50, z: 0.15, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0.14, y: 0.50, z: 0.15, w: 0.06, h: 0.06, d: 0.05, c: DARK },
  ];
  if (o.belly) m.push({ x: 0, y: 0.14, z: 0.19, w: 0.28, h: 0.24, d: 0.06, c: o.belly });
  if (o.tail !== false) m.push({ x: 0, y: 0.30, z: -0.24, w: 0.26, h: 0.16, d: 0.10, c: o.wing });
  if (o.comb) {
    m.push({ x: 0, y: 0.66, z: 0.02, w: 0.07, h: o.combH || 0.10, d: 0.20, c: o.comb });
    m.push({ x: 0, y: 0.40, z: 0.17, w: 0.07, h: 0.07, d: 0.07, c: o.comb });
  }
  if (o.tuft) {
    m.push({ x: -0.12, y: 0.63, z: 0.02, w: 0.08, h: 0.12, d: 0.08, c: o.tuft });
    m.push({ x: 0.12, y: 0.63, z: 0.02, w: 0.08, h: 0.12, d: 0.08, c: o.tuft });
  }
  return m;
}

// 네 발 짐승 — 고양이·곰·토끼 계열
function beast(o) {
  const earH = o.earH || 0.13;
  const m = [
    { x: -0.14, y: 0, z: 0.14, w: 0.09, h: 0.13, d: 0.09, c: o.body },
    { x: 0.14, y: 0, z: 0.14, w: 0.09, h: 0.13, d: 0.09, c: o.body },
    { x: -0.14, y: 0, z: -0.14, w: 0.09, h: 0.13, d: 0.09, c: o.body },
    { x: 0.14, y: 0, z: -0.14, w: 0.09, h: 0.13, d: 0.09, c: o.body },
    { x: 0, y: 0.11, z: -0.02, w: 0.42, h: 0.26, d: 0.52, c: o.body },
    { x: 0, y: 0.13, z: 0.10, w: 0.30, h: 0.12, d: 0.30, c: o.belly },
    { x: 0, y: 0.33, z: 0.16, w: 0.38, h: 0.32, d: 0.34, c: o.head || o.body },
    { x: -0.13, y: 0.63, z: 0.12, w: o.earW || 0.10, h: earH, d: 0.08, c: o.ear },
    { x: 0.13, y: 0.63, z: 0.12, w: o.earW || 0.10, h: earH, d: 0.08, c: o.ear },
    { x: -0.10, y: 0.44, z: 0.32, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0.10, y: 0.44, z: 0.32, w: 0.06, h: 0.06, d: 0.05, c: DARK },
    { x: 0, y: 0.36, z: 0.33, w: 0.09, h: 0.07, d: 0.06, c: o.nose },
  ];
  if (o.tail !== false) m.push({ x: 0, y: 0.24, z: -0.30, w: 0.10, h: 0.28, d: 0.10, c: o.tailC || o.body });
  if (o.mask) {
    m.push({ x: -0.13, y: 0.42, z: 0.335, w: 0.13, h: 0.11, d: 0.02, c: o.mask });
    m.push({ x: 0.13, y: 0.42, z: 0.335, w: 0.13, h: 0.11, d: 0.02, c: o.mask });
  }
  if (o.patch) {
    m.push({ x: -0.16, y: 0.24, z: 0.02, w: 0.14, h: 0.14, d: 0.18, c: o.patch });
    m.push({ x: 0.17, y: 0.20, z: -0.16, w: 0.12, h: 0.12, d: 0.16, c: o.patch });
  }
  if (o.horn) {
    m.push({ x: -0.15, y: 0.65, z: 0.04, w: 0.06, h: 0.18, d: 0.06, c: o.horn });
    m.push({ x: 0.15, y: 0.65, z: 0.04, w: 0.06, h: 0.18, d: 0.06, c: o.horn });
  }
  return m;
}

// 납작하고 통통한 것 — 개구리·거북이·문어
function blob(o) {
  const m = [
    { x: -0.19, y: 0, z: 0.16, w: 0.11, h: 0.10, d: 0.11, c: o.foot || o.body },
    { x: 0.19, y: 0, z: 0.16, w: 0.11, h: 0.10, d: 0.11, c: o.foot || o.body },
    { x: -0.19, y: 0, z: -0.16, w: 0.11, h: 0.10, d: 0.11, c: o.foot || o.body },
    { x: 0.19, y: 0, z: -0.16, w: 0.11, h: 0.10, d: 0.11, c: o.foot || o.body },
    { x: 0, y: 0.08, z: 0, w: 0.54, h: 0.28, d: 0.48, c: o.body },
    { x: 0, y: 0.10, z: 0.16, w: 0.36, h: 0.16, d: 0.20, c: o.belly },
    { x: 0, y: 0.34, z: 0.03, w: 0.46, h: 0.22, d: 0.38, c: o.body },
    { x: -0.15, y: 0.52, z: 0.06, w: 0.15, h: 0.14, d: 0.15, c: '#ffffff' },
    { x: 0.15, y: 0.52, z: 0.06, w: 0.15, h: 0.14, d: 0.15, c: '#ffffff' },
    { x: -0.15, y: 0.56, z: 0.10, w: 0.07, h: 0.07, d: 0.08, c: DARK },
    { x: 0.15, y: 0.56, z: 0.10, w: 0.07, h: 0.07, d: 0.08, c: DARK },
    { x: 0, y: 0.36, z: 0.21, w: 0.24, h: 0.05, d: 0.04, c: o.mouth || DARK },
  ];
  if (o.shell) {
    m.push({ x: 0, y: 0.30, z: -0.10, w: 0.50, h: 0.22, d: 0.40, c: o.shell });
    m.push({ x: 0, y: 0.48, z: -0.10, w: 0.30, h: 0.10, d: 0.24, c: o.shellTop || o.shell });
  }
  return m;
}

// 두 발로 선 상자형 — 로봇·눈사람·유령
function upright(o) {
  const m = [
    { x: -0.12, y: 0, z: 0, w: 0.11, h: 0.12, d: 0.13, c: o.foot || o.body },
    { x: 0.12, y: 0, z: 0, w: 0.11, h: 0.12, d: 0.13, c: o.foot || o.body },
    { x: 0, y: 0.10, z: 0, w: 0.42, h: 0.30, d: 0.34, c: o.body },
    { x: -0.25, y: 0.14, z: 0, w: 0.08, h: 0.22, d: 0.12, c: o.arm || o.body },
    { x: 0.25, y: 0.14, z: 0, w: 0.08, h: 0.22, d: 0.12, c: o.arm || o.body },
    { x: 0, y: 0.40, z: 0.01, w: 0.38, h: 0.32, d: 0.34, c: o.head },
    { x: -0.10, y: 0.52, z: 0.18, w: 0.08, h: 0.08, d: 0.05, c: o.eye || DARK },
    { x: 0.10, y: 0.52, z: 0.18, w: 0.08, h: 0.08, d: 0.05, c: o.eye || DARK },
  ];
  if (o.mouth) m.push({ x: 0, y: 0.44, z: 0.18, w: 0.18, h: 0.05, d: 0.04, c: o.mouth });
  if (o.hat) m.push({ x: 0, y: 0.72, z: 0, w: 0.40, h: 0.10, d: 0.36, c: o.hat });
  if (o.hatTop) m.push({ x: 0, y: 0.82, z: 0, w: 0.26, h: 0.16, d: 0.24, c: o.hatTop });
  if (o.antenna) {
    m.push({ x: 0, y: 0.72, z: 0, w: 0.05, h: 0.14, d: 0.05, c: '#8b93a3' });
    m.push({ x: 0, y: 0.86, z: 0, w: 0.11, h: 0.11, d: 0.11, c: o.antenna });
  }
  if (o.belt) m.push({ x: 0, y: 0.20, z: 0.175, w: 0.34, h: 0.09, d: 0.02, c: o.belt });
  return m;
}

const W = '#f7f9fc';

// 30종. c는 도감 칩에 쓰는 대표색.
export const CHARS = [
  { id: 'chicken', name: '닭', c: W, model: bird({ body: W, wing: '#e3e8ef', beak: '#f0952e', comb: '#e8453c' }) },
  { id: 'duck', name: '오리', c: '#ffd84d', model: bird({ body: '#ffd84d', wing: '#f2c53d', beak: '#f0952e' }) },
  { id: 'chick', name: '병아리', c: '#ffe680', model: bird({ body: '#ffe680', wing: '#ffd84d', beak: '#f0952e', tail: false }) },
  { id: 'penguin', name: '펭귄', c: '#2f3640', model: bird({ body: '#2f3640', wing: '#20242c', beak: '#f0952e', belly: W, head: '#2f3640' }) },
  { id: 'owl', name: '부엉이', c: '#8a6a45', model: bird({ body: '#8a6a45', wing: '#6d5335', beak: '#f0b429', tuft: '#6d5335' }) },
  { id: 'parrot', name: '앵무새', c: '#3fce6a', model: bird({ body: '#3fce6a', wing: '#e8453c', beak: '#f0b429', comb: '#f0b429', combH: 0.14 }) },
  { id: 'crow', name: '까마귀', c: '#3a3f4a', model: bird({ body: '#3a3f4a', wing: '#2a2e36', beak: '#20242c' }) },
  { id: 'flamingo', name: '플라밍고', c: '#ff8fb0', model: bird({ body: '#ff8fb0', wing: '#ff6b95', beak: '#20242c', leg: '#ff6b95' }) },
  { id: 'cat', name: '고양이', c: '#8b93a3', model: beast({ body: '#8b93a3', belly: '#e6ebf2', ear: '#f0a3b4', nose: '#f0a3b4' }) },
  { id: 'dog', name: '강아지', c: '#c99a63', model: beast({ body: '#c99a63', belly: '#f2e3cc', ear: '#7a5433', nose: '#3a3026' }) },
  { id: 'fox', name: '여우', c: '#ff8a3d', model: beast({ body: '#ff8a3d', belly: W, ear: '#20242c', nose: '#20242c', tailC: W }) },
  { id: 'bear', name: '곰', c: '#8a6a45', model: beast({ body: '#8a6a45', belly: '#c9a87c', ear: '#6d5335', nose: '#3a3026', tail: false }) },
  { id: 'panda', name: '판다', c: '#e9edf2', model: beast({ body: '#e9edf2', belly: W, ear: '#20242c', nose: '#20242c', mask: '#20242c', tail: false }) },
  { id: 'pig', name: '돼지', c: '#ff9ec0', model: beast({ body: '#ff9ec0', belly: '#ffc3d8', ear: '#f07aa5', nose: '#f07aa5' }) },
  { id: 'cow', name: '소', c: '#f2f5f9', model: beast({ body: '#f2f5f9', belly: '#e6ebf2', ear: '#c9cfd8', nose: '#f0a3b4', patch: '#2f3640', horn: '#e0d3b8' }) },
  { id: 'rabbit', name: '토끼', c: '#f7f9fc', model: beast({ body: W, belly: '#e6ebf2', ear: '#ffc3d8', nose: '#f0a3b4', earH: 0.30, earW: 0.09 }) },
  { id: 'wolf', name: '늑대', c: '#6f7787', model: beast({ body: '#6f7787', belly: '#c9cfd8', ear: '#4e5563', nose: '#20242c' }) },
  { id: 'raccoon', name: '너구리', c: '#9aa3ad', model: beast({ body: '#9aa3ad', belly: '#d8dee6', ear: '#5a6472', nose: '#20242c', mask: '#3a3f4a' }) },
  { id: 'deer', name: '사슴', c: '#c48a4e', model: beast({ body: '#c48a4e', belly: '#f0d6ac', ear: '#a06f3a', nose: '#3a3026', horn: '#8a6a45' }) },
  { id: 'tiger', name: '호랑이', c: '#ff9a2e', model: beast({ body: '#ff9a2e', belly: '#ffd6a3', ear: '#20242c', nose: '#20242c', patch: '#20242c' }) },
  { id: 'hamster', name: '햄스터', c: '#e8c48a', model: beast({ body: '#e8c48a', belly: '#f7e6c8', ear: '#c99a63', nose: '#f0a3b4', tail: false }) },
  { id: 'sheep', name: '양', c: '#eef2f7', model: beast({ body: '#eef2f7', belly: W, ear: '#c9cfd8', nose: '#3a3026', head: '#3a3f4a', tail: false }) },
  { id: 'frog', name: '개구리', c: '#4cc85a', model: blob({ body: '#4cc85a', belly: '#c8f0b0', foot: '#3aa848' }) },
  { id: 'turtle', name: '거북이', c: '#3aa848', model: blob({ body: '#8fd88a', belly: '#d8f0c8', foot: '#6bbd6b', shell: '#8a6a45', shellTop: '#6d5335' }) },
  { id: 'slime', name: '슬라임', c: '#4fd6e8', model: blob({ body: '#4fd6e8', belly: '#b8f0f7', mouth: '#1b6f7d' }) },
  { id: 'octopus', name: '문어', c: '#b06bff', model: blob({ body: '#b06bff', belly: '#dcc0ff', foot: '#8b47d6' }) },
  { id: 'robot', name: '로봇', c: '#9aa3ad', model: upright({ body: '#6f7787', head: '#9aa3ad', arm: '#4e5563', eye: '#4fd6e8', mouth: '#4e5563', antenna: '#e8453c', belt: '#f0b429' }) },
  { id: 'snowman', name: '눈사람', c: '#f7f9fc', model: upright({ body: W, head: W, arm: '#8a5a34', mouth: '#20242c', hat: '#2f3640', hatTop: '#2f3640' }) },
  { id: 'ghost', name: '유령', c: '#dbe6f0', model: upright({ body: '#dbe6f0', head: '#eef4fa', arm: '#dbe6f0', foot: '#c6d4e2', mouth: '#5a6472' }) },
  { id: 'astronaut', name: '우주인', c: '#eef2f7', model: upright({ body: '#eef2f7', head: '#dbe6f0', arm: '#c9cfd8', foot: '#4e5563', eye: '#2f3640', belt: '#3d7be0', hat: '#3d7be0' }) },
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

// ---- 복셀 글자 (5 x 7) ----
// 게임오버 화면을 블록으로 찍기 위한 글자. 각 줄은 왼쪽이 최상위 비트.
export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const GLYPHS = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};

// 넓은 평야에 흩뿌리는 꽃 — 막지 않는 장식.
export const FLOWER_COLORS = ['#ff6b8a', '#ffd84d', '#ffffff', '#b98cff'];
const flowerCache = new Map();

export function flowerModel(color) {
  let m = flowerCache.get(color);
  if (m) return m;
  m = [
    { x: 0, y: 0, z: 0, w: 0.06, h: 0.13, d: 0.06, c: '#3f8f37' },
    { x: 0, y: 0.13, z: 0, w: 0.17, h: 0.10, d: 0.17, c: color },
  ];
  flowerCache.set(color, m);
  return m;
}

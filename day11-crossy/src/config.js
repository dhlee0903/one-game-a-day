// Day 11 · 길건너 친구들 — 상수 single source of truth.
// 좌표계: x = 좌우(칸), y = 위, z = 앞(플레이어가 나아가는 방향).
// 1 = 한 칸(타일) 크기.

export const VERSION = 'v11.0';

// ---- 캔버스 ----
// 캔버스 크기는 CSS가 정하고(aspect-ratio 400/700) 엔진이 거기에 맞춘다.
// 아래 값은 초점거리를 맞춰 둔 기준 폭 — 화면이 좁으면 비례해서 줄인다.
export const VIEW_W = 400;

// ---- 카메라 ----
// 원작처럼 yaw는 0으로 고정한다. 그래야 차선이 화면과 수평으로 눕고,
// 화면 좌우 끝의 블록만 원근 때문에 옆면이 보인다(원작의 그 느낌).
// focal이 클수록 평평해져서 직교 투영에 가까워진다.
export const CAM = {
  height: 19,     // 지면 위 높이
  back: 20,       // 초점 줄보다 뒤로 물러난 거리
  lookY: 0.7,     // 바라보는 점의 높이
  ahead: 2.6,     // 플레이어보다 조금 앞을 본다
  focal: 850,
  follow: 6.5,    // 초점이 목표를 따라가는 속도(1/s)
};

// ---- 격자 ----
// 걸어 다닐 수 있는 x 범위. 화면에 실제로 보이는 폭보다 넓으면 플레이어가
// 화면 밖으로 걸어 나가 버리므로, 가장 앞줄 기준 가시 범위 안으로 잡는다.
export const HALF_COLS = 6;      // x ∈ [-6, 6] = 13칸
export const EDGE_COLS = 11;     // 지면을 그리는 범위(화면 밖까지 채운다)
export const ROWS_BEHIND = 8;    // 초점 뒤로 유지하는 줄 수
export const ROWS_AHEAD = 26;    // 미리 만들어 두는 줄 수

// ---- 지면 두께 ----
export const GRASS_TOP = 0.34;   // 풀밭은 도로보다 한 단 높다
export const ROAD_TOP = 0;
export const WATER_TOP = 0.10;   // 수면은 풀밭보다 낮게
export const SLAB_BOTTOM = -1.6; // 지면 슬래브 아랫면

// ---- 플레이어 ----
export const HOP_TIME = 0.135;   // 한 칸 뛰는 데 걸리는 시간(초)
export const HOP_HEIGHT = 0.62;
export const BUMP_TIME = 0.11;   // 나무에 막혔을 때 부딪히는 모션
export const TURN_SPEED = 16;    // 바라보는 방향이 도는 속도(rad/s)

// ---- 독수리(가만히 있으면 잡아간다) ----
export const IDLE_LIMIT = 4.5;   // 앞으로 안 나아간 채 버틸 수 있는 시간
export const IDLE_WARN = 3.0;    // 경고가 뜨기 시작하는 시점
export const EAGLE_TIME = 1.15;  // 급강하 연출 길이

// ---- 카메라 강제 전진 ----
export const SCROLL_BASE = 0.55;  // 줄/초
export const SCROLL_GAIN = 0.0016; // 점수 1당 추가 속도

// ---- 난이도 ----
// 점수가 오를수록 차가 빨라지고 간격이 좁아진다.
export function difficulty(score) {
  return Math.min(1, score / 260);
}

// ---- 차선 종류 ----
export const LANE = { GRASS: 'grass', ROAD: 'road', RIVER: 'river', RAIL: 'rail' };

// 차 종류: len은 x축 길이(칸), 색은 차체 색.
export const CARS = [
  { kind: 'car', len: 1.34, colors: ['#e8453c', '#3d7be0', '#f0b429', '#48b56a', '#b06bff', '#f2f4f8', '#ff7a3d'] },
  { kind: 'truck', len: 2.60, colors: ['#e6ebf2', '#f0b429', '#4a5a70'] },
];

// ---- 팔레트 ----
export const PAL = {
  // sky0은 안개(먼 줄이 사라지는 색)와 같아야 경계가 안 보인다 → rgb(191,231,251)
  sky0: '#bfe7fb',
  sky1: '#eefaff',
  grassA: '#5fbf4f',
  grassB: '#54b246',
  grassSide: '#3f8f37',
  road: '#4a4f57',
  roadDark: '#3f444b',
  roadSide: '#33373d',
  mark: '#e9edf2',
  waterA: '#3aa0e8',
  waterB: '#3494db',
  waterSide: '#2b7ab5',
  railBed: '#6b6157',
  railBedSide: '#514940',
  sleeper: '#4e433a',
  rail: '#b9c2cc',
  trunk: '#8a5a34',
  leafA: '#2f8f46',
  leafB: '#38a352',
  leafC: '#256f38',
  log: '#8a5a34',
  logDark: '#6d4526',
  coin: '#ffcc33',
  coinDark: '#e0a81f',
  eagle: '#4a3b2e',
  eagleHead: '#f2f4f8',
  glass: '#33455c',
  tyre: '#23262c',
  lamp: '#fff3c4',
  trainA: '#c8443c',
  trainB: '#e6ebf2',
};

// 면 밝기: 위 > 앞 > 왼쪽 > 오른쪽 (빛이 왼쪽 위 앞에서 온다)
export const SHADE = { top: 1, near: 0.84, left: 0.74, right: 0.6, far: 0.52 };

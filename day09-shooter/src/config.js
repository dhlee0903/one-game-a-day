// 종스크롤 슈팅 상수 — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v9.1';

// 논리 해상도(캔버스는 CSS로 확대된다). 세로형 9:16에 가깝게.
export const W = 360;
export const H = 620;

export const HUD_H = 44;          // 상단 HUD 영역(플레이 영역은 그 아래부터)
export const PLAY_TOP = 0;        // 적은 화면 위 밖에서 들어온다

// ---- 플레이어 ----
export const PLAYER = {
  r: 8,               // 피격 판정 반지름(그림보다 작게 — 슈팅 관례)
  speed: 4.4,         // 키보드 이동 속도
  fireEvery: 7,       // 자동 발사 간격(프레임)
  respawnInvul: 110,  // 피격 후 무적 프레임
  startY: H - 110,
};

export const START_LIVES = 3;
export const START_BOMBS = 2;
export const MAX_BOMBS = 5;
export const MAX_POWER = 4;       // 무기 강화 1~4
export const MAX_OPTIONS = 2;     // 보조기 최대 2기

// ---- 탄 ----
export const P_BULLET = { r: 4, speed: 9, dmg: 1 };
export const E_BULLET = { r: 4, speed: 2.6 };

// ---- 폭탄 ----
export const BOMB = { dmg: 40, flash: 34, invul: 70 };

// ---- 점수 ----
export const SCORE = {
  grunt: 100, zig: 150, diver: 200, gunner: 300,
  boss: 5000, pickup: 50, bombLeft: 300, lifeLeft: 500,
};

export const KEY_BEST = 'og-hs-day09'; // 홈 카드와 공유(높을수록 좋음)

// ---- 적 종류 ----
// hp / 속도 / 사격 주기(0=안 쏨) / 점수
export const ENEMY = {
  grunt:  { hp: 1, speed: 1.9, fire: 0,   score: SCORE.grunt,  r: 11 },
  zig:    { hp: 2, speed: 1.5, fire: 105, score: SCORE.zig,    r: 12 },
  diver:  { hp: 2, speed: 3.4, fire: 0,   score: SCORE.diver,  r: 11 },
  gunner: { hp: 5, speed: 1.0, fire: 70,  score: SCORE.gunner, r: 15 },
};

// ---- 보스 ----
export const BOSS = {
  hp: 260, r: 40, enterY: 110, score: SCORE.boss,
  phase2: 0.55,   // 이 비율 이하로 떨어지면 2페이즈
  phase3: 0.25,
};

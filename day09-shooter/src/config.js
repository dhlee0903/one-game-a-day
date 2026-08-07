// 종스크롤 슈팅 상수 — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v9.7';

// 게임 로직은 초당 60회로 고정한다. 모니터 주사율(60/120/144Hz)이 달라도
// 같은 속도로 진행되게 하는 기준값 — 아래 상수는 모두 "1스텝당" 값이다.
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP = 5;     // 한 프레임에 몰아서 돌릴 최대 스텝 수

// 논리 해상도(캔버스는 CSS로 확대된다). 세로형 9:16에 가깝게.
export const W = 360;
export const H = 620;

export const HUD_H = 44;          // 상단 HUD 영역(플레이 영역은 그 아래부터)
export const PLAY_TOP = 0;        // 적은 화면 위 밖에서 들어온다

// ---- 플레이어 ----
export const PLAYER = {
  r: 5,               // 피격 판정 반지름(그림보다 훨씬 작게 — 슈팅 관례)
  // 한 스텝(1/60초)당 최대 이동 거리. 키보드와 드래그가 **같은 상한**을 쓴다.
  // 드래그를 손가락에 1:1로 붙이면 플릭 한 번에 순간이동해 키보드와 체감이 갈렸다.
  speed: 6,
  dragMax: 90,        // 드래그로 쌓아둘 수 있는 이동 요청 상한(플릭 억제)
  bankAt: 1.6,        // 이만큼 좌우로 움직이면 기울어진 스프라이트로 바뀐다
  fireEvery: 7,       // 자동 발사 간격(프레임)
  deadPause: 42,      // 격추 후 기체가 사라져 있는 시간
  respawnLock: 36,    // 아래에서 복귀 진입하는 동안 — 조작 불가
  respawnInvul: 120,  // 복귀 후 무적(깜빡임) 프레임
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
  boss: [5000, 8000, 12000],   // 스테이지별 보스 격파 점수
  stageClear: 2000,            // 스테이지 하나를 넘길 때마다
  pickup: 50, bombLeft: 300, lifeLeft: 500,
};

export const KEY_BEST = 'og-hs-day09'; // 홈 카드와 공유(높을수록 좋음)

// ---- 적 종류 ----
// hp / 속도 / 사격 주기(0=안 쏨) / 점수
export const ENEMY = {
  grunt:  { hp: 1, speed: 1.9, fire: 0,   score: SCORE.grunt,  r: 8 },
  zig:    { hp: 2, speed: 1.5, fire: 105, score: SCORE.zig,    r: 9 },
  diver:  { hp: 2, speed: 3.4, fire: 0,   score: SCORE.diver,  r: 7 },
  gunner: { hp: 5, speed: 1.0, fire: 70,  score: SCORE.gunner, r: 13 },
};

// ---- 보스 ----
// 체력·스프라이트·공격 주기는 스테이지마다 다르다(waves.js STAGES)
export const BOSS = {
  r: 21, enterY: 110,
  phase2: 0.55,   // 이 비율 이하로 떨어지면 2페이즈
  phase3: 0.25,
};

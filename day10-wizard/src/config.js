// 마법사 서바이벌 상수 — single source of truth.

export const VERSION = 'v10.0';

// 로직은 초당 60회 고정. 아래 값은 모두 "1스텝(1/60초)당" 기준이다.
export const STEP_MS = 1000 / 60;
export const MAX_CATCHUP = 5;

// 논리 해상도(캔버스는 CSS로 확대된다). 세로형.
export const W = 320;
export const H = 560;

export const HUD_H = 34;

// 한 판 길이. 이 시간을 버티면 ALL CLEAR.
export const RUN_SEC = 900;           // 15분

// ---- 플레이어 ----
export const PLAYER = {
  hp: 100,
  r: 6,                 // 피격 반지름(그림보다 작게)
  speed: 1.5,           // 스텝당 이동 거리
  pickR: 40,            // 경험치 흡수 반지름
  hurtCd: 40,           // 피격 후 무적 프레임
  faceKeep: 24,         // 멈춰도 이 프레임 동안 마지막 방향을 유지(파편 던지는 방향)
};

// ---- 성장 ----
// 레벨 n → n+1 에 필요한 경험치.
// 초반은 성큼성큼 오르고(무기를 빨리 갖추게) 뒤로 갈수록 완만히 무거워진다.
export function xpNeed(level) {
  return 6 + (level - 1) * 5 + Math.floor((level - 1) ** 2 * 0.35);
}

export const MAX_WEAPONS = 5;
export const MAX_PASSIVES = 5;
export const MAX_LV = 6;              // 무기·패시브 공통 최대 레벨
export const PICK_COUNT = 3;          // 레벨업 때 고르는 카드 수

// 경험치 보석 등급 — 적 종류가 어떤 등급을 떨구는지는 ENEMY.gem.
// 보석은 실제 경험치 값을 들고 다니고, 등급은 그 값으로 정해진다(합쳐질 수 있으므로).
export const GEM = [
  { xp: 1, spr: 'gem.blue' },
  { xp: 5, spr: 'gem.green' },
  { xp: 16, spr: 'gem.red' },
];

export function gemTier(xp) { return xp >= GEM[2].xp ? 2 : (xp >= GEM[1].xp ? 1 : 0); }

export const GEM_DRIFT = 220;   // 이 거리 안의 보석은 천천히 끌려온다
export const GEM_CAP = 150;     // 넘치면 먼 것부터 합친다(값은 보존)

// ---- 적 ----
// hp / 속도 / 접촉 피해 / 반지름 / 경험치 등급 / 스프라이트 클립
export const ENEMY = {
  bat:      { hp: 6,   speed: 1.22, dmg: 5,  r: 6,  gem: 0, knock: 1.0,  clip: 'bat' },
  slime:    { hp: 14,  speed: 0.86, dmg: 6,  r: 7,  gem: 0, knock: 0.8,  clip: 'slime' },
  skeleton: { hp: 20,  speed: 1.02, dmg: 8,  r: 7,  gem: 1, knock: 0.7,  clip: 'skeleton' },
  ghost:    { hp: 28,  speed: 1.16, dmg: 10, r: 7,  gem: 1, knock: 0.5,  clip: 'ghost' },
  golem:    { hp: 170, speed: 0.62, dmg: 16, r: 12, gem: 2, knock: 0.15, clip: 'golem', elite: true },
  lich:     { hp: 820, speed: 0.58, dmg: 20, r: 15, gem: 2, knock: 0,    clip: 'lich',  boss: true },
};

// 시간이 갈수록 강해진다 — 분 단위로 곱해지는 배율.
// 무기 강화가 6단계에서 멈추므로 체력 배율을 너무 세게 주면 후반이 벽이 된다.
export const SCALE = {
  hp: (min) => 1 + min * 0.40,
  speed: (min) => 1 + min * 0.020,
  dmg: (min) => 1 + min * 0.09,
};

export const MAX_ENEMIES = 165;       // 이 수를 넘으면 새로 소환하지 않는다(사건 소환은 예외)

// ---- 낙하물 ----
export const DROP = {
  heartChance: 0.012,   // 일반 적 처치 시
  magnetChance: 0.005,
  chestFromElite: true,
  life: 60 * 25,        // 보석 외 낙하물이 사라지기까지
};

export const HEART_HEAL = 30;

// ---- 점수(기록) ----
// 홈 카드는 "생존 시간(초)"을 최고 기록으로 쓴다.
export const KEY_BEST = 'og-hs-day10';

// ---- 연출 ----
export const FX = {
  hitFlash: 6,          // 피격 시 흰색으로 타는 프레임
  shakeHurt: 5,
  shakeBoss: 8,
};

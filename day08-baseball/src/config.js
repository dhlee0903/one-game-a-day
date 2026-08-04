// 숫자야구 상수 — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v8.1';

// 숫자 풀: 0-9, 중복 없음. 맨 앞자리 0도 허용한다.
export const POOL = '0123456789';

// 난이도(자리수) → 시도 제한. 자리수가 늘면 후보가 급증하므로 시도도 늘린다.
export const LEVELS = {
  3: { digits: 3, tries: 10 },
  4: { digits: 4, tries: 12 },
};
export const DIGIT_OPTIONS = [3, 4];
export const DEFAULT_DIGITS = 3;

// 힌트: 자리 하나의 숫자를 공개. 쓰면 그 판은 기록에 남지 않는다.
export const HINTS_PER_GAME = 1;

// localStorage 키
export const KEY_BEST = 'day08-baseball-best';   // { "3": 최소시도, "4": 최소시도 }
export const KEY_STATS = 'day08-baseball-stats'; // { plays, wins }
export const KEY_HOME = 'og-hs-day08';           // 홈 카드용(최소 시도 회수)

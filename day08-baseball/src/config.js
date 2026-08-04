// 숫자야구 상수 — single source of truth.

// Bump this on every gameplay/patch change so the live build is identifiable.
export const VERSION = 'v8.3';

// 숫자 풀: 0-9. 맨 앞자리 0도 허용한다.
export const POOL = '0123456789';

// 4자리 고정. 정답은 서로 다른 숫자로 이루어지지만,
// 추측은 같은 숫자를 여러 번 넣을 수 있다(전략적 탐색용: 0011 같은 수로 후보를 좁힌다).
export const DIGITS = 4;
export const MAX_TRIES = 12;

// 힌트: 자리 하나의 숫자를 공개. 쓰면 그 판은 기록에 남지 않는다.
export const HINTS_PER_GAME = 1;

// localStorage 키
export const KEY_BEST = 'day08-baseball-best';   // { "4": 최소시도 }
export const KEY_STATS = 'day08-baseball-stats'; // { plays, wins }
export const KEY_HOME = 'og-hs-day08';           // 홈 카드용(최소 시도 회수)

// 기록 저장(localStorage). 최소 시도 횟수와 플레이/승 통계. 실패해도 조용히 넘어간다.

import { KEY_BEST, KEY_STATS, KEY_HOME } from './config.js';

export function getBests() {
  try { return JSON.parse(localStorage.getItem(KEY_BEST)) || {}; } catch { return {}; }
}

export function getBest(digits) {
  return Number(getBests()[digits]) || 0; // 0 = 기록 없음
}

export function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_STATS)) || {};
    return { plays: raw.plays || 0, wins: raw.wins || 0 };
  } catch { return { plays: 0, wins: 0 }; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// 판이 끝나면 통계에 반영. 승리 시(힌트를 안 썼다면) 최소 시도 기록을 갱신한다.
// 반환: { best, isNewBest }
export function recordGame({ digits, won, tries, usedHint }) {
  const stats = getStats();
  stats.plays += 1;
  if (won) stats.wins += 1;
  save(KEY_STATS, stats);

  const bests = getBests();
  const prev = Number(bests[digits]) || 0;
  let isNewBest = false;
  if (won && !usedHint && (prev === 0 || tries < prev)) {
    bests[digits] = tries;
    save(KEY_BEST, bests);
    isNewBest = true;
    // 홈 카드에는 난이도 통합 최소 시도를 노출한다(적을수록 좋음).
    try {
      const home = Number(localStorage.getItem(KEY_HOME)) || 0;
      if (home === 0 || tries < home) localStorage.setItem(KEY_HOME, String(tries));
    } catch { /* ignore */ }
  }
  return { best: Number(bests[digits]) || 0, isNewBest };
}

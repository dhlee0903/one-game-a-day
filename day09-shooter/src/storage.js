// 최고 점수 저장(localStorage). 홈 카드와 같은 키를 쓴다. 실패해도 조용히 넘어간다.

import { KEY_BEST } from './config.js';

export function getBest() {
  try { return Number(localStorage.getItem(KEY_BEST)) || 0; } catch { return 0; }
}

// 기록을 넘으면 저장. 반환 { best, isNewBest }
export function submitScore(score) {
  const best = getBest();
  if (score > best) {
    try { localStorage.setItem(KEY_BEST, String(score)); } catch { /* ignore */ }
    return { best: score, isNewBest: true };
  }
  return { best, isNewBest: false };
}

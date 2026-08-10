// 최고 기록(생존 시간, 초) 저장. 홈 카드와 같은 키를 쓴다. 실패해도 조용히 넘어간다.

import { KEY_BEST } from './config.js';

export function getBest() {
  try { return Number(localStorage.getItem(KEY_BEST)) || 0; } catch { return 0; }
}

// 기록을 넘으면 저장. 반환 { best, isNewBest }
export function submitScore(sec) {
  const best = getBest();
  if (sec > best) {
    try { localStorage.setItem(KEY_BEST, String(sec)); } catch { /* ignore */ }
    return { best: sec, isNewBest: true };
  }
  return { best, isNewBest: false };
}

export function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

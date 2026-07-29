// Best score persistence via localStorage. Fails soft.

const KEY = 'snake-best';

export function getBest() {
  try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; }
}

// Store `score` if it beats the record. Returns { best, isNewBest }.
export function submitScore(score) {
  const best = getBest();
  if (score > best) {
    try { localStorage.setItem(KEY, String(score)); } catch { /* ignore */ }
    return { best: score, isNewBest: true };
  }
  return { best, isNewBest: false };
}

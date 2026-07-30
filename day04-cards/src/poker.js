// Poker hand evaluation — the reusable core for Hold'em.
// A hand is scored as a comparable array [category, ...tiebreakers]; higher is
// better and arrays compare lexicographically. Aces are high (14), with the
// A-2-3-4-5 wheel handled as a 5-high straight.

const NAMES = [
  '하이카드', '원페어', '투페어', '트리플', '스트레이트',
  '플러시', '풀하우스', '포카드', '스트레이트 플러시',
];

export function rankVal(rank) {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return Number(rank);
}

// Score exactly five cards.
export function evaluate5(cards) {
  const vals = cards.map((c) => rankVal(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);

  const uniq = [...new Set(vals)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // wheel
  }

  const count = {};
  vals.forEach((v) => { count[v] = (count[v] || 0) + 1; });
  // groups of [count, value], most-frequent then highest-value first
  const groups = Object.entries(count)
    .map(([v, c]) => [c, Number(v)])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const c = groups.map((g) => g[0]);
  const g = groups.map((x) => x[1]);

  if (straightHigh && flush) return [8, straightHigh];
  if (c[0] === 4) return [7, g[0], g[1]];
  if (c[0] === 3 && c[1] >= 2) return [6, g[0], g[1]];
  if (flush) return [5, ...vals];
  if (straightHigh) return [4, straightHigh];
  if (c[0] === 3) return [3, g[0], g[1], g[2]];
  if (c[0] === 2 && c[1] === 2) return [2, g[0], g[1], g[2]];
  if (c[0] === 2) return [1, g[0], g[1], g[2], g[3]];
  return [0, ...vals];
}

// Compare two score arrays: >0 if a beats b.
export function compareScore(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Best 5-card score out of up to 7 cards.
export function bestHand(cards) {
  const n = cards.length;
  let best = null;
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let d = b + 1; d < n; d += 1) {
        for (let e = d + 1; e < n; e += 1) {
          for (let f = e + 1; f < n; f += 1) {
            const s = evaluate5([cards[a], cards[b], cards[d], cards[e], cards[f]]);
            if (!best || compareScore(s, best) > 0) best = s;
          }
        }
      }
    }
  }
  return best;
}

export function handName(score) {
  return NAMES[score[0]];
}

const RN = (v) => (v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v));

// Human-readable detail so ties within a category are understandable
// (which pair, which kicker, etc.).
export function handDetail(score) {
  switch (score[0]) {
    case 8: return score[1] === 14 ? '로열 플러시' : `스트레이트 플러시 ${RN(score[1])}`;
    case 7: return `포카드 ${RN(score[1])}`;
    case 6: return `풀하우스 ${RN(score[1])}·${RN(score[2])}`;
    case 5: return `플러시 ${RN(score[1])} 하이`;
    case 4: return `스트레이트 ${RN(score[1])} 하이`;
    case 3: return `트리플 ${RN(score[1])}`;
    case 2: return `투페어 ${RN(score[1])}·${RN(score[2])} (키커 ${RN(score[3])})`;
    case 1: return `원페어 ${RN(score[1])} (키커 ${RN(score[2])})`;
    default: return `하이카드 ${RN(score[1])}`;
  }
}

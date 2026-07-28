// Exact expected-value bot (see BOT_STRATEGY.md).
//
// Holds are chosen by exact single-turn dynamic programming rather than Monte
// Carlo, so decisions are deterministic and correctly value straights, pairs,
// and other "completes by probability" hands. Placement uses a par-relative
// value shared with the hold search, so the bot holds toward what it will
// actually score well.

import {
  DICE_COUNT, DIE_FACES, UPPER_IDS, UPPER_BONUS_THRESHOLD, CATEGORY_IDS,
} from './config.js';
import { scoreFor, upperSum } from './scoring.js';

// ----- category valuation -----

// Rough expected value ("par") of each category under decent play.
const PAR = {
  aces: 2, twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12,
  choice: 23, fourKind: 8, fullHouse: 13, smallStraight: 11, largeStraight: 9, yacht: 5,
};

const upperGap = (scores) => Math.max(0, UPPER_BONUS_THRESHOLD - upperSum(scores));

// Value of placing `dice` into category `id`: points beyond that category's
// par, with an upper-bonus push while 63 is still reachable.
function desirability(id, dice, scores) {
  const s = scoreFor(id, dice);
  let val = s - PAR[id];
  if (UPPER_IDS.includes(id)) {
    if (upperGap(scores) > 0) val += s * 0.25;
    const up = upperSum(scores);
    if (up < UPPER_BONUS_THRESHOLD && up + s >= UPPER_BONUS_THRESHOLD) val += 20;
  }
  return val;
}

// Best category to place these dice, by desirability.
function bestPlacement(dice, scores, openIds) {
  let best = -Infinity;
  for (const id of openIds) {
    const v = desirability(id, dice, scores);
    if (v > best) best = v;
  }
  return best;
}

export function chooseCategory(dice, scores) {
  const open = CATEGORY_IDS.filter((id) => scores[id] == null);
  let best = open[0];
  let bestVal = -Infinity;
  for (const id of open) {
    const v = desirability(id, dice, scores);
    if (v > bestVal) { bestVal = v; best = id; }
  }
  return best;
}

// ----- exact reroll distributions -----

// For j rerolled dice, all outcome multisets with their probabilities.
// Precomputed once (static — independent of game state).
function buildRerollDist() {
  const dist = [];
  for (let j = 0; j <= DICE_COUNT; j += 1) {
    const outcomes = [];
    const denom = DIE_FACES ** j;
    // enumerate non-decreasing faces (multisets) and count permutations
    const rec = (start, left, faces) => {
      if (left === 0) {
        // multinomial count of this multiset
        const counts = {};
        faces.forEach((f) => { counts[f] = (counts[f] || 0) + 1; });
        let perms = fact(j);
        Object.values(counts).forEach((c) => { perms /= fact(c); });
        outcomes.push({ faces: faces.slice(), p: perms / denom });
        return;
      }
      for (let f = start; f <= DIE_FACES; f += 1) { faces.push(f); rec(f, left - 1, faces); faces.pop(); }
    };
    rec(1, j, []);
    dist.push(outcomes);
  }
  return dist;
}
const FACT = [1, 1, 2, 6, 24, 120];
const fact = (n) => FACT[n];
const REROLL = buildRerollDist();

// ----- exact single-turn value DP -----

const keyOf = (sorted) => sorted.join('');

// Memo is valid only while the open categories / upper total are unchanged.
let memoSig = null;
let memo = null;

function ensureMemo(scores) {
  const sig = CATEGORY_IDS.map((id) => (scores[id] == null ? '.' : 'x')).join('')
    + '|' + upperSum(scores);
  if (sig !== memoSig) { memoSig = sig; memo = new Map(); }
}

// Expected best placement value achievable from `sorted` dice with r rerolls
// left. Every state (including r=0, i.e. bestPlacement) is memoized, which is
// what makes the exact DP fast enough — only ~252 dice states exist.
function value(sorted, r, scores, openIds) {
  const k = keyOf(sorted) + '|' + r;
  const cached = memo.get(k);
  if (cached !== undefined) return cached;

  let res;
  if (r === 0) {
    res = bestPlacement(sorted, scores, openIds);
  } else {
    let best = -Infinity;
    const seen = new Set();
    for (let mask = 0; mask < (1 << DICE_COUNT); mask += 1) {
      const kept = [];
      for (let i = 0; i < DICE_COUNT; i += 1) if (mask & (1 << i)) kept.push(sorted[i]);
      const kk = kept.join('');
      if (seen.has(kk)) continue;
      seen.add(kk);

      const j = DICE_COUNT - kept.length;
      let ev = 0;
      for (const out of REROLL[j]) {
        const next = kept.concat(out.faces).sort((a, b) => a - b);
        ev += out.p * value(next, r - 1, scores, openIds);
      }
      if (ev > best) best = ev;
    }
    res = best;
  }
  memo.set(k, res);
  return res;
}

// ----- public hold API -----

// Best keep-mask over the ACTUAL (unsorted) dice for the given rolls left.
export function chooseHolds(dice, scores, rollsLeft = 1) {
  ensureMemo(scores);
  const openIds = CATEGORY_IDS.filter((id) => scores[id] == null);
  let bestMask = (1 << DICE_COUNT) - 1;
  let bestEV = -Infinity;
  for (let mask = 0; mask < (1 << DICE_COUNT); mask += 1) {
    const kept = [];
    for (let i = 0; i < DICE_COUNT; i += 1) if (mask & (1 << i)) kept.push(dice[i]);
    const j = DICE_COUNT - kept.length;
    let ev = 0;
    for (const out of REROLL[j]) {
      const next = kept.concat(out.faces).sort((a, b) => a - b);
      ev += out.p * value(next, rollsLeft - 1, scores, openIds);
    }
    if (ev > bestEV) { bestEV = ev; bestMask = mask; }
  }
  return Array.from({ length: DICE_COUNT }, (_, i) => Boolean(bestMask & (1 << i)));
}

export function wantsReroll(dice, scores, rollsLeft) {
  if (rollsLeft <= 0) return false;
  // Reroll unless the optimal play is to keep everything.
  return chooseHolds(dice, scores, rollsLeft).some((k) => !k);
}

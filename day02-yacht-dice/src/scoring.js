// Pure scoring functions. Given a set of five dice, compute the score for any
// category. No state, no DOM — trivially testable and reused by the bot.

import {
  DIE_FACES, UPPER_IDS, UPPER_BONUS_THRESHOLD, UPPER_BONUS,
  FIXED_SMALL_STRAIGHT, FIXED_LARGE_STRAIGHT, FIXED_YACHT, CATEGORY_IDS,
} from './config.js';

// Tally how many of each face value appear. Index 1..6 (index 0 unused).
export function counts(dice) {
  const c = Array(DIE_FACES + 1).fill(0);
  dice.forEach((v) => { c[v] += 1; });
  return c;
}

export function sum(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

// Is there a run of `len` consecutive face values present?
function hasStraight(c, len) {
  let run = 0;
  for (let i = 1; i <= DIE_FACES; i += 1) {
    if (c[i] > 0) {
      run += 1;
      if (run >= len) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

// Score `dice` as if placed in `categoryId`. Returns 0 when the dice don't
// satisfy the category's pattern.
export function scoreFor(categoryId, dice) {
  const c = counts(dice);
  const total = sum(dice);
  switch (categoryId) {
    case 'aces': return c[1] * 1;
    case 'twos': return c[2] * 2;
    case 'threes': return c[3] * 3;
    case 'fours': return c[4] * 4;
    case 'fives': return c[5] * 5;
    case 'sixes': return c[6] * 6;
    case 'choice': return total;
    case 'fourKind': return c.some((n) => n >= 4) ? total : 0;
    case 'fullHouse': {
      const hasThree = c.some((n) => n === 3);
      const hasPair = c.some((n) => n === 2);
      return hasThree && hasPair ? total : 0;
    }
    case 'smallStraight': return hasStraight(c, 4) ? FIXED_SMALL_STRAIGHT : 0;
    case 'largeStraight': return hasStraight(c, 5) ? FIXED_LARGE_STRAIGHT : 0;
    case 'yacht': return c.some((n) => n === 5) ? FIXED_YACHT : 0;
    default: return 0;
  }
}

// ----- scorecard aggregates (scores: { categoryId: number | null }) -----

export function upperSum(scores) {
  return UPPER_IDS.reduce((a, id) => a + (scores[id] || 0), 0);
}

export function upperBonus(scores) {
  return upperSum(scores) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
}

export function grandTotal(scores) {
  const filled = CATEGORY_IDS.reduce((a, id) => a + (scores[id] || 0), 0);
  return filled + upperBonus(scores);
}

export function isCardFull(scores) {
  return CATEGORY_IDS.every((id) => scores[id] != null);
}

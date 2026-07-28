// A simple, beatable greedy bot. It keeps the most promising dice between
// rolls and, at the end of its turn, scores the highest-value open category.
// Pure decision helpers — the driver in main.js paces the actual moves so the
// human can watch the bot play.

import { DICE_COUNT, DIE_FACES, CATEGORY_IDS } from './config.js';
import { counts, scoreFor } from './scoring.js';

// Values making up the longest run of consecutive faces (e.g. [2,3,4,5]).
function longestRun(c) {
  let best = [];
  let run = [];
  for (let i = 1; i <= DIE_FACES; i += 1) {
    if (c[i] > 0) {
      run.push(i);
      if (run.length > best.length) best = run.slice();
    } else {
      run = [];
    }
  }
  return best;
}

// Which dice to keep before a reroll (true = keep). Chases a straight when one
// is within reach and still open; otherwise keeps the most common face.
export function chooseHolds(dice, scores) {
  const c = counts(dice);
  const run = longestRun(c);
  const straightsOpen = scores.smallStraight == null || scores.largeStraight == null;
  if (run.length >= 4 && straightsOpen) {
    const need = new Set(run);
    return dice.map((v) => {
      if (need.has(v)) { need.delete(v); return true; }
      return false;
    });
  }
  // Keep the mode; ties break toward the higher face (worth more points).
  let best = 1;
  for (let f = 2; f <= DIE_FACES; f += 1) {
    if (c[f] > c[best] || (c[f] === c[best] && f > best)) best = f;
  }
  return dice.map((v) => v === best);
}

// Reroll unless the dice are already locked in (all kept) or a Yacht is in hand.
export function wantsReroll(dice, scores, rollsLeft) {
  if (rollsLeft <= 0) return false;
  if (scores.yacht == null && counts(dice).some((n) => n === DICE_COUNT)) return false;
  const holds = chooseHolds(dice, scores);
  return holds.some((keep) => !keep);
}

// Fixed order for "sacrificing" a zero when nothing scores — burn the cheapest
// slots first and protect the ones that can still pay off big.
const SACRIFICE_ORDER = [
  'aces', 'twos', 'threes', 'fourKind', 'yacht',
  'fullHouse', 'largeStraight', 'smallStraight', 'fours', 'fives', 'sixes', 'choice',
];

// Pick the open category with the highest score; if everything scores 0, dump
// the zero into the least valuable open slot.
export function chooseCategory(dice, scores) {
  const open = CATEGORY_IDS.filter((id) => scores[id] == null);
  let best = open[0];
  let bestScore = -1;
  for (const id of open) {
    const s = scoreFor(id, dice);
    if (s > bestScore) { bestScore = s; best = id; }
  }
  if (bestScore > 0) return best;
  return SACRIFICE_ORDER.find((id) => scores[id] == null) || open[0];
}

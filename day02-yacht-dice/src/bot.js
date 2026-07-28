// A stronger, still-beatable bot.
//
// Holds: evaluate all 32 keep-sets by Monte-Carlo rollout of the remaining
// rolls, scoring each outcome with a *strategic* hand value that chases the
// upper-section bonus (worth 35). Category choice manages the upper bonus,
// avoids wasting high-ceiling slots, and keeps Choice as a safety net.
//
// Pure decision helpers — the driver in main.js paces the moves.

import {
  DICE_COUNT, DIE_FACES, UPPER_IDS, UPPER_BONUS_THRESHOLD, CATEGORY_IDS,
} from './config.js';
import { counts, scoreFor, upperSum } from './scoring.js';

const rollDie = () => 1 + Math.floor(Math.random() * DIE_FACES);
const SAMPLES = 40;
const UPPER_CHASE = 1.4;   // upper points count for more while the bonus is open

// All 32 keep-masks over five dice.
const MASKS = [];
for (let b = 0; b < (1 << DICE_COUNT); b += 1) {
  MASKS.push(Array.from({ length: DICE_COUNT }, (_, i) => Boolean(b & (1 << i))));
}

const upperGap = (scores) => Math.max(0, UPPER_BONUS_THRESHOLD - upperSum(scores));

// Rough expected value ("par") of each category under decent play. The bot
// values a hand by how much it BEATS par in some open category — this is what
// makes it save Yacht/Straight slots for big hands instead of dumping them.
const PAR = {
  aces: 2, twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12,
  choice: 23, fourKind: 8, fullHouse: 13, smallStraight: 11, largeStraight: 9, yacht: 5,
};

// Strategic value of these dice: the best "excess over par" across open
// categories. Upper points get an extra push while the 63 bonus is reachable.
function bestHand(dice, scores) {
  const chasing = upperGap(scores) > 0;
  let best = -Infinity;
  for (const id of CATEGORY_IDS) {
    if (scores[id] != null) continue;
    const s = scoreFor(id, dice);
    let v = s - PAR[id];
    if (chasing && UPPER_IDS.includes(id)) v += s * (UPPER_CHASE - 1);
    if (v > best) best = v;
  }
  return best === -Infinity ? 0 : best;
}

// Cheap heuristic keep used for the intermediate reroll inside a 2-roll rollout:
// keep a near-straight, else the most common face.
function quickKeep(dice) {
  const c = counts(dice);
  let bestRun = [];
  let run = [];
  for (let i = 1; i <= DIE_FACES; i += 1) {
    if (c[i]) { run.push(i); if (run.length > bestRun.length) bestRun = run.slice(); } else run = [];
  }
  if (bestRun.length >= 4) {
    const need = new Set(bestRun);
    return dice.map((v) => (need.has(v) ? (need.delete(v), true) : false));
  }
  let mode = 1;
  for (let f = 2; f <= DIE_FACES; f += 1) {
    if (c[f] > c[mode] || (c[f] === c[mode] && f > mode)) mode = f;
  }
  return dice.map((v) => v === mode);
}

// Expected strategic value of a keep-mask, rolling out the remaining rolls.
function evalMask(mask, dice, scores, rollsLeft) {
  let total = 0;
  for (let s = 0; s < SAMPLES; s += 1) {
    let t = dice.map((v, i) => (mask[i] ? v : rollDie()));
    if (rollsLeft - 1 > 0) {
      const m2 = quickKeep(t);
      t = t.map((v, i) => (m2[i] ? v : rollDie()));
    }
    total += bestHand(t, scores);
  }
  return total / SAMPLES;
}

export function chooseHolds(dice, scores, rollsLeft = 1) {
  let best = MASKS[MASKS.length - 1]; // keep all
  let bestEV = -1;
  for (const mask of MASKS) {
    const ev = evalMask(mask, dice, scores, rollsLeft);
    if (ev > bestEV) { bestEV = ev; best = mask; }
  }
  return best;
}

export function wantsReroll(dice, scores, rollsLeft) {
  if (rollsLeft <= 0) return false;
  const keep = chooseHolds(dice, scores, rollsLeft);
  if (keep.every((k) => k)) return false;
  return evalMask(keep, dice, scores, rollsLeft) > bestHand(dice, scores) + 0.5;
}

// Where to score: place the dice where they most exceed that category's par, so
// great hands go to their best slot and busts fall on the cheapest one. Upper
// fills get a nudge while the 63 bonus is still reachable.
export function chooseCategory(dice, scores) {
  const open = CATEGORY_IDS.filter((id) => scores[id] == null);
  const upSum = upperSum(scores);
  const chasing = upperGap(scores) > 0;

  let best = open[0];
  let bestVal = -Infinity;
  for (const id of open) {
    const s = scoreFor(id, dice);
    let val = s - PAR[id];
    if (UPPER_IDS.includes(id)) {
      if (chasing) val += s * 0.25;                                             // progress toward bonus
      if (upSum < UPPER_BONUS_THRESHOLD && upSum + s >= UPPER_BONUS_THRESHOLD) val += 20; // secures +35
    }
    if (val > bestVal) { bestVal = val; best = id; }
  }
  return best;
}

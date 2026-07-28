// A reasonably strong, still-beatable bot.
//
// Holds are chosen by a light one-step expected-value estimate: for a handful
// of candidate "keep" sets it rerolls the rest a few dozen times and keeps the
// set with the best average hand. Category choice is greedy on score but nudges
// toward the upper bonus and away from wasting high-ceiling slots.
//
// Pure decision helpers — the driver in main.js paces the actual moves.

import { DICE_COUNT, DIE_FACES, UPPER_IDS, CATEGORY_IDS } from './config.js';
import { counts, scoreFor } from './scoring.js';

const rollDie = () => 1 + Math.floor(Math.random() * DIE_FACES);
const SAMPLES = 36;

// Best score obtainable right now from any still-open category — the signal we
// try to maximize when deciding what to keep.
function handValue(dice, scores) {
  let best = 0;
  for (const id of CATEGORY_IDS) {
    if (scores[id] != null) continue;
    const s = scoreFor(id, dice);
    if (s > best) best = s;
  }
  return best;
}

// Values of the longest consecutive run (e.g. [3,4,5,6]).
function longestRun(c) {
  let best = [];
  let run = [];
  for (let i = 1; i <= DIE_FACES; i += 1) {
    if (c[i] > 0) { run.push(i); if (run.length > best.length) best = run.slice(); }
    else run = [];
  }
  return best;
}

// The keep-masks worth evaluating: nothing, everything, all-of-each-face, the
// straight run, and the two most common faces (toward full house / four-kind).
function candidateMasks(dice) {
  const c = counts(dice);
  const masks = [dice.map(() => false), dice.map(() => true)];

  for (let f = 1; f <= DIE_FACES; f += 1) {
    if (c[f] > 0) masks.push(dice.map((v) => v === f));
  }

  const run = longestRun(c);
  if (run.length >= 3) {
    const need = new Set(run);
    masks.push(dice.map((v) => (need.has(v) ? (need.delete(v), true) : false)));
  }

  const faces = [];
  for (let f = 1; f <= DIE_FACES; f += 1) if (c[f] > 0) faces.push(f);
  faces.sort((a, b) => c[b] - c[a]);
  if (faces.length >= 2) {
    const keep = new Set([faces[0], faces[1]]);
    masks.push(dice.map((v) => keep.has(v)));
  }

  const seen = new Set();
  return masks.filter((m) => { const k = m.join(''); if (seen.has(k)) return false; seen.add(k); return true; });
}

// Average hand value after rerolling the unkept dice once.
function evalKeep(mask, dice, scores) {
  let total = 0;
  for (let s = 0; s < SAMPLES; s += 1) {
    const trial = dice.map((v, i) => (mask[i] ? v : rollDie()));
    total += handValue(trial, scores);
  }
  return total / SAMPLES;
}

export function chooseHolds(dice, scores) {
  let best = null;
  let bestEV = -1;
  for (const mask of candidateMasks(dice)) {
    const ev = evalKeep(mask, dice, scores);
    if (ev > bestEV) { bestEV = ev; best = mask; }
  }
  return best || dice.map(() => true);
}

// Reroll only when keeping something back and a reroll is expected to help.
export function wantsReroll(dice, scores, rollsLeft) {
  if (rollsLeft <= 0) return false;
  const keep = chooseHolds(dice, scores);
  if (keep.every((k) => k)) return false;
  return evalKeep(keep, dice, scores) > handValue(dice, scores) + 0.5;
}

// Rough ceiling for each category, used to prefer efficient placements.
const CEIL = {
  aces: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30,
  choice: 30, fourKind: 30, fullHouse: 28, smallStraight: 15, largeStraight: 30, yacht: 50,
};

// When a turn busts (nothing scores), give up the cheapest slots first and keep
// the high-payoff ones open.
const SACRIFICE_ORDER = [
  'aces', 'twos', 'threes', 'fourKind', 'yacht',
  'fullHouse', 'largeStraight', 'smallStraight', 'fours', 'fives', 'sixes', 'choice',
];

// Pick where to score: greedy on points, but nudge toward the upper bonus and
// away from burning a high-ceiling category on a low score.
export function chooseCategory(dice, scores) {
  const open = CATEGORY_IDS.filter((id) => scores[id] == null);
  const positive = open.map((id) => ({ id, s: scoreFor(id, dice) })).filter((o) => o.s > 0);

  if (positive.length === 0) {
    return SACRIFICE_ORDER.find((id) => scores[id] == null) || open[0];
  }

  let best = positive[0];
  let bestVal = -Infinity;
  for (const o of positive) {
    let val = o.s - 0.15 * (CEIL[o.id] - o.s);   // mild waste-avoidance
    if (UPPER_IDS.includes(o.id)) val += o.s * 0.12; // upper-bonus nudge
    if (val > bestVal) { bestVal = val; best = o; }
  }
  return best.id;
}

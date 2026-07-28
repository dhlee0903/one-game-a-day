// Game constants and the category table — the single source of truth for
// rules, shared by scoring, the bot, and the renderer.

export const DICE_COUNT = 5;
export const DIE_FACES = 6;
export const MAX_ROLLS = 3;          // rolls allowed per turn

export const UPPER_IDS = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;

export const FIXED_SMALL_STRAIGHT = 15;
export const FIXED_LARGE_STRAIGHT = 30;
export const FIXED_YACHT = 50;

// Bonus for each additional Yacht rolled after the Yacht slot already holds 50.
export const YACHT_BONUS = 100;

// Ordered as they appear on the scorecard. `face` drives upper-section scoring.
export const CATEGORIES = [
  { id: 'aces', label: 'Aces', hint: '1 합', section: 'upper', face: 1 },
  { id: 'twos', label: 'Twos', hint: '2 합', section: 'upper', face: 2 },
  { id: 'threes', label: 'Threes', hint: '3 합', section: 'upper', face: 3 },
  { id: 'fours', label: 'Fours', hint: '4 합', section: 'upper', face: 4 },
  { id: 'fives', label: 'Fives', hint: '5 합', section: 'upper', face: 5 },
  { id: 'sixes', label: 'Sixes', hint: '6 합', section: 'upper', face: 6 },
  { id: 'choice', label: 'Choice', hint: '전체 합', section: 'lower' },
  { id: 'fourKind', label: '4 of a Kind', hint: '같은 눈 4개 → 전체 합', section: 'lower' },
  { id: 'fullHouse', label: 'Full House', hint: '3+2 → 전체 합', section: 'lower' },
  { id: 'smallStraight', label: 'S. Straight', hint: '4연속 → 15', section: 'lower' },
  { id: 'largeStraight', label: 'L. Straight', hint: '5연속 → 30', section: 'lower' },
  { id: 'yacht', label: 'Yacht', hint: '같은 눈 5개 → 50', section: 'lower' },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

// Turn-based game state machine for two players (human/human or human/bot).
// Owns the dice, whose turn it is, rolls remaining, and win detection. It calls
// scoring for numbers and exposes semantic commands the UI and bot both drive.
// Rendering happens via the onChange callback; the game never touches the DOM.

import {
  DICE_COUNT, DIE_FACES, MAX_ROLLS, CATEGORY_IDS,
} from './config.js';
import { scoreFor, upperBonus, grandTotal, isCardFull } from './scoring.js';

const emptyScores = () =>
  CATEGORY_IDS.reduce((acc, id) => { acc[id] = null; return acc; }, {});

const rollDie = () => 1 + Math.floor(Math.random() * DIE_FACES);

export class Game {
  constructor({ onChange, onEvent, onGameOver } = {}) {
    this.onChange = onChange || (() => {});
    this.onEvent = onEvent || (() => {});       // celebratory moments (Yacht, bonus…)
    this.onGameOver = onGameOver || (() => {});  // final result, for stats
    this.phase = 'setup'; // setup | playing | gameover
    this.players = [];
    this.current = 0;
    this.dice = Array(DICE_COUNT).fill(1);
    this.held = Array(DICE_COUNT).fill(false);
    this.rollsLeft = MAX_ROLLS;
    this.rolled = false;
    this.rolling = Array(DICE_COUNT).fill(false); // which dice just tumbled
    this.pendingCategory = null; // human-selected category awaiting confirmation
    this.lastWrite = null;       // { player, catId } just committed, for the write animation
    this.winner = null; // index, or 'tie'
  }

  // mode: 'bot' | 'human'. names optional.
  start(mode, names = {}) {
    this.players = [
      { name: names.p1 || 'Player 1', isBot: false, scores: emptyScores() },
      {
        name: names.p2 || (mode === 'bot' ? 'Bot' : 'Player 2'),
        isBot: mode === 'bot',
        scores: emptyScores(),
      },
    ];
    this.current = 0;
    this.winner = null;
    this.phase = 'playing';
    this._startTurn();
  }

  currentPlayer() {
    return this.players[this.current];
  }

  // Return to the setup screen (used by the game-over "다시하기" button).
  reset() {
    this.phase = 'setup';
    this.winner = null;
    this.onChange();
  }

  // ----- commands -----

  roll() {
    if (this.phase !== 'playing' || this.rollsLeft <= 0) return;
    for (let i = 0; i < DICE_COUNT; i += 1) {
      if (!this.held[i]) this.dice[i] = rollDie();
    }
    this.rolling = this.held.map((h) => !h); // the unheld dice are the ones that tumbled
    this.pendingCategory = null; // dice changed — any pending selection is stale
    this.lastWrite = null;       // clear the write animation once the next turn acts
    this.rollsLeft -= 1;
    this.rolled = true;
    this.onChange();
  }

  // A human clicks a category to select it (shows a confirm bar); clicking the
  // same one again confirms. Guards against fat-fingering a category away.
  select(categoryId) {
    if (this.phase !== 'playing' || !this.rolled) return;
    const player = this.currentPlayer();
    if (player.isBot || player.scores[categoryId] != null) return;
    if (this.pendingCategory === categoryId) { this.choose(categoryId); return; }
    this.pendingCategory = categoryId;
    this.onChange();
  }

  cancelSelect() {
    this.pendingCategory = null;
    this.onChange();
  }

  confirm() {
    if (this.pendingCategory) this.choose(this.pendingCategory);
  }

  toggleHold(i) {
    if (this.phase !== 'playing' || !this.rolled || this.rollsLeft <= 0) return;
    this.held[i] = !this.held[i];
    this._stopTumble();
    this.onChange();
  }

  setHeld(mask) {
    this.held = mask.slice();
    this._stopTumble();
    this.onChange();
  }

  // Clear the tumble flags so a re-render doesn't replay the roll animation.
  _stopTumble() {
    this.rolling = Array(DICE_COUNT).fill(false);
  }

  // Commit the current dice into a category for the current player, then advance.
  choose(categoryId) {
    if (this.phase !== 'playing' || !this.rolled) return;
    const player = this.currentPlayer();
    if (player.scores[categoryId] != null) return; // already used

    const bonusBefore = upperBonus(player.scores);
    const score = scoreFor(categoryId, this.dice);
    player.scores[categoryId] = score;
    this.lastWrite = { player: this.current, catId: categoryId };
    this.pendingCategory = null;

    this._announce(categoryId, score, bonusBefore, upperBonus(player.scores));
    this._endTurn();
  }

  // Fire celebratory events for standout results.
  _announce(categoryId, score, bonusBefore, bonusAfter) {
    if (categoryId === 'yacht' && score === 50) this.onEvent({ type: 'yacht', text: 'YACHT! 🎉' });
    else if (categoryId === 'largeStraight' && score === 30) this.onEvent({ type: 'largeStraight', text: 'L. STRAIGHT! ✨' });
    else if (categoryId === 'smallStraight' && score === 15) this.onEvent({ type: 'smallStraight', text: 'S. STRAIGHT!' });
    else if (categoryId === 'fullHouse' && score > 0) this.onEvent({ type: 'fullHouse', text: 'FULL HOUSE!' });
    if (bonusBefore === 0 && bonusAfter > 0) this.onEvent({ type: 'bonus', text: '상단 보너스 +35! 🎉' });
  }

  // ----- turn lifecycle -----

  _startTurn() {
    this.rollsLeft = MAX_ROLLS;
    this.held = Array(DICE_COUNT).fill(false);
    this.rolled = false;
    this.pendingCategory = null;
    // lastWrite is intentionally NOT cleared here: the freshly written number
    // should animate on this render, then clear when the next player rolls.
    this._stopTumble();
    this.onChange();
  }

  _endTurn() {
    if (this.players.every((p) => isCardFull(p.scores))) {
      this._finish();
      return;
    }
    this.current = 1 - this.current;
    this._startTurn();
  }

  _finish() {
    this.phase = 'gameover';
    const totals = this.players.map((p) => grandTotal(p.scores));
    this.winner = totals[0] === totals[1] ? 'tie' : (totals[0] > totals[1] ? 0 : 1);
    this.onGameOver({
      winner: this.winner,
      players: this.players.map((p, i) => ({ name: p.name, isBot: p.isBot, total: totals[i] })),
    });
    this.onChange();
  }
}

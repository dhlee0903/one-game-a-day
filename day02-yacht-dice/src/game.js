// Turn-based game state machine for two players (human/human or human/bot).
// Owns the dice, whose turn it is, rolls remaining, and win detection. It calls
// scoring for numbers and exposes semantic commands the UI and bot both drive.
// Rendering happens via the onChange callback; the game never touches the DOM.

import {
  DICE_COUNT, DIE_FACES, MAX_ROLLS, CATEGORY_IDS,
} from './config.js';
import { scoreFor, grandTotal, isCardFull } from './scoring.js';

const emptyScores = () =>
  CATEGORY_IDS.reduce((acc, id) => { acc[id] = null; return acc; }, {});

const rollDie = () => 1 + Math.floor(Math.random() * DIE_FACES);

export class Game {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.phase = 'setup'; // setup | playing | gameover
    this.players = [];
    this.current = 0;
    this.dice = Array(DICE_COUNT).fill(1);
    this.held = Array(DICE_COUNT).fill(false);
    this.rollsLeft = MAX_ROLLS;
    this.rolled = false;
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
    this.rollsLeft -= 1;
    this.rolled = true;
    this.onChange();
  }

  toggleHold(i) {
    if (this.phase !== 'playing' || !this.rolled || this.rollsLeft <= 0) return;
    this.held[i] = !this.held[i];
    this.onChange();
  }

  setHeld(mask) {
    this.held = mask.slice();
    this.onChange();
  }

  // Commit the current dice into a category for the current player, then advance.
  choose(categoryId) {
    if (this.phase !== 'playing' || !this.rolled) return;
    const scores = this.currentPlayer().scores;
    if (scores[categoryId] != null) return; // already used
    scores[categoryId] = scoreFor(categoryId, this.dice);
    this._endTurn();
  }

  // ----- turn lifecycle -----

  _startTurn() {
    this.rollsLeft = MAX_ROLLS;
    this.held = Array(DICE_COUNT).fill(false);
    this.rolled = false;
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
    const [a, b] = this.players.map((p) => grandTotal(p.scores));
    this.winner = a === b ? 'tie' : (a > b ? 0 : 1);
    this.onChange();
  }
}

// A shoe of one or more 52-card decks. Cards are plain objects
// { rank, suit, red }. Reshuffles automatically when it runs low.

import { SUITS, RANKS, NUM_DECKS } from './config.js';

export class Deck {
  constructor(numDecks = NUM_DECKS) {
    this.numDecks = numDecks;
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let n = 0; n < this.numDecks; n += 1) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ rank, suit: suit.s, red: suit.red });
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    const c = this.cards;
    for (let i = c.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
  }

  draw() {
    if (this.cards.length < 15) this.reset(); // fresh shoe before it empties
    return this.cards.pop();
  }
}

// Blackjack game logic — no DOM. Betting → player turn → dealer turn → result.
// Rendering happens via the onChange callback.

import { rankValue, DEALER_STANDS_ON, BLACKJACK_PAYOUT } from './config.js';
import { Deck } from './deck.js';
import { getChips, setChips } from './storage.js';

// Best total for a hand; aces count 11 then drop to 1 to avoid busting.
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

export class Blackjack {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.deck = new Deck();
    this.chips = getChips();
    this.bet = 0;
    this.player = [];
    this.dealer = [];
    this.hideHole = true;
    this.phase = 'bet'; // bet | player | dealer | result
    this.message = '베팅하세요';
    this.outcome = null; // 'win' | 'lose' | 'push'
  }

  // ----- betting -----

  addBet(n) {
    if (this.phase !== 'bet') return;
    this.bet = Math.min(this.chips, this.bet + n);
    this.onChange();
  }

  clearBet() {
    if (this.phase !== 'bet') return;
    this.bet = 0;
    this.onChange();
  }

  refill() {
    if (this.chips > 0) return;
    this.chips = 1000;
    setChips(this.chips);
    this.onChange();
  }

  // ----- round flow -----

  deal() {
    if (this.phase !== 'bet' || this.bet <= 0) return;
    this.chips -= this.bet; // stake is taken now
    setChips(this.chips);
    this.player = [this.deck.draw(), this.deck.draw()];
    this.dealer = [this.deck.draw(), this.deck.draw()];
    this.hideHole = true;
    this.phase = 'player';
    this.message = '';
    this.outcome = null;

    if (isBlackjack(this.player) || isBlackjack(this.dealer)) {
      this._settle(); // naturals resolve immediately
      return;
    }
    this.onChange();
  }

  hit() {
    if (this.phase !== 'player') return;
    this.player.push(this.deck.draw());
    if (handValue(this.player).total > 21) this._settle();
    else this.onChange();
  }

  stand() {
    if (this.phase !== 'player') return;
    this._dealerTurn();
  }

  canDouble() {
    return this.phase === 'player' && this.player.length === 2 && this.chips >= this.bet;
  }

  double() {
    if (!this.canDouble()) return;
    this.chips -= this.bet;
    this.bet *= 2;
    setChips(this.chips);
    this.player.push(this.deck.draw());
    if (handValue(this.player).total > 21) this._settle();
    else this._dealerTurn();
  }

  _dealerTurn() {
    this.phase = 'dealer';
    this.hideHole = false;
    while (handValue(this.dealer).total < DEALER_STANDS_ON) {
      this.dealer.push(this.deck.draw());
    }
    this._settle();
  }

  _settle() {
    this.hideHole = false;
    const p = handValue(this.player).total;
    const d = handValue(this.dealer).total;
    const pBJ = isBlackjack(this.player);
    const dBJ = isBlackjack(this.dealer);

    let payout = 0; // chips returned to the player (stake already deducted)
    if (p > 21) { this.message = '버스트 · 패배'; this.outcome = 'lose'; }
    else if (pBJ && dBJ) { this.message = '푸시 (둘 다 블랙잭)'; payout = this.bet; this.outcome = 'push'; }
    else if (pBJ) { this.message = '블랙잭! 승리'; payout = this.bet + Math.floor(this.bet * BLACKJACK_PAYOUT); this.outcome = 'win'; }
    else if (dBJ) { this.message = '딜러 블랙잭 · 패배'; this.outcome = 'lose'; }
    else if (d > 21) { this.message = '딜러 버스트 · 승리'; payout = this.bet * 2; this.outcome = 'win'; }
    else if (p > d) { this.message = '승리'; payout = this.bet * 2; this.outcome = 'win'; }
    else if (p < d) { this.message = '패배'; this.outcome = 'lose'; }
    else { this.message = '푸시'; payout = this.bet; this.outcome = 'push'; }

    this.chips += payout;
    setChips(this.chips);
    this.phase = 'result';
    this.onChange();
  }

  nextRound() {
    if (this.phase !== 'result') return;
    this.player = [];
    this.dealer = [];
    this.bet = Math.min(this.bet, this.chips); // keep last bet if affordable
    this.hideHole = true;
    this.phase = 'bet';
    this.message = this.chips <= 0 ? '칩이 없어요 — 리필하세요' : '베팅하세요';
    this.onChange();
  }
}

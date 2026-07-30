// Texas Hold'em — you vs two bots. Blinds, four betting streets, proper side
// pots on all-ins, and a showdown using poker.js. Bots are paced by main.js
// (it calls botAct on a timer); the logic itself is synchronous and testable.

import { Deck } from './deck.js';
import { SUITS, RANKS } from './config.js';
import { bestHand, compareScore, handDetail } from './poker.js';

export const SB = 10;
export const BB = 20;
const STAGES = ['preflop', 'flop', 'turn', 'river'];

export class Holdem {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.deck = new Deck(1);
    this.players = [
      { name: 'You', isBot: false, chips: 1000 },
      { name: 'Bot A', isBot: true, chips: 1000 },
      { name: 'Bot B', isBot: true, chips: 1000 },
    ];
    this.button = 0;
    this.community = [];
    this.stage = 'idle';
    this.handOver = true;
    this.message = '새 핸드를 시작하세요';
    this.results = null;
  }

  // ----- hand setup -----

  startHand() {
    this.deck.reset();
    // keep everyone funded so the table stays 3-handed
    this.players.forEach((p) => { if (p.chips < BB) p.chips = 1000; });
    this.players.forEach((p) => {
      p.hole = [this.deck.draw(), this.deck.draw()];
      p.bet = 0;        // chips in the current round
      p.committed = 0;  // chips in the whole hand (for side pots)
      p.folded = false;
      p.allIn = false;
      p.acted = false;
      p.score = null;
    });
    this.community = [];
    this.results = null;
    this.handOver = false;
    this.stage = 'preflop';
    this.button = (this.button + 1) % this.players.length;

    const sb = (this.button + 1) % this.players.length;
    const bb = (this.button + 2) % this.players.length;
    this._post(this.players[sb], SB);
    this._post(this.players[bb], BB);
    this.currentBet = BB;
    this.minRaise = BB;
    this.toAct = (bb + 1) % this.players.length; // first to act preflop
    this.message = '';
    this.onChange();
  }

  _post(p, amount) {
    const amt = Math.min(amount, p.chips);
    p.chips -= amt;
    p.bet += amt;
    p.committed += amt;
    if (p.chips === 0) p.allIn = true;
  }

  // ----- queries for the UI -----

  pot() {
    return this.players.reduce((a, p) => a + p.committed, 0);
  }

  current() {
    return this.players[this.toAct];
  }

  isHumanToAct() {
    return !this.handOver && STAGES.includes(this.stage) && this.toAct === 0
      && !this.players[0].folded && !this.players[0].allIn;
  }

  isBotToAct() {
    return !this.handOver && STAGES.includes(this.stage) && this.current().isBot
      && !this.current().folded && !this.current().allIn;
  }

  options() {
    const p = this.current();
    const toCall = this.currentBet - p.bet;
    return {
      toCall,
      canCheck: toCall === 0,
      canCall: toCall > 0 && p.chips > 0,
      canRaise: p.chips > toCall,
      minRaiseTo: this.currentBet + this.minRaise,
      maxRaiseTo: p.bet + p.chips, // all-in
    };
  }

  // ----- actions (act on the current player) -----

  fold() {
    const p = this.current();
    p.folded = true;
    p.acted = true;
    this._afterAction();
  }

  check() {
    const p = this.current();
    if (this.currentBet - p.bet !== 0) return;
    p.acted = true;
    this._afterAction();
  }

  call() {
    const p = this.current();
    this._pay(p, this.currentBet - p.bet);
    p.acted = true;
    this._afterAction();
  }

  // Raise so this player's round bet becomes `amountTo`.
  raiseTo(amountTo) {
    const p = this.current();
    const target = Math.min(amountTo, p.bet + p.chips);
    if (target <= this.currentBet) { this.call(); return; }
    const raiseSize = target - this.currentBet;
    this._pay(p, target - p.bet);
    this.minRaise = Math.max(this.minRaise, raiseSize);
    this.currentBet = target;
    // action re-opens for everyone else still in
    this.players.forEach((q) => { if (q !== p && !q.folded && !q.allIn) q.acted = false; });
    p.acted = true;
    this._afterAction();
  }

  _pay(p, amount) {
    const amt = Math.max(0, Math.min(amount, p.chips));
    p.chips -= amt;
    p.bet += amt;
    p.committed += amt;
    if (p.chips === 0) p.allIn = true;
  }

  // ----- flow -----

  _afterAction() {
    const live = this.players.filter((p) => !p.folded);
    if (live.length === 1) { this._winByFold(live[0]); return; }

    const canAct = this.players.filter((p) => !p.folded && !p.allIn);
    const roundDone = canAct.every((p) => p.acted && p.bet === this.currentBet);
    if (roundDone) { this._nextStage(); return; }

    let i = this.toAct;
    do { i = (i + 1) % this.players.length; }
    while (this.players[i].folded || this.players[i].allIn
      || (this.players[i].acted && this.players[i].bet === this.currentBet));
    this.toAct = i;
    this.onChange();
  }

  _nextStage() {
    // If at most one player can still bet, deal out the rest and go to showdown.
    const canAct = this.players.filter((p) => !p.folded && !p.allIn);
    const idx = STAGES.indexOf(this.stage);

    this.players.forEach((p) => { p.bet = 0; p.acted = false; });
    this.currentBet = 0;
    this.minRaise = BB;

    if (this.stage === 'river') { this._showdown(); return; }

    // reveal the next street
    if (this.stage === 'preflop') this.community.push(this.deck.draw(), this.deck.draw(), this.deck.draw());
    else this.community.push(this.deck.draw());
    this.stage = STAGES[idx + 1];

    if (canAct.length <= 1) {
      // no more betting possible — run the board out
      while (this.community.length < 5) this.community.push(this.deck.draw());
      this._showdown();
      return;
    }

    // first active player left of the button acts first postflop
    let i = this.button;
    do { i = (i + 1) % this.players.length; }
    while (this.players[i].folded || this.players[i].allIn);
    this.toAct = i;
    this.onChange();
  }

  _winByFold(winner) {
    const pot = this.pot();
    winner.chips += pot;
    this.message = `${winner.name} 승리 · 팟 ${pot} (모두 폴드)`;
    this.results = null;
    this.stage = 'done';
    this.handOver = true;
    this.onChange();
  }

  _showdown() {
    const contenders = this.players.filter((p) => !p.folded);
    contenders.forEach((p) => { p.score = bestHand([...p.hole, ...this.community]); });

    // side pots from per-player commitments
    const pots = [];
    let rem = this.players.filter((p) => p.committed > 0).map((p) => ({ p, c: p.committed }));
    while (rem.length) {
      const min = Math.min(...rem.map((x) => x.c));
      const eligible = rem.filter((x) => !x.p.folded).map((x) => x.p);
      pots.push({ amount: min * rem.length, eligible });
      rem.forEach((x) => { x.c -= min; });
      rem = rem.filter((x) => x.c > 0);
    }

    const won = new Map();
    pots.forEach((pot) => {
      if (!pot.eligible.length) return;
      let best = null;
      let winners = [];
      pot.eligible.forEach((p) => {
        if (!best || compareScore(p.score, best) > 0) { best = p.score; winners = [p]; }
        else if (compareScore(p.score, best) === 0) winners.push(p);
      });
      const share = Math.floor(pot.amount / winners.length);
      winners.forEach((p, i) => {
        const add = share + (i === 0 ? pot.amount - share * winners.length : 0);
        p.chips += add;
        won.set(p, (won.get(p) || 0) + add);
      });
    });

    this.results = contenders
      .map((p) => ({ name: p.name, hand: handDetail(p.score), won: won.get(p) || 0 }))
      .sort((a, b) => b.won - a.won);
    const top = this.results.find((r) => r.won > 0);
    this.message = top ? `${top.name} 승리 · ${top.hand}` : '쇼다운';
    this.stage = 'done';
    this.handOver = true;
    this.onChange();
  }

  // ----- bot -----

  botAct() {
    if (!this.isBotToAct()) return;
    const p = this.current();
    const o = this.options();
    const eq = this._equity(p);          // Monte-Carlo win probability
    const pot = this.pot();
    const r = Math.random();
    const raiseAmt = (frac) => Math.min(o.maxRaiseTo, this.currentBet + Math.max(BB, Math.floor(pot * frac)));

    if (o.toCall === 0) {
      // no bet to us: value bet / semibluff when strong, sometimes bluff
      if (eq > 0.6 || (eq > 0.5 && r < 0.4)) this.raiseTo(raiseAmt(0.6));
      else if (r < 0.1 && o.canRaise) this.raiseTo(raiseAmt(0.45)); // occasional bluff
      else this.check();
      return;
    }

    // facing a bet: compare equity to pot odds
    const potOdds = o.toCall / (pot + o.toCall);
    if (eq > 0.78 && o.canRaise && r < 0.65) { this.raiseTo(raiseAmt(0.75)); return; }
    if (eq >= potOdds + 0.04) { this.call(); return; }        // profitable call
    if (r < 0.05 && o.canRaise && eq > 0.3) { this.raiseTo(raiseAmt(0.6)); return; } // rare bluff-raise
    this.fold();
  }

  // Monte-Carlo equity: bot's chance to win/tie against the remaining opponents,
  // simulating random completions of the board and opponents' hole cards.
  _equity(p, samples = 150) {
    const oppCount = this.players.filter((q) => q !== p && !q.folded).length;
    const used = new Set([...p.hole, ...this.community].map((c) => c.rank + c.suit));
    const rest = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (!used.has(rank + suit.s)) rest.push({ rank, suit: suit.s, red: suit.red });
      }
    }
    let score = 0;
    for (let s = 0; s < samples; s += 1) {
      // partial Fisher-Yates: only shuffle the cards we draw
      let top = rest.length;
      const take = () => {
        const j = Math.floor(Math.random() * top);
        top -= 1;
        [rest[j], rest[top]] = [rest[top], rest[j]];
        return rest[top];
      };
      const board = this.community.slice();
      while (board.length < 5) board.push(take());
      const mine = bestHand([...p.hole, ...board]);
      let win = true;
      let tie = false;
      for (let o = 0; o < oppCount; o += 1) {
        const other = bestHand([take(), take(), ...board]);
        const cmp = compareScore(mine, other);
        if (cmp < 0) { win = false; break; }
        if (cmp === 0) tie = true;
      }
      if (win) score += tie ? 0.5 : 1;
    }
    return score / samples;
  }
}

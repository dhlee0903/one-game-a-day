// Entry point: hub (game selection) + routing, and Blackjack wiring/input.

import { Blackjack } from './blackjack.js';
import { renderBlackjack } from './render.js';

const $ = (id) => document.getElementById(id);

const els = {
  dealerCards: $('dealerCards'),
  dealerVal: $('dealerVal'),
  playerCards: $('playerCards'),
  playerVal: $('playerVal'),
  chips: $('chips'),
  bet: $('betAmt'),
  msg: $('bjMsg'),
  controls: $('bjControls'),
};

const blackjack = new Blackjack({ onChange: () => renderBlackjack(blackjack, els) });

// ----- routing -----

function showHub() {
  $('hub').hidden = false;
  $('blackjack').hidden = true;
}

function showBlackjack() {
  $('hub').hidden = true;
  $('blackjack').hidden = false;
  renderBlackjack(blackjack, els);
}

document.querySelectorAll('.game-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.game === 'blackjack') showBlackjack();
  });
});

$('bjBack').addEventListener('click', showHub);

// ----- blackjack controls (delegated) -----

const ACTIONS = {
  bet: (b, el) => b.addBet(Number(el.dataset.n)),
  allin: (b) => b.addBet(b.chips),
  clear: (b) => b.clearBet(),
  deal: (b) => b.deal(),
  hit: (b) => b.hit(),
  stand: (b) => b.stand(),
  double: (b) => b.double(),
  next: (b) => b.nextRound(),
  refill: (b) => b.refill(),
};

els.controls.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  ACTIONS[el.dataset.a]?.(blackjack, el);
});

// ----- keyboard -----

window.addEventListener('keydown', (e) => {
  if ($('blackjack').hidden) return;
  const b = blackjack;
  if (b.phase === 'player') {
    if (e.key === 'h' || e.key === 'H') b.hit();
    else if (e.key === 's' || e.key === 'S') b.stand();
    else if (e.key === 'd' || e.key === 'D') b.double();
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (b.phase === 'bet' && b.bet > 0) b.deal();
    else if (b.phase === 'result') b.nextRound();
  }
});

showHub();

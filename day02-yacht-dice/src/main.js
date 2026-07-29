// Entry point: wires DOM, renderer, game, and input together; runs the setup
// screen, the game-over overlay, and the paced bot driver.

import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { chooseHolds, wantsReroll, chooseCategory } from './bot.js';
import { grandTotal } from './scoring.js';
import { getStats, recordGame, getSkin, setSkin } from './storage.js';

const $ = (id) => document.getElementById(id);

const els = {
  turn: $('turn'),
  dice: $('dice'),
  controls: $('controls'),
  card: $('scorecard'),
};

const renderer = new Renderer(els);
const game = new Game({ onChange, onEvent: showToast, onGameOver: handleGameOver });
new InputController(game, els);

let lastResult = null; // { isNewBest, stats } from the most recent finished game

// Brief celebratory toast for standout moments (Yacht, bonus, straights…).
function showToast(evt) {
  const popup = $('popup');
  popup.textContent = evt.text;
  popup.classList.remove('pop');
  void popup.offsetWidth; // restart the CSS animation
  popup.classList.add('pop');
}

function handleGameOver(result) {
  lastResult = recordGame(result);
  renderStats();
  if (result.winner !== 'tie') launchConfetti();
}

const CONFETTI_COLORS = ['#2f6fdb', '#e8940c', '#2e9e5b', '#e5484d', '#a371f7', '#f0c419'];

// A quick burst of falling confetti over the win screen. Pure DOM, no deps.
function launchConfetti() {
  const box = $('confetti');
  box.innerHTML = '';
  for (let i = 0; i < 110; i += 1) {
    const p = document.createElement('i');
    p.className = 'conf';
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    if (Math.random() < 0.5) p.style.borderRadius = '50%';
    box.appendChild(p);
  }
  setTimeout(() => { box.innerHTML = ''; }, 3400);
}

// Best score + vs-bot record shown on the setup screen.
function renderStats() {
  const el = $('stats');
  if (!el) return;
  const s = getStats();
  el.innerHTML =
    `최고 <b>${s.best}</b>`
    + ` &nbsp;·&nbsp; vs 봇 <b>${s.bot.w}</b>승 <b>${s.bot.l}</b>패 <b>${s.bot.t}</b>무`;
}

// ----- setup screen -----

let mode = 'bot';
document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach((b) => b.classList.toggle('active', b === btn));
    $('name2').placeholder = mode === 'bot' ? 'Bot' : 'Player 2';
  });
});

$('startBtn').addEventListener('click', () => {
  game.start(mode, { p1: $('name1').value.trim(), p2: $('name2').value.trim() });
});

// ----- dice skin -----

const SKIN_CLASS = { 1: 'dice-ivory', 2: 'dice-red', 3: 'dice-onyx' };

function applySkin(n) {
  Object.values(SKIN_CLASS).forEach((c) => document.body.classList.remove(c));
  document.body.classList.add(SKIN_CLASS[n] || SKIN_CLASS[1]);
  document.querySelectorAll('.skin').forEach((b) => b.classList.toggle('active', Number(b.dataset.skin) === n));
}

document.querySelectorAll('.skin').forEach((btn) => {
  btn.addEventListener('click', () => {
    const n = Number(btn.dataset.skin);
    setSkin(n);
    applySkin(n);
  });
});

applySkin(getSkin());

// ----- render + phase routing -----

function onChange() {
  $('setup').hidden = game.phase !== 'setup';
  $('game').hidden = game.phase === 'setup';

  if (game.phase !== 'setup') renderer.render(game);
  renderOverlay();
  scheduleBot();
}

function renderOverlay() {
  const overlay = $('overlay');
  if (game.phase !== 'gameover') {
    overlay.classList.remove('show');
    return;
  }
  const [p1, p2] = game.players;
  const t1 = grandTotal(p1.scores);
  const t2 = grandTotal(p2.scores);
  const title = game.winner === 'tie'
    ? '무승부!'
    : `${game.players[game.winner].name} 승리!`;
  const newBest = lastResult && lastResult.isNewBest ? '<p class="newbest">신기록!</p>' : '';
  overlay.innerHTML = `
    <div class="result">
      <h2>${title}</h2>
      ${newBest}
      <p class="finals">${p1.name} ${t1} : ${t2} ${p2.name}</p>
      <button id="againBtn" class="primary">다시하기</button>
    </div>`;
  overlay.classList.add('show');
  $('againBtn').onclick = () => game.reset();
}

// ----- bot driver -----
// Plays one visible action per tick, but narrates what it's about to do and
// pauses so a human can follow: roll → show which dice it keeps → wait → reroll
// → … → pick a category. The "생각 중" status shows during each pause.

let botTimer = null;
let botHoldsShown = false;

// Decide the next bot action, with a message + how long to "think" first.
function decideBot() {
  const p = game.currentPlayer();
  if (!game.rolled) return { kind: 'roll', msg: '주사위를 굴려요', delay: 650 };

  if (game.rollsLeft > 0 && wantsReroll(game.dice, p.scores, game.rollsLeft)) {
    if (!botHoldsShown) return { kind: 'hold', msg: '남길 주사위 고르는 중…', delay: 850 };
    return { kind: 'reroll', msg: '나머지를 다시 굴려요', delay: 1100 };
  }
  return { kind: 'choose', msg: '점수칸 고르는 중…', delay: 1200 };
}

function scheduleBot() {
  if (game.phase !== 'playing' || botTimer) return;
  const p = game.currentPlayer();
  if (!p.isBot) return;

  const next = decideBot();
  renderer.setStatus(game, next.msg); // show the pause message without touching the dice

  botTimer = setTimeout(() => {
    botTimer = null;
    if (game.phase !== 'playing' || !game.currentPlayer().isBot) return;
    const scores = game.currentPlayer().scores;
    if (next.kind === 'roll') {
      game.roll();
    } else if (next.kind === 'hold') {
      botHoldsShown = true;
      game.setHeld(chooseHolds(game.dice, scores, game.rollsLeft)); // highlight kept dice, then pause
    } else if (next.kind === 'reroll') {
      botHoldsShown = false;
      game.roll();
    } else {
      botHoldsShown = false;
      game.choose(chooseCategory(game.dice, scores));
    }
  }, next.delay);
}

// Show the initial setup screen.
renderStats();
onChange();

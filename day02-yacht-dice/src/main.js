// Entry point: wires DOM, renderer, game, and input together; runs the setup
// screen, the game-over overlay, and the paced bot driver.

import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { chooseHolds, wantsReroll, chooseCategory } from './bot.js';
import { grandTotal } from './scoring.js';

const $ = (id) => document.getElementById(id);

const els = {
  turn: $('turn'),
  dice: $('dice'),
  controls: $('controls'),
  card: $('scorecard'),
};

const renderer = new Renderer(els);
const game = new Game({ onChange });
new InputController(game, els);

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
  overlay.innerHTML = `
    <div class="result">
      <h2>${title}</h2>
      <p class="finals">${p1.name} ${t1} : ${t2} ${p2.name}</p>
      <button id="againBtn" class="primary">다시하기</button>
    </div>`;
  overlay.classList.add('show');
  $('againBtn').onclick = () => game.reset();
}

// ----- bot driver: one visible action per tick -----

let botTimer = null;
let botHoldsShown = false;

function scheduleBot() {
  if (game.phase !== 'playing' || botTimer) return;
  if (!game.currentPlayer().isBot) return;
  botTimer = setTimeout(() => { botTimer = null; botTick(); }, 750);
}

function botTick() {
  if (game.phase !== 'playing') return;
  const p = game.currentPlayer();
  if (!p.isBot) return;

  if (!game.rolled) { game.roll(); return; }

  if (game.rollsLeft > 0 && wantsReroll(game.dice, p.scores, game.rollsLeft)) {
    if (!botHoldsShown) {
      game.setHeld(chooseHolds(game.dice, p.scores));
      botHoldsShown = true;
    } else {
      botHoldsShown = false;
      game.roll();
    }
    return;
  }

  botHoldsShown = false;
  game.choose(chooseCategory(game.dice, p.scores));
}

// Show the initial setup screen.
onChange();

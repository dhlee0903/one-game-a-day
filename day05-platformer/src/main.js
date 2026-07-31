// Entry point: wire canvas, game, input, HUD, and the start/win/dead overlay.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');

const game = new Game(renderer, {
  onHud: ({ score, lives, coins, stage }) => {
    $('score').textContent = score;
    $('lives').textContent = lives;
    $('coins').textContent = coins;
    $('stage').textContent = stage;
  },
  onState: handleState,
});

const input = new InputController(game.input, { onStartKey: startIfIdle });
input.bindTouch({ left: $('btnLeft'), right: $('btnRight'), jump: $('btnJump') });

function startIfIdle() {
  if (game.phase === 'playing') return;
  game.start();
}

function handleState(state, payload) {
  if (state === 'playing') { hideOverlay(); return; }
  if (state === 'win') {
    showOverlay('올 클리어!', `점수 ${payload.score}`, '다시 하기');
  } else if (state === 'dead') {
    showOverlay('게임 오버', `점수 ${payload.score}`, '다시 하기');
  }
}

function showOverlay(title, text, btn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${text}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => game.start();
}

function hideOverlay() { overlay.classList.remove('show'); }

// title screen
renderer.render(game);
showOverlay(
  '<span class="title">PLATFORMER</span><span class="sub">DAY 05</span>',
  '← → 이동 · ↑ / Space 점프 · 적을 밟아 처치',
  '시작',
);

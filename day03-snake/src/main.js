// Entry point: wires DOM, renderer, game, input, and the overlay/score UI.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { getBest, submitScore } from './storage.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const scoreEl = $('score');
const bestEl = $('best');
const overlay = $('overlay');

bestEl.textContent = getBest();

const game = new Game(renderer, {
  onScore: (s) => { scoreEl.textContent = s; },
  onState: handleState,
});

new InputController(game, $('board'), { onStartKey: () => game.start() });

function handleState(state, payload) {
  if (state === 'playing') {
    hideOverlay();
  } else if (state === 'paused') {
    showOverlay('일시정지', '', '계속하기', () => game.togglePause());
  } else if (state === 'over') {
    const { best, isNewBest } = submitScore(payload.score);
    bestEl.textContent = best;
    showOverlay(
      'GAME OVER',
      `점수 ${payload.score}${isNewBest ? ' · 신기록!' : ` · 최고 ${best}`}`,
      '다시하기',
      () => game.start(),
    );
  }
}

function showOverlay(title, text, btn, onClick) {
  overlay.innerHTML = `<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}<button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = onClick;
}

function hideOverlay() {
  overlay.classList.remove('show');
}

// Initial title screen.
renderer.render(game);
showOverlay(
  '<span class="title">SNAKE</span><span class="sub">DAY 03</span>',
  '방향키 · WASD · 스와이프로 조작',
  '시작',
  () => game.start(),
);

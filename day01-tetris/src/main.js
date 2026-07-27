// Entry point: wires the DOM, renderer, game, and input together, and manages
// the overlay (start / pause / game-over screens).

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'), $('next'));
const overlay = $('overlay');

const stat = {
  score: $('score'),
  lines: $('lines'),
  level: $('level'),
};

function updateStats({ score, lines, level }) {
  stat.score.textContent = score;
  stat.lines.textContent = lines;
  stat.level.textContent = level;
}

function showOverlay(title, text, buttonLabel, onClick) {
  overlay.innerHTML =
    `<h3>${title}</h3>` +
    (text ? `<p>${text}</p>` : '') +
    `<button class="btn" id="overlayBtn">${buttonLabel}</button>`;
  overlay.classList.add('show');
  $('overlayBtn').onclick = onClick;
}

function hideOverlay() {
  overlay.classList.remove('show');
}

function handleStateChange(state, payload) {
  if (state === 'playing') {
    hideOverlay();
  } else if (state === 'paused') {
    showOverlay('일시정지', '', '계속', () => game.togglePause());
  } else if (state === 'over') {
    showOverlay(
      'GAME OVER',
      `최종 점수 ${payload.score} · ${payload.lines} 줄`,
      '다시 시작',
      () => game.start(),
    );
  }
}

const game = new Game(renderer, {
  onStats: updateStats,
  onStateChange: handleStateChange,
});

new InputController(game, $('board'), $('touch'));

// Initial title screen.
renderer.drawGridLines();
showOverlay(
  '<span class="title">TETRIS</span><span class="sub">DAY 01</span>',
  '방향키로 이동 · ↑ 회전 · Space 하드드롭',
  '시작',
  () => game.start(),
);

// Entry point: wires the DOM, renderer, game, and input together, and manages
// the overlay (start / pause / game-over screens).

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'), $('next'), $('hold'));
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

const popup = $('popup');
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const TSPIN_NAMES = ['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'];
const TSPIN_MINI_NAMES = ['T-SPIN MINI', 'T-SPIN MINI SINGLE', 'T-SPIN MINI DOUBLE'];

// Flash a popup naming the clear (TETRIS, T-SPIN DOUBLE, …) plus back-to-back
// and combo badges. Restart the CSS animation each time by removing the class
// and forcing a reflow before re-adding it.
function showClear({ cleared, tspin, combo, b2b }) {
  let name;
  if (tspin === 'full') name = TSPIN_NAMES[cleared];
  else if (tspin === 'mini') name = TSPIN_MINI_NAMES[cleared] || 'T-SPIN MINI';
  else name = CLEAR_NAMES[cleared];
  if (!name) return;

  const badges = (b2b ? '<span class="combo">BACK-TO-BACK</span>' : '')
    + (combo > 0 ? `<span class="combo">COMBO ×${combo}</span>` : '');
  popup.innerHTML = name + badges;
  popup.classList.remove('pop');
  void popup.offsetWidth;
  popup.classList.add('pop');
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
    saveHigh('og-hs-day01', payload.score);
    showOverlay(
      'GAME OVER',
      `최종 점수 ${payload.score} · ${payload.lines} 줄`,
      '다시 시작',
      () => game.start(),
    );
  }
}

// high score for the home page (localStorage; shared origin with the index)
function saveHigh(key, value) {
  try { localStorage.setItem(key, String(Math.max(Number(localStorage.getItem(key)) || 0, value || 0))); } catch { /* ignore */ }
}

const game = new Game(renderer, {
  onStats: updateStats,
  onStateChange: handleStateChange,
  onClear: showClear,
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

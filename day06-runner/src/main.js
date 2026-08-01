// Entry point: wire canvas, game, input, HUD, and the start / game-over overlay.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');
const hearts = $('hearts');

const game = new Game(renderer, {
  onHud: ({ score, coins, speed, best, lives }) => {
    $('score').textContent = score;
    $('coins').textContent = coins;
    $('speed').textContent = `${speed.toFixed(1)}x`;
    $('best').textContent = best;
    renderHearts(lives);
  },
  onState: handleState,
});

const input = new InputController(game.input, { onStartKey: startIfIdle });
input.bindTouch({ left: $('btnLeft'), right: $('btnRight'), up: $('btnJump'), down: $('btnSlide') });
input.bindSwipe($('board'), { onStartKey: startIfIdle });

function startIfIdle() {
  if (game.phase === 'playing') return;
  game.start();
}

function renderHearts(lives) {
  if (lives == null) return;
  let s = '';
  for (let i = 0; i < 3; i += 1) s += i < lives ? '♥' : '♡';
  hearts.textContent = s;
}

function handleState(state, payload) {
  if (state === 'playing') { hideOverlay(); return; }
  if (state === 'dead') {
    const line = payload.best === payload.score && payload.score > 0
      ? '신기록!'
      : `최고 ${payload.best}`;
    showOverlay('게임 오버', `점수 ${payload.score} · 코인 ${payload.coins} · ${line}`, '다시 하기');
  }
}

function showOverlay(title, text, btn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${text}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => game.start();
}

function hideOverlay() { overlay.classList.remove('show'); }

// title screen
renderHearts(3);
renderer.render(game);
showOverlay(
  '<span class="title">RUNNER</span><span class="sub">DAY 06</span>',
  '← → 라인 이동 · ↑ 점프 · ↓ 슬라이드 · 모바일은 스와이프',
  '시작',
);

// Entry point: wire canvas, game, renderer, input, HUD, and the stage overlay.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');

const game = new Game({
  onHud: ({ stage, score, target, moves }) => {
    $('stage').textContent = stage;
    $('score').textContent = score;
    $('target').textContent = target;
    $('moves').textContent = moves;
  },
  onState: handleState,
});

// eslint-disable-next-line no-new
new InputController($('board'), game);

// drive rendering from the game's rAF loop
const origLoop = game._loop.bind(game);
game._loop = function loop() { renderer.render(game); origLoop(); };
game.start();

function handleState(state, p) {
  if (state === 'won') {
    if (p.last) showOverlay('올 클리어!', `10 스테이지 완주 · 점수 ${p.score}`, '처음부터', () => game.nextStage());
    else showOverlay(`스테이지 ${p.stage} 클리어`, `점수 ${p.score}`, '다음 스테이지', () => game.nextStage());
  } else if (state === 'lost') {
    showOverlay('실패', `점수 ${p.score} / 목표 ${p.target}`, '다시 하기', () => game.retryStage());
  }
}

function showOverlay(title, text, btn, onBtn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${text}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => { overlay.classList.remove('show'); onBtn(); };
}

// title screen
showOverlay(
  '<span class="title">MATCH 3</span><span class="sub">DAY 07</span>',
  '3개 이상 맞추기 · 가로4/세로4·2×2·5매치는 특수블럭 · 스테이지 10',
  '시작',
  () => {},
);

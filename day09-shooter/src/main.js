// 진입점: 게임·렌더러·입력을 연결하고 오버레이를 다룬다.

import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');

const game = new Game({ onState: handleState });

// eslint-disable-next-line no-new
new InputController($('board'), game, $('bomb'));

function showOverlay(title, html, btn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${html}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => { overlay.classList.remove('show'); game.start(); };
}

function handleState(state, p) {
  if (state === 'playing' || state === 'boss') { overlay.classList.remove('show'); return; }
  const line = p && p.isNewBest ? '<b>신기록</b>' : `최고 ${p ? p.best : 0}`;
  if (state === 'clear') {
    showOverlay('STAGE CLEAR', `점수 ${p.score}<br>${line}<br><span class="dim">남은 폭탄·목숨 보너스 포함</span>`, '다시 하기');
  } else {
    showOverlay('GAME OVER', `점수 ${p.score}<br>${line}`, '다시 하기');
  }
}

function loop() {
  game.update();
  renderer.render(game);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 타이틀
showOverlay(
  '<span class="title">SKY RAID</span><span class="sub">DAY 09</span>',
  '드래그로 이동 · 사격은 자동<br>P 강화 · O 보조기 · B 폭탄 · L 목숨<br><span class="dim">PC: 방향키 이동, Space 폭탄</span>',
  '시작',
);

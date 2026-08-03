// Entry point: wire canvas, game, renderer, input, HUD, active-item bar, audio,
// and the stage overlay.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { Sound } from './audio.js';
import { ITEM_PRICE } from './config.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');
const sound = new Sound();
const itemsEl = $('items'); // referenced by renderItems during game construction

const game = new Game({ onState: handleState, onItems: renderItems, sound });

// browsers only allow audio after a user gesture — resume + start music then
let audioStarted = false;
function kickAudio() {
  if (audioStarted) return;
  audioStarted = true;
  sound.resume();
  if (!muted) sound.startMusic();
}
$('board').addEventListener('pointerdown', kickAudio, { once: true });
overlay.addEventListener('pointerdown', kickAudio, { once: true });

// mute toggle (SFX + music)
let muted = false;
const muteBtn = $('mute');
muteBtn.onclick = () => {
  muted = !muted;
  sound.setMuted(muted);
  sound.resume();
  if (!muted) sound.startMusic();
  muteBtn.textContent = muted ? '소리 꺼짐' : '소리 켜짐';
  muteBtn.classList.toggle('off', muted);
};

// active-item bar
itemsEl.querySelectorAll('.item').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    kickAudio();
    game.useItem(btn.dataset.item);
  });
});

function renderItems(state) {
  $('gold').textContent = state.gold;
  itemsEl.querySelectorAll('.item').forEach((btn) => {
    const id = btn.dataset.item;
    const n = state.items[id] || 0;
    const cnt = btn.querySelector('.cnt');
    if (n > 0) { cnt.textContent = n; cnt.classList.remove('buy'); } else { cnt.textContent = `${ITEM_PRICE}G`; cnt.classList.add('buy'); }
    btn.classList.toggle('armed', state.armed === id);
    btn.classList.toggle('poor', n <= 0 && state.gold < ITEM_PRICE);
  });
}

// eslint-disable-next-line no-new
new InputController($('board'), game);

// drive rendering from the game's rAF loop
const origLoop = game._loop.bind(game);
game._loop = function loop() { renderer.render(game); origLoop(); };
game.start();

function handleState(state, p) {
  if (state === 'won') {
    const gline = `골드 +${p.reward} (보유 ${p.gold})`;
    if (p.last) showOverlay('올 클리어!', `10 스테이지 완주 · 점수 ${p.score}<br>${gline}`, '처음부터', () => game.nextStage());
    else showOverlay(`스테이지 ${p.stage} 클리어`, `점수 ${p.score}<br>${gline}`, '다음 스테이지', () => game.nextStage());
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
  '3개 이상 맞추기 · 특수블럭(가로4·세로4·2×2·ㄱ자·5매치)<br>하단 아이템은 골드로, 스테이지 10',
  '시작',
  () => {},
);

// 진입점: 캔버스·게임·렌더러·입력·HUD·오버레이를 잇는다.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { store } from './storage.js';
import { CHARS } from './models.js';
import { VERSION } from './config.js';

const $ = (id) => document.getElementById(id);

const canvas = $('board');
const renderer = new Renderer(canvas);
const sound = new Sound();
const opts = store.opts();
sound.enable(opts.sfx);

const game = new Game({ onHud: hud, onState: onState, sound, store });
game.charIndex = Math.min(CHARS.length - 1, store.char());

$('ver').textContent = VERSION;

// 콘솔에서 상태를 들여다보거나 지형을 강제로 깔아 볼 수 있게 열어 둔다.
window.day11 = game;

// ---- HUD ----

let lastScore = -1;
let lastCoins = -1;
let lastBest = -1;
let bestBase = store.best();
$('best').textContent = bestBase;

function hud(s) {
  if (s.score !== lastScore) { $('score').textContent = s.score; lastScore = s.score; }
  if (s.coins !== lastCoins) { $('coins').textContent = s.coins; lastCoins = s.coins; }
  // 기록을 넘어서면 그 자리에서 최고 기록이 올라간다.
  const best = Math.max(bestBase, s.score);
  if (best !== lastBest) { $('best').textContent = best; lastBest = best; }
}

// 결과 화면은 캔버스에 직접 그린다(renderer.gameOver). 여기서는 코인이 늘었으니
// 캐릭터 목록만 다시 칠해 둔다.
function onState(state) {
  if (state !== 'over') return;
  bestBase = store.best();
  paintChars();
}

// ---- 오버레이 ----

const panels = { title: $('title'), opts: $('opts') };

function show(name) {
  for (const k of Object.keys(panels)) panels[k].classList.toggle('show', k === name);
}
function hideAll() { show(null); }

// ---- 캐릭터 ----

const charsEl = $('chars');

function paintChars() {
  const owned = store.owned();
  const coins = store.coins();
  charsEl.innerHTML = '';
  CHARS.forEach((ch, i) => {
    const has = owned.includes(i);
    const btn = document.createElement('button');
    btn.className = 'char'
      + (i === game.charIndex ? ' on' : '')
      + (has ? '' : (coins >= ch.cost ? ' locked buyable' : ' locked'));
    const body = ch.model.find((b) => b.w > 0.4) || ch.model[0];
    btn.innerHTML = `<span class="swatch" style="background:${body.c}"></span>
      <span class="nm">${ch.name}</span>
      <span class="pz">${has ? '보유' : `${ch.cost}코인`}</span>`;
    btn.onclick = () => {
      kick();
      if (has) {
        game.charIndex = i;
        store.saveChar(i);
      } else if (store.spend(ch.cost)) {
        store.addOwned(i);
        game.charIndex = i;
        store.saveChar(i);
      }
      paintChars();
    };
    charsEl.appendChild(btn);
  });
  $('titleBest').textContent = `최고 기록 ${store.best()}칸 · 코인 ${coins}개`;
}

// ---- 버튼 ----

let audioReady = false;
function kick() {
  if (audioReady) return;
  audioReady = true;
  sound.resume();
}

function play() { kick(); hideAll(); game.start(); }
function toTitle() { game.state = 'title'; game.reset(); show('title'); paintChars(); }

$('playBtn').onclick = play;
$('menuBtn').onclick = toTitle;

let wasPlaying = false;
function closeOpts() {
  if (wasPlaying || game.state === 'over') hideAll();
  else show('title');
}
$('gear').onclick = () => {
  if (panels.opts.classList.contains('show')) { closeOpts(); return; }
  wasPlaying = game.state === 'play';
  show('opts');
};
$('optClose').onclick = closeOpts;

const sfxBtn = $('sfxBtn');
function paintSfx() { sfxBtn.classList.toggle('off', !opts.sfx); }
sfxBtn.onclick = () => {
  opts.sfx = !opts.sfx;
  sound.enable(opts.sfx);
  store.saveOpts(opts);
  paintSfx();
  kick();
};
paintSfx();

// ---- 입력 ----

// eslint-disable-next-line no-new
new Input(canvas, game, kick, play);

// 설정 창이 열려 있으면 게임은 멈춘다.
const paused = () => panels.opts.classList.contains('show');

// ---- 루프 ----

renderer.resize();
window.addEventListener('resize', () => renderer.resize());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused()) game.update(dt);
  renderer.render(game, paused() ? 0 : dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

paintChars();

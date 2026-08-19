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

function hud(s) {
  if (s.score !== lastScore) { $('score').textContent = s.score; lastScore = s.score; }
  if (s.coins !== lastCoins) { $('coins').textContent = s.coins; lastCoins = s.coins; }
}

const CAUSE = {
  car: '차에 치였다', train: '기차에 치였다',
  water: '물에 빠졌다', eagle: '독수리가 낚아챘다',
};

function onState(state, p) {
  if (state !== 'over') return;
  $('cause').textContent = CAUSE[p.cause] || '';
  $('finalScore').textContent = p.score;
  $('overBest').textContent = `최고 기록 ${p.best}칸`;
  $('gain').textContent = p.coins > 0 ? `코인 +${p.coins} (보유 ${p.totalCoins})` : '';
  show('over');
  paintChars();
}

// ---- 오버레이 ----

const panels = { title: $('title'), over: $('over'), opts: $('opts') };

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

$('playBtn').onclick = () => { kick(); hideAll(); game.start(); };
$('againBtn').onclick = () => { kick(); hideAll(); game.start(); };
$('menuBtn').onclick = () => { game.state = 'title'; game.reset(); show('title'); paintChars(); };

let wasPlaying = false;
function closeOpts() {
  if (wasPlaying) hideAll();
  else show(game.state === 'over' ? 'over' : 'title');
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
new Input(canvas, game, kick);

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

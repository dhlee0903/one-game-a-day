// 진입점: 캔버스·게임·렌더러·입력·HUD·오버레이를 잇는다.

import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { store } from './storage.js';
import { CHARS } from './models.js';
import { VERSION, GACHA_COST } from './config.js';

const $ = (id) => document.getElementById(id);

const canvas = $('board');
const renderer = new Renderer(canvas);
const sound = new Sound();
const opts = store.opts();
sound.enable(opts.sfx);

const game = new Game({ onHud: hud, onState: onState, sound, store });
// 저장된 캐릭터가 아직 없는 것(또는 범위 밖)이면 기본 닭으로 되돌린다.
const savedChar = store.char();
game.charIndex = store.owned().includes(savedChar) && CHARS[savedChar] ? savedChar : 0;

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

// ---- 도감 · 뽑기 ----

const charsEl = $('chars');
const gachaBtn = $('gachaBtn');
let freshIndex = -1;   // 방금 뽑은 캐릭터 (칸이 튀어오르는 연출용)

// 도감 초상은 게임과 같은 3D 엔진으로 한 번만 찍어 두고 재사용한다.
const ICON_PX = 96;
const iconCache = new Map();

function iconFor(i, locked) {
  const key = `${i}:${locked ? 's' : 'n'}`;
  let cv = iconCache.get(key);
  if (!cv) {
    cv = renderer.charIcon(CHARS[i].model, ICON_PX, locked ? '#aab4c0' : null);
    iconCache.set(key, cv);
  }
  return cv;
}

function paintChars() {
  const owned = store.owned();
  const coins = store.coins();
  charsEl.innerHTML = '';
  CHARS.forEach((ch, i) => {
    const has = owned.includes(i);
    const btn = document.createElement('button');
    btn.className = 'char'
      + (i === game.charIndex && has ? ' on' : '')
      + (has ? '' : ' locked')
      + (i === freshIndex ? ' fresh' : '');
    btn.title = has ? ch.name : '아직 없음';
    const icon = iconFor(i, !has).toDataURL();
    btn.innerHTML = `<img class="swatch" alt="${has ? ch.name : ''}" src="${icon}">`;
    if (has) {
      btn.onclick = () => {
        kick();
        game.charIndex = i;
        store.saveChar(i);
        paintChars();
      };
    }
    charsEl.appendChild(btn);
  });
  $('titleBest').textContent = `최고 기록 ${store.best()}칸 · 코인 ${coins}개`;
  $('dexCount').textContent = `${owned.length} / ${CHARS.length}`;
  const all = owned.length >= CHARS.length;
  gachaBtn.disabled = all || coins < GACHA_COST;
  gachaBtn.innerHTML = all ? '전부 모았다' : `캐릭터 뽑기 <b>${GACHA_COST}</b>코인`;
  freshIndex = -1;
}

// 아직 없는 캐릭터 중에서 하나. 중복이 안 나오니 100코인 = 확실히 새 친구.
function drawChar() {
  kick();
  const owned = store.owned();
  const pool = [];
  for (let i = 0; i < CHARS.length; i += 1) if (!owned.includes(i)) pool.push(i);
  if (!pool.length || !store.spend(GACHA_COST)) return;
  const idx = pool[Math.floor(Math.random() * pool.length)];
  store.addOwned(idx);
  store.saveChar(idx);
  game.charIndex = idx;
  freshIndex = idx;
  $('pickMsg').textContent = `새 친구 · ${CHARS[idx].name}`;
  sound.fanfare();
  paintChars();
  // 새로 뽑은 칸이 보이도록 스크롤
  const el = charsEl.children[idx];
  if (el) el.scrollIntoView({ block: 'nearest' });
}

gachaBtn.onclick = drawChar;

// ---- 버튼 ----

let audioReady = false;
function kick() {
  if (audioReady) return;
  audioReady = true;
  sound.resume();
}

function play() { kick(); hideAll(); game.start(); }
function toTitle() {
  game.state = 'title';
  game.reset();
  $('pickMsg').textContent = '';
  show('title');
  paintChars();
}

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

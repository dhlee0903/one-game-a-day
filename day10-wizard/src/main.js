// 진입점: 게임·렌더러·입력을 연결하고 오버레이(타이틀·레벨업 카드·일시정지)를 다룬다.
// 캔버스 위 숫자는 도트 글꼴로, 한글 문구는 여기 DOM이 맡는다.

import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { STEP_MS, MAX_CATCHUP, RUN_SEC } from './config.js';
import { getBest, mmss } from './storage.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer($('board'));
const overlay = $('overlay');
const levelup = $('levelup');
const cardsEl = $('cards');
const pauseEl = $('pause');
const gearBtn = $('gear');
const bannerEl = $('banner');

const game = new Game({ onState: handleState });

// eslint-disable-next-line no-new
new InputController($('board'), game);

gearBtn.addEventListener('click', () => game.setPaused(true));
$('pResume').addEventListener('click', () => game.setPaused(false));
$('pRestart').addEventListener('click', () => { game.setPaused(false); game.reset(); game.start(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) game.setPaused(true); });

// 개발용 손잡이 — 콘솔에서 상태를 들여다보거나 브라우저 검증 스크립트가 잡는다
window.__game = game;
window.__renderer = renderer;

// F2: 구워진 스프라이트시트를 눈으로 확인한다(개발용)
window.addEventListener('keydown', (e) => {
  if (e.code === 'F2') { renderer.showSheet = !renderer.showSheet; e.preventDefault(); }
});

function showOverlay(title, html, btn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${html}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => { overlay.classList.remove('show'); game.start(); };
}

// 레벨업 — 카드 세 장. 무기 카드에는 실제 스프라이트를 시트에서 잘라 그려 넣는다.
function showCards(choices, level) {
  cardsEl.innerHTML = '';
  choices.forEach((c, i) => {
    const el = document.createElement('button');
    el.className = 'card';
    el.style.setProperty('--c', c.color);
    el.innerHTML = `
      <span class="ic"></span>
      <span class="body">
        <span class="nm">${c.name}<span class="tag">${c.tag}</span></span>
        <span class="ln">${c.line}</span>
      </span>`;
    const ic = el.querySelector('.ic');
    if (c.icon) ic.appendChild(iconCanvas(c.icon));
    else { ic.classList.add('dot'); ic.style.background = c.color; }
    el.onclick = () => game.choose(i);
    cardsEl.appendChild(el);
  });
  $('luLevel').textContent = `LEVEL ${level}`;
  levelup.classList.add('show');
}

function iconCanvas(name) {
  const f = renderer.frames[name];
  const s = 2;
  const cv = document.createElement('canvas');
  cv.width = f.w * s;
  cv.height = f.h * s;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(renderer.sheet, f.x, f.y, f.w, f.h, 0, 0, f.w * s, f.h * s);
  return cv;
}

function handleState(state, p) {
  levelup.classList.toggle('show', state === 'levelup');
  if (state === 'levelup') { showCards(p.choices, p.level); return; }
  if (state === 'playing') { overlay.classList.remove('show'); return; }
  if (state === 'title') return;

  const r = game.result || { best: getBest(), isNewBest: false };
  const line = r.isNewBest ? '<b>신기록</b>' : `최고 ${mmss(r.best)}`;
  if (state === 'clear') {
    showOverlay('ALL CLEAR', `15분 생존 · 처치 ${p.kills}<br>${line}`, '다시 하기');
  } else {
    showOverlay('GAME OVER', `생존 ${mmss(p.sec)} · 처치 ${p.kills}<br>${line}`, '다시 하기');
  }
}

// 고정 타임스텝 — update()는 실제 경과 시간에 맞춰 초당 60회만 돈다.
let acc = 0;
let prev = 0;

function syncChrome() {
  const playing = game.phase === 'playing' && !game.paused;
  pauseEl.classList.toggle('show', game.paused);
  gearBtn.hidden = !playing;
  if (game.bannerT > 0) {
    bannerEl.textContent = game.bannerText;
    bannerEl.classList.add('show');
  } else {
    bannerEl.classList.remove('show');
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  syncChrome();
  if (game.paused || game.phase !== 'playing') {
    acc = 0;
    prev = now;
    renderer.render(game);
    return;
  }
  if (!prev) { prev = now; renderer.render(game); return; }

  const dt = Math.min(now - prev, 250);
  acc += dt;
  prev = now;

  let steps = 0;
  while (acc >= STEP_MS && steps < MAX_CATCHUP) {
    game.update();
    acc -= STEP_MS;
    steps += 1;
  }
  if (steps === MAX_CATCHUP) acc = 0;

  renderer.render(game);
}
requestAnimationFrame(loop);

// 타이틀
const best = getBest();
showOverlay(
  '<span class="title">아케인 서바이벌</span><span class="sub">DAY 10</span>',
  `이동만 하면 된다 · 공격은 자동<br>${RUN_SEC / 60}분을 버티면 승리`
  + `<br><span class="dim">PC: 방향키 · WASD / 모바일: 화면을 끌어서</span>`
  + (best ? `<br><span class="dim">최고 생존 ${mmss(best)}</span>` : ''),
  '시작',
);

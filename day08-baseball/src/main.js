// 진입점: 게임·렌더러·입력을 연결하고, 난이도/도움 토글과 오버레이를 다룬다.

import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { DIGIT_OPTIONS, DEFAULT_DIGITS } from './config.js';
import { getStats } from './storage.js';

const $ = (id) => document.getElementById(id);

const renderer = new Renderer();
const overlay = $('overlay');

// onChange는 Game 생성 중에도 불리므로 인스턴스를 인자로 받는다(TDZ 회피).
const game = new Game({
  onChange: (g) => renderer.render(g),
  onEnd: handleEnd,
  onFeedback: (kind) => renderer.flash(kind),
});

// eslint-disable-next-line no-new
new InputController(game, {
  keypad: $('keypad'),
  ok: $('ok'),
  del: $('del'),
  clear: $('clear'),
  hint: $('hint'),
});

// ---- 난이도 ----
const levelBox = $('levels');
let digits = DEFAULT_DIGITS;
levelBox.innerHTML = DIGIT_OPTIONS
  .map((n) => `<button class="lv${n === DEFAULT_DIGITS ? ' on' : ''}" data-digits="${n}">${n}자리</button>`)
  .join('');
levelBox.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button[data-digits]');
  if (!btn) return;
  e.preventDefault();
  digits = Number(btn.dataset.digits);
  levelBox.querySelectorAll('.lv').forEach((b) => b.classList.toggle('on', b === btn));
  startGame();
});

// ---- 도움(남은 후보 수) ----
const helpBtn = $('help');
let helpOn = false;
helpBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  helpOn = !helpOn;
  helpBtn.classList.toggle('on', helpOn);
  renderer.setHelp(helpOn);
  renderer.render(game);
});

// ---- 오버레이 ----
function showOverlay(title, html, btn, onBtn) {
  overlay.innerHTML = `<h2>${title}</h2><p>${html}</p><button class="btn" id="ovBtn">${btn}</button>`;
  overlay.classList.add('show');
  $('ovBtn').onclick = () => { overlay.classList.remove('show'); onBtn(); };
}

function handleEnd(phase, p) {
  const stats = getStats();
  const rate = stats.plays ? Math.round((stats.wins / stats.plays) * 100) : 0;
  const line = `통산 ${stats.plays}판 · ${stats.wins}승 (${rate}%)`;
  if (phase === 'won') {
    const bestLine = p.isNewBest
      ? `<b>신기록</b> · ${p.tries}회`
      : (p.usedHint ? `${p.tries}회 · 힌트를 써서 기록 제외` : `${p.tries}회 · 최소 ${p.best}회`);
    showOverlay('정답', `정답은 <b>${p.secret}</b><br>${bestLine}<br><span class="dim">${line}</span>`, '다시 하기', startGame);
  } else {
    showOverlay('실패', `정답은 <b>${p.secret}</b><br>${p.digits}자리 · 시도 ${p.tries}회 소진<br><span class="dim">${line}</span>`, '다시 하기', startGame);
  }
}

function startGame() {
  game.newGame(digits);
  renderer.render(game);
}

// 타이틀 화면
renderer.render(game);
showOverlay(
  '<span class="title">숫자야구</span><span class="sub">DAY 08</span>',
  '서로 다른 숫자를 맞히자.<br>자리·숫자 모두 맞으면 <b>S</b>, 숫자만 맞으면 <b>B</b>',
  '시작',
  startGame,
);

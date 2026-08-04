// 읽기 전용 렌더러: 게임 상태를 DOM에 반영한다. 상태를 바꾸지 않는다.

import { formatJudge } from './rules.js';
import { VERSION } from './config.js';

const $ = (id) => document.getElementById(id);

export class Renderer {
  constructor() {
    this.el = {
      slots: $('slots'),
      history: $('history'),
      tries: $('tries'),
      best: $('best'),
      cands: $('cands'),
      candRow: $('candRow'),
      msg: $('msg'),
      hint: $('hint'),
      keypad: $('keypad'),
      ok: $('ok'),
      ver: $('ver'),
    };
    this.el.ver.textContent = VERSION;
    this.helpOn = false;
  }

  setHelp(on) { this.helpOn = on; }

  render(game) {
    this._slots(game);
    this._history(game);
    this._status(game);
    this._keys(game);
  }

  // 입력 슬롯 — 입력한 숫자, 빈 자리, 힌트로 공개된 자리
  _slots(game) {
    const hint = new Map(game.hints.map((h) => [h.index, h.digit]));
    const cells = [];
    for (let i = 0; i < game.digits; i += 1) {
      const ch = game.input[i];
      if (ch) cells.push(`<div class="slot filled">${ch}</div>`);
      else if (hint.has(i)) cells.push(`<div class="slot hinted">${hint.get(i)}</div>`);
      else cells.push('<div class="slot"></div>');
    }
    this.el.slots.innerHTML = cells.join('');
  }

  // 시도 기록 — 최신이 위로
  _history(game) {
    if (!game.guesses.length) {
      this.el.history.innerHTML = '<li class="empty">첫 숫자를 입력해 보자</li>';
      return;
    }
    const rows = game.guesses.map((g, i) => {
      const out = g.strikes === 0 && g.balls === 0;
      const badges = out
        ? '<span class="badge out">아웃</span>'
        : `${g.strikes ? `<span class="badge s">${g.strikes}S</span>` : ''}${g.balls ? `<span class="badge b">${g.balls}B</span>` : ''}`;
      return `<li><span class="no">${i + 1}</span><span class="num">${g.guess}</span><span class="res">${badges}</span></li>`;
    });
    this.el.history.innerHTML = rows.reverse().join('');
  }

  _status(game) {
    this.el.tries.textContent = `${game.triesLeft} / ${game.maxTries}`;
    this.el.best.textContent = game.best > 0 ? `${game.best}회` : '-';
    this.el.candRow.hidden = !this.helpOn;
    if (this.helpOn) this.el.cands.textContent = `${game.candidates.length.toLocaleString()}개`;
    this.el.msg.textContent = game.message;
    this.el.msg.classList.toggle('warn', !!game.message);
  }

  _keys(game) {
    const playing = game.phase === 'playing';
    const used = new Set(game.input);
    this.el.keypad.querySelectorAll('[data-digit]').forEach((btn) => {
      btn.disabled = !playing || used.has(btn.dataset.digit) || game.input.length >= game.digits;
    });
    this.el.ok.disabled = !playing || game.input.length !== game.digits;
    this.el.hint.disabled = !playing || game.hintsLeft <= 0;
    this.el.hint.textContent = game.hintsLeft > 0 ? '힌트' : '힌트 소진';
  }

  // 판정 피드백(짧은 흔들림/점멸) — 상태가 아니라 표현이라 여기서 처리
  flash(kind) {
    const box = this.el.slots;
    box.classList.remove('shake', 'pop');
    void box.offsetWidth; // reflow → 애니메이션 재시작
    box.classList.add(kind === 'bad' ? 'shake' : 'pop');
  }
}

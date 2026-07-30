// DOM rendering: a reusable playing-card element and the Blackjack table.

import { handValue } from './blackjack.js';

export function cardEl(card, faceDown = false) {
  const el = document.createElement('div');
  if (faceDown || !card) {
    el.className = 'card back';
    return el;
  }
  el.className = `card${card.red ? ' red' : ''}`;
  el.innerHTML =
    `<span class="corner tl">${card.rank}<i>${card.suit}</i></span>`
    + `<span class="pip">${card.suit}</span>`
    + `<span class="corner br">${card.rank}<i>${card.suit}</i></span>`;
  return el;
}

function controlsHTML(bj) {
  if (bj.phase === 'bet') {
    if (bj.chips <= 0) return '<button class="btn primary" data-a="refill">칩 리필 (+1000)</button>';
    const chips = [25, 100, 500].map((n) => `<button class="chip" data-a="bet" data-n="${n}">+${n}</button>`).join('');
    return `${chips}
      <button class="chip" data-a="allin">올인</button>
      <button class="chip ghost" data-a="clear">취소</button>
      <button class="btn primary" data-a="deal" ${bj.bet <= 0 ? 'disabled' : ''}>딜 (${bj.bet})</button>`;
  }
  if (bj.phase === 'player') {
    return `<button class="btn" data-a="hit">히트</button>
      <button class="btn" data-a="stand">스탠드</button>
      ${bj.canDouble() ? '<button class="btn" data-a="double">더블</button>' : ''}`;
  }
  if (bj.phase === 'result') {
    return '<button class="btn primary" data-a="next">다음 판</button>';
  }
  return '';
}

// ---- Hold'em (incremental rendering to avoid flicker) ----

function cardMiniEl(card, faceDown) {
  const el = document.createElement('div');
  if (faceDown || !card) { el.className = 'card sm back'; return el; }
  el.className = `card sm${card.red ? ' red' : ''}`;
  el.innerHTML = `<span class="corner tl">${card.rank}<i>${card.suit}</i></span><span class="pip">${card.suit}</span>`;
  return el;
}

const cardKey = (card, faceDown) => (faceDown || !card ? 'back' : card.rank + card.suit);

// Update a card row in place — only add/replace cards that actually changed, so
// unchanged cards keep their DOM element (no re-created flicker or re-animation).
function syncCards(container, cards, faceDownFn) {
  while (container.children.length > cards.length) container.lastChild.remove();
  cards.forEach((c, i) => {
    const fd = faceDownFn ? faceDownFn(i) : false;
    const key = cardKey(c, fd);
    const cur = container.children[i];
    if (cur && cur.dataset.key === key) return;
    const el = cardMiniEl(c, fd);
    el.dataset.key = key;
    if (cur) container.replaceChild(el, cur);
    else container.appendChild(el);
  });
}

function setText(el, val) { if (el.textContent !== val) el.textContent = val; }
function setHTML(el, val) { if (el.dataset.sig !== val) { el.innerHTML = val; el.dataset.sig = val; } }

// A little stack of chip discs whose count/color scales with the amount.
const CHIP_TIERS = [[1500, 'gold'], [700, 'green'], [300, 'blue'], [100, 'red'], [0, 'white']];
function chipStack(amount) {
  if (amount <= 0) return '';
  const tier = (CHIP_TIERS.find(([t]) => amount >= t) || [0, 'white'])[1];
  const n = Math.min(6, 2 + Math.floor(amount / 150));
  let discs = '';
  for (let i = 0; i < n; i += 1) discs += `<span class="chip-disc ${tier}" style="bottom:${i * 4}px"></span>`;
  return `<span class="chip-stack">${discs}</span>`;
}

function holdemControls(g) {
  if (g.stage === 'idle' || g.handOver) {
    return `<button class="btn primary" data-a="next">${g.stage === 'idle' ? '핸드 시작' : '다음 핸드'}</button>`;
  }
  if (!g.isHumanToAct()) return '<span class="waiting">상대 진행 중…</span>';
  const o = g.options();
  let html = '<button class="btn" data-a="fold">폴드</button>';
  html += o.canCheck ? '<button class="btn" data-a="check">체크</button>'
    : `<button class="btn" data-a="call">콜 ${o.toCall}</button>`;
  if (o.canRaise) {
    const potRaise = Math.min(o.maxRaiseTo, g.currentBet + g.pot());
    const opts = [...new Set([o.minRaiseTo, potRaise, o.maxRaiseTo])].filter((v) => v > g.currentBet);
    html += opts.map((v) => `<button class="btn primary" data-a="raise" data-v="${v}">${v >= o.maxRaiseTo ? `올인 ${v}` : `레이즈 ${v}`}</button>`).join('');
  }
  return html;
}

export class HoldemView {
  constructor(els) {
    this.els = els;
    this.seatRefs = [];
    for (let i = 0; i < 3; i += 1) {
      const root = document.createElement('div');
      root.className = 'seat';
      root.innerHTML = '<div class="seat-cards"></div>'
        + '<div class="seat-info"><span class="seat-name"></span><span class="seat-chips"></span></div>'
        + '<div class="seat-bet"></div>';
      this.seatRefs.push({
        root,
        cards: root.querySelector('.seat-cards'),
        name: root.querySelector('.seat-name'),
        chips: root.querySelector('.seat-chips'),
        bet: root.querySelector('.seat-bet'),
      });
      (i === 0 ? els.you : els.seats).appendChild(root);
    }
    this.seatRefs[0].root.classList.add('me');
    this.prevBet = [0, 0, 0];
    this.prevAllIn = [false, false, false];
    this.prevHandOver = true;
  }

  update(g) {
    this.seatRefs.forEach((refs, i) => this._seat(refs, g.players[i], g, i === 0));
    syncCards(this.els.community, g.community, () => false);
    setText(this.els.pot, String(g.pot()));
    const msg = g.message
      + (g.results ? `<div class="showdown">${g.results.map((r) => `${r.name} · ${r.hand}${r.won ? ` (+${r.won})` : ''}`).join('<br>')}</div>` : '');
    setHTML(this.els.msg, msg);
    setHTML(this.els.controls, holdemControls(g));
    this._effects(g);
  }

  // Detect bet increases / all-ins / hand results and spawn transient effects.
  _effects(g) {
    const newHand = !g.handOver && this.prevHandOver;
    g.players.forEach((p, i) => {
      if (!newHand && p.bet > this.prevBet[i]) this._float(i, `+${p.bet - this.prevBet[i]}`);
      this.prevBet[i] = p.bet;
      if (!newHand && p.allIn && !this.prevAllIn[i]) this._allin(i);
      this.prevAllIn[i] = p.allIn;
    });
    if (g.handOver && !this.prevHandOver) {
      const you = g.players[0];
      const won = g.results ? g.results.some((r) => r.name === 'You' && r.won > 0) : !you.folded;
      this._banner(won ? '이겼다!' : '졌다…', won ? 'win' : 'lose');
    }
    this.prevHandOver = g.handOver;
  }

  _float(i, text) {
    const f = document.createElement('div');
    f.className = 'fx-float';
    f.textContent = text;
    this.seatRefs[i].root.appendChild(f);
    setTimeout(() => f.remove(), 850);
  }

  _allin(i) {
    const f = document.createElement('div');
    f.className = 'fx-allin';
    f.textContent = 'ALL IN';
    this.seatRefs[i].root.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }

  _banner(text, cls) {
    if (!this.els.fx) return;
    const b = document.createElement('div');
    b.className = `fx-banner ${cls}`;
    b.textContent = text;
    this.els.fx.appendChild(b);
    setTimeout(() => b.remove(), 1700);
  }

  _seat(refs, p, g, isYou) {
    const bi = g.players.indexOf(p);
    const reveal = isYou || (g.handOver && !p.folded && p.hole);
    syncCards(refs.cards, p.hole || [], () => !reveal);
    const badges = `${bi === g.button ? '<span class="badge">D</span>' : ''}`
      + `${p.folded ? '<span class="badge fold">폴드</span>' : ''}`
      + `${p.allIn ? '<span class="badge allin">올인</span>' : ''}`;
    setHTML(refs.name, `${p.name} ${badges}`);
    setHTML(refs.chips, `${chipStack(p.chips)}<span class="chip-num">${p.chips}</span>`);
    setHTML(refs.bet, p.bet > 0 ? `${chipStack(p.bet)}<span class="bet-num">${p.bet}</span>` : '');
    refs.root.classList.toggle('active', !g.handOver && g.toAct === bi && !p.folded && !p.allIn);
    refs.root.classList.toggle('folded', p.folded);
  }
}

export function renderBlackjack(bj, els) {
  els.dealerCards.innerHTML = '';
  bj.dealer.forEach((c, i) => els.dealerCards.appendChild(cardEl(c, bj.hideHole && i === 1)));
  els.dealerVal.textContent = bj.dealer.length
    ? (bj.hideHole ? handValue([bj.dealer[0]]).total : handValue(bj.dealer).total)
    : '';

  els.playerCards.innerHTML = '';
  bj.player.forEach((c) => els.playerCards.appendChild(cardEl(c)));
  els.playerVal.textContent = bj.player.length ? handValue(bj.player).total : '';

  els.chips.textContent = bj.chips;
  els.bet.textContent = bj.bet;
  els.msg.textContent = bj.message;
  els.msg.className = `msg${bj.outcome ? ` ${bj.outcome}` : ''}`;
  els.controls.innerHTML = controlsHTML(bj);
}

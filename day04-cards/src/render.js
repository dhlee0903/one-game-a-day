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

// ---- Hold'em ----

function cardHTML(card, faceDown = false) {
  if (faceDown || !card) return '<div class="card sm back"></div>';
  return `<div class="card sm${card.red ? ' red' : ''}">`
    + `<span class="corner tl">${card.rank}<i>${card.suit}</i></span>`
    + `<span class="pip">${card.suit}</span></div>`;
}

function seatHTML(p, g, isYou) {
  const bi = g.players.indexOf(p);
  const reveal = isYou || (g.handOver && !p.folded && p.hole);
  const cards = (p.hole || []).map((c) => cardHTML(c, !reveal)).join('');
  const active = !g.handOver && g.toAct === bi && !p.folded && !p.allIn;
  const badges = `${bi === g.button ? '<span class="badge">D</span>' : ''}`
    + `${p.folded ? '<span class="badge fold">폴드</span>' : ''}`
    + `${p.allIn ? '<span class="badge allin">올인</span>' : ''}`;
  const bet = p.bet > 0 ? `<div class="seat-bet">${p.bet}</div>` : '';
  return `<div class="seat${active ? ' active' : ''}${p.folded ? ' folded' : ''}">
      <div class="seat-cards">${cards}</div>
      <div class="seat-info"><span class="seat-name">${p.name} ${badges}</span><span class="seat-chips">${p.chips}</span></div>
      ${bet}
    </div>`;
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

export function renderHoldem(g, els) {
  els.seats.innerHTML = [1, 2].map((i) => seatHTML(g.players[i], g, false)).join('');
  els.you.innerHTML = seatHTML(g.players[0], g, true);
  els.community.innerHTML = Array.from({ length: 5 }, (_, k) => (g.community[k] ? cardHTML(g.community[k]) : '<div class="card sm empty"></div>')).join('');
  els.pot.textContent = g.pot();
  els.msg.innerHTML = g.message
    + (g.results ? `<div class="showdown">${g.results.map((r) => `${r.name} · ${r.hand}${r.won ? ` (+${r.won})` : ''}`).join('<br>')}</div>` : '');
  els.controls.innerHTML = holdemControls(g);
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

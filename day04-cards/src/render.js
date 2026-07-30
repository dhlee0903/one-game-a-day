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

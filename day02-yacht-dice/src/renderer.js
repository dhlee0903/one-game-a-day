// Renders the whole board from game state into the DOM. Reads state only; all
// interaction goes back through the game via input.js. Re-renders fully on each
// change — the board is small, so this stays simple and bug-resistant.

import { CATEGORIES, UPPER_BONUS_THRESHOLD, MAX_ROLLS } from './config.js';
import { scoreFor, upperSum, upperBonus, grandTotal } from './scoring.js';

// Pip positions in a 3x3 grid for each die face.
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export class Renderer {
  constructor(els) {
    this.els = els; // { turn, dice, controls, card }
  }

  render(game) {
    this._renderTurn(game);
    this._renderDice(game);
    this._renderControls(game);
    this._renderCard(game);
  }

  // Update only the turn line (used to show the bot's "thinking" status without
  // re-rendering the dice, which would replay their roll animation).
  setStatus(game, status) {
    this._renderTurn(game, status);
  }

  _renderTurn(game, status = '') {
    const p = game.currentPlayer();
    const rolls = game.rolled ? game.rollsLeft : MAX_ROLLS;
    this.els.turn.innerHTML =
      `<span class="who ${p.isBot ? 'bot' : ''}">${p.name}</span> 차례` +
      `<span class="rolls">남은 굴림 ${rolls}</span>` +
      (status ? `<span class="status">${status}</span>` : '');
  }

  _renderDice(game) {
    this.els.dice.innerHTML = game.dice.map((v, i) => {
      const held = game.held[i];
      const faceUp = game.rolled;
      const rolling = faceUp && game.rolling[i];
      const pips = faceUp
        ? Array.from({ length: 9 }, (_, k) =>
          `<span class="cell${PIPS[v].includes(k) ? ' pip' : ''}"></span>`).join('')
        : '<span class="q">?</span>';
      const cls = `die${held ? ' held' : ''}${faceUp ? '' : ' blank'}${rolling ? ' rolling' : ''}`;
      return `<button class="${cls}" data-die="${i}" ${faceUp ? '' : 'disabled'}>${pips}</button>`;
    }).join('');
  }

  _renderControls(game) {
    const p = game.currentPlayer();
    const canRoll = game.phase === 'playing' && game.rollsLeft > 0 && !p.isBot;
    const label = game.rolled ? `다시 굴리기 (${game.rollsLeft})` : '주사위 굴리기';
    this.els.controls.innerHTML =
      `<button class="roll-btn" ${canRoll ? '' : 'disabled'}>${label}</button>` +
      (game.rolled && !p.isBot ? '<span class="tip">주사위 클릭 = 고정 · 점수칸 클릭 = 확정</span>' : '');
  }

  _renderCard(game) {
    const [p1, p2] = game.players;
    const rows = [];

    const cell = (player, pIndex, cat) => {
      const val = player.scores[cat.id];
      if (val != null) return `<td class="score filled">${val}</td>`;
      const isTurn = pIndex === game.current && !player.isBot
        && game.phase === 'playing' && game.rolled;
      if (isTurn) {
        const preview = scoreFor(cat.id, game.dice);
        return `<td class="score clickable" data-cat="${cat.id}"><span class="preview">${preview}</span></td>`;
      }
      return '<td class="score empty">·</td>';
    };

    const catRow = (cat) => `
      <tr>
        <th class="cat"><span class="label">${cat.label}</span><span class="hint">${cat.hint}</span></th>
        ${cell(p1, 0, cat)}${cell(p2, 1, cat)}
      </tr>`;

    CATEGORIES.filter((c) => c.section === 'upper').forEach((c) => rows.push(catRow(c)));

    // Upper bonus progress row.
    const bonusCell = (pl) => {
      const s = upperSum(pl.scores);
      const got = upperBonus(pl.scores) > 0;
      return `<td class="bonus ${got ? 'got' : ''}">${s}/${UPPER_BONUS_THRESHOLD}${got ? ' +35' : ''}</td>`;
    };
    rows.push(`<tr class="sep">
        <th class="cat"><span class="label">보너스</span><span class="hint">상단 63↑ → +35</span></th>
        ${bonusCell(p1)}${bonusCell(p2)}
      </tr>`);

    CATEGORIES.filter((c) => c.section === 'lower').forEach((c) => rows.push(catRow(c)));

    // Totals.
    const totalCell = (pl, i) =>
      `<td class="total ${i === game.current ? 'active' : ''}">${grandTotal(pl.scores)}</td>`;
    rows.push(`<tr class="total-row">
        <th class="cat"><span class="label">합계</span></th>
        ${totalCell(p1, 0)}${totalCell(p2, 1)}
      </tr>`);

    const head = (pl, i) =>
      `<th class="pname ${i === game.current ? 'active' : ''} ${pl.isBot ? 'bot' : ''}">${pl.name}</th>`;

    this.els.card.innerHTML = `
      <table>
        <thead><tr><th></th>${head(p1, 0)}${head(p2, 1)}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>`;
  }
}

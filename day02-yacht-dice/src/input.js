// Delegated event handling for the in-game board: roll button, holding dice,
// and committing a category. Only translates clicks into game commands.

export class InputController {
  constructor(game, els) {
    els.controls.addEventListener('click', (e) => {
      if (e.target.closest('.roll-btn')) game.roll();
      else if (e.target.closest('.confirm-yes')) game.confirm();
      else if (e.target.closest('.confirm-no')) game.cancelSelect();
    });

    els.dice.addEventListener('click', (e) => {
      const die = e.target.closest('.die');
      if (die && die.dataset.die != null) game.toggleHold(Number(die.dataset.die));
    });

    // First click selects a category (shows the confirm bar); a second click on
    // the same one confirms — guards against accidentally burning a category.
    els.card.addEventListener('click', (e) => {
      const cell = e.target.closest('.clickable');
      if (cell && cell.dataset.cat) game.select(cell.dataset.cat);
    });

    this._bindKeyboard(game);
  }

  // Space/R roll · 1-5 hold · ↑↓ move category cursor · Enter select/confirm · Esc cancel.
  _bindKeyboard(game) {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return; // don't hijack the name fields
      const k = e.key;
      if (k === ' ' || k === 'r' || k === 'R') { e.preventDefault(); game.roll(); }
      else if (k >= '1' && k <= '5') { game.toggleHold(Number(k) - 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); game.moveCursor(-1); }
      else if (k === 'ArrowDown') { e.preventDefault(); game.moveCursor(1); }
      else if (k === 'Enter') { e.preventDefault(); game.enter(); }
      else if (k === 'Escape') { game.cancelSelect(); }
    });
  }
}

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
  }
}

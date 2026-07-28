// Delegated event handling for the in-game board: roll button, holding dice,
// and committing a category. Only translates clicks into game commands.

export class InputController {
  constructor(game, els) {
    els.controls.addEventListener('click', (e) => {
      if (e.target.closest('.roll-btn')) game.roll();
    });

    els.dice.addEventListener('click', (e) => {
      const die = e.target.closest('.die');
      if (die && die.dataset.die != null) game.toggleHold(Number(die.dataset.die));
    });

    els.card.addEventListener('click', (e) => {
      const cell = e.target.closest('.clickable');
      if (cell && cell.dataset.cat) game.choose(cell.dataset.cat);
    });
  }
}

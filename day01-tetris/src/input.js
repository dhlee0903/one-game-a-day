// Translates raw keyboard and touch events into semantic game commands.
// It only calls the game's public methods, so control schemes can change
// without touching game logic.

export class InputController {
  constructor(game, boardCanvas, touchEl) {
    this.game = game;
    this.boardCanvas = boardCanvas;
    this.touchEl = touchEl;
    this._bindKeyboard();
    this._bindTouchButtons();
    this._bindSwipe();
  }

  _bindKeyboard() {
    const { game } = this;
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'p' || e.key === 'P') return game.togglePause();

      switch (e.key) {
        case 'ArrowLeft': game.moveLeft(); break;
        case 'ArrowRight': game.moveRight(); break;
        case 'ArrowDown': game.softDrop(); break;
        case 'ArrowUp':
        case 'x':
        case 'X': game.rotate(1); break;
        case 'z':
        case 'Z': game.rotate(-1); break;
        case 'c':
        case 'C': game.hold(); break;
        case ' ': game.hardDrop(); break;
        default: break;
      }
    });
  }

  _bindTouchButtons() {
    if (!this.touchEl) return;
    const { game } = this;
    const actions = {
      left: () => game.moveLeft(),
      right: () => game.moveRight(),
      down: () => game.softDrop(),
      rotate: () => game.rotate(1),
      drop: () => game.hardDrop(),
      hold: () => game.hold(),
    };
    this.touchEl.addEventListener('click', (e) => {
      const action = actions[e.target.dataset.a];
      if (action) action();
    });
  }

  // Swipe left/right to move, swipe down to soft/hard drop, tap to rotate.
  _bindSwipe() {
    const { game } = this;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    this.boardCanvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = e.timeStamp;
    }, { passive: true });

    this.boardCanvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = e.timeStamp - startT;

      if (Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 250) {
        game.rotate(1);
      } else if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) game.moveRight();
        else game.moveLeft();
      } else if (dy > 0) {
        if (dt < 200) game.hardDrop();
        else game.softDrop();
      }
    }, { passive: true });
  }
}

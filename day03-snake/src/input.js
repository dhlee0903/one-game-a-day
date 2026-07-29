// Keyboard (arrows / WASD), pause keys, and touch-swipe → game commands.

import { DIRS } from './config.js';

const KEY_DIRS = {
  ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right,
  w: DIRS.up, s: DIRS.down, a: DIRS.left, d: DIRS.right,
  W: DIRS.up, S: DIRS.down, A: DIRS.left, D: DIRS.right,
};

export class InputController {
  constructor(game, canvas, { onStartKey } = {}) {
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (game.phase === 'ready' || game.phase === 'over') onStartKey?.();
        else game.togglePause();
        return;
      }
      if (e.key === 'p' || e.key === 'P') { game.togglePause(); return; }
      const dir = KEY_DIRS[e.key];
      if (dir) { e.preventDefault(); game.setDir(dir); }
    });

    this._bindSwipe(game, canvas);
  }

  _bindSwipe(game, canvas) {
    let sx = 0;
    let sy = 0;
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (Math.abs(dx) > Math.abs(dy)) game.setDir(dx > 0 ? DIRS.right : DIRS.left);
      else game.setDir(dy > 0 ? DIRS.down : DIRS.up);
    }, { passive: true });
  }
}

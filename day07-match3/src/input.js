// Pointer input on the board canvas: tap a gem then a neighbour to swap, or
// drag a gem toward a neighbour. Touch never scrolls the page.

import { BOARD_W, BOARD_H } from './config.js';

export class InputController {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.start = null;

    const toBoard = (e) => {
      const rect = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
      return {
        x: (p.clientX - rect.left) * (BOARD_W / rect.width),
        y: (p.clientY - rect.top) * (BOARD_H / rect.height),
      };
    };

    const down = (e) => {
      e.preventDefault();
      const b = toBoard(e);
      const cell = game.cellAt(b.x, b.y);
      this.start = cell ? { cell, x: b.x, y: b.y } : null;
    };

    const up = (e) => {
      e.preventDefault();
      if (!this.start) return;
      const b = toBoard(e);
      const dx = b.x - this.start.x; const dy = b.y - this.start.y;
      const cell = this.start.cell;
      this.start = null;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        game.click(cell); // tap
        return;
      }
      // drag → swap with the neighbour in the dominant direction
      let nr = cell.r; let nc = cell.c;
      if (Math.abs(dx) > Math.abs(dy)) nc += dx > 0 ? 1 : -1;
      else nr += dy > 0 ? 1 : -1;
      game.selected = null;
      game.trySwap(cell, { r: nr, c: nc });
    };

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }
}

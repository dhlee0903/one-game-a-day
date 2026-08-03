// Pointer input on the board canvas: tap a gem then a neighbour to swap, or
// drag a gem toward a neighbour. Touch never scrolls the page.

import { CANVAS_W, CANVAS_H } from './config.js';

export class InputController {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.start = null;
    this.lastTap = null; // for double-tap detection

    const toBoard = (e) => {
      const rect = canvas.getBoundingClientRect();
      // touchend carries the point in changedTouches (e.touches is empty there),
      // so prefer changedTouches. Map screen → canvas pixels (canvas is the full
      // HUD + board size, not just the board).
      const p = (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
        : (e.touches && e.touches.length) ? e.touches[0] : e;
      return {
        x: (p.clientX - rect.left) * (CANVAS_W / rect.width),
        y: (p.clientY - rect.top) * (CANVAS_H / rect.height),
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
        // tap — detect a double-tap on the same cell to detonate a special
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        const lt = this.lastTap;
        if (lt && now - lt.t < 320 && lt.r === cell.r && lt.c === cell.c) {
          this.lastTap = null;
          const g = game.board.at(cell.r, cell.c);
          if (g && g.special) { game.activateSpecial(cell); return; }
          game.click(cell); // normal (toggles selection off)
          return;
        }
        this.lastTap = { r: cell.r, c: cell.c, t: now };
        game.click(cell);
        return;
      }
      // drag → swap with the neighbour in the dominant direction
      this.lastTap = null;
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

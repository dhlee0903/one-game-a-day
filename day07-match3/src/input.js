// Pointer input on the board canvas — Pointer Events unify mouse / touch / pen,
// which avoids the touch-list pitfalls (touchend carries its point in
// changedTouches, not touches) that broke mobile swiping. Tap a gem then a
// neighbour to swap, drag a gem toward a neighbour, or double-tap a special to
// detonate it. Touch never scrolls the page (touch-action: none + preventDefault).

import { CANVAS_W, CANVAS_H } from './config.js';

export class InputController {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.start = null;
    this.lastTap = null;

    const toBoard = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
        y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
      };
    };

    const down = (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const b = toBoard(e);
      const cell = game.cellAt(b.x, b.y);
      this.start = cell ? { cell, x: b.x, y: b.y } : null;
      if (game.armed) game.setPreview(cell); // show the item's range at the target
    };

    // hover (mouse) or drag (touch) shows the armed item's affected range
    const move = (e) => {
      if (!game.armed) return;
      const b = toBoard(e);
      game.setPreview(game.cellAt(b.x, b.y));
    };

    const up = (e) => {
      e.preventDefault();
      if (!this.start) return;
      const b = toBoard(e);
      const dx = b.x - this.start.x; const dy = b.y - this.start.y;
      const cell = this.start.cell;
      this.start = null;

      // an armed active item consumes the next board tap as its target
      if (game.armed) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) game.applyItemAt(cell);
        else game.cancelArm();
        return;
      }

      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        const lt = this.lastTap;
        if (lt && now - lt.t < 320 && lt.r === cell.r && lt.c === cell.c) {
          this.lastTap = null;
          const g = game.board.at(cell.r, cell.c);
          if (g && g.special) { game.activateSpecial(cell); return; }
          game.click(cell);
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

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', () => { if (game.armed) game.setPreview(null); });
    canvas.addEventListener('pointercancel', () => { this.start = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

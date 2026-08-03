// Read-only renderer. Draws the checkered board, gems with per-type shapes,
// special-block decorations (row/col stripes, bomb, rainbow), the selection
// highlight, and the shrink-out animation for clearing gems.

import {
  COLS, ROWS, CELL, PAD, BOARD_W, BOARD_H, SP, GEM_COLORS, UI,
} from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = BOARD_W * dpr;
    canvas.height = BOARD_H * dpr;
    this.ctx.scale(dpr, dpr);
  }

  render(game) {
    const c = this.ctx;
    c.clearRect(0, 0, BOARD_W, BOARD_H);
    this._board(c, game);
    this._gems(c, game);
    this._clearing(c, game);
  }

  _board(c, game) {
    c.fillStyle = UI.bg;
    this._round(c, 0, 0, BOARD_W, BOARD_H, 16); c.fill();
    for (let r = 0; r < ROWS; r += 1) {
      for (let col = 0; col < COLS; col += 1) {
        c.fillStyle = (r + col) % 2 ? UI.cell1 : UI.cell0;
        c.fillRect(PAD + col * CELL, PAD + r * CELL, CELL, CELL);
      }
    }
    // selection highlight
    if (game.selected) {
      const { r, c: col } = game.selected;
      c.strokeStyle = UI.select; c.lineWidth = 3;
      this._round(c, PAD + col * CELL + 2, PAD + r * CELL + 2, CELL - 4, CELL - 4, 10); c.stroke();
    }
  }

  _gems(c, game) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const g = game.board.grid[r][col];
        if (g) this.drawGem(c, g.x, g.y, g.color, g.special, 1, 1);
      }
    }
  }

  _clearing(c, game) {
    for (const cl of game.clearing) {
      const k = 1 - cl.t / 10;
      this.drawGem(c, cl.gem.x, cl.gem.y, cl.gem.color, cl.gem.special, 0.4 + k * 0.6, k);
    }
  }

  // Draw a gem whose cell top-left is (x, y).
  drawGem(c, x, y, color, special, scale, alpha) {
    const s = (CELL - 10) * scale;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const left = cx - s / 2;
    const top = cy - s / 2;
    c.globalAlpha = alpha;

    if (color < 0) {
      this._rainbow(c, cx, cy, s / 2);
    } else {
      const g = GEM_COLORS[color];
      const grad = c.createLinearGradient(left, top, left, top + s);
      grad.addColorStop(0, g.light);
      grad.addColorStop(0.5, g.base);
      grad.addColorStop(1, g.dark);
      c.fillStyle = grad;
      this._round(c, left, top, s, s, s * 0.28); c.fill();
      // glossy highlight
      c.fillStyle = 'rgba(255,255,255,.28)';
      this._round(c, left + s * 0.16, top + s * 0.12, s * 0.5, s * 0.28, s * 0.14); c.fill();
    }

    // special decorations
    if (special === SP.ROW || special === SP.COL) {
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.5; c.lineCap = 'round';
      const n = 3;
      for (let i = 0; i < n; i += 1) {
        const o = (i - (n - 1) / 2) * (s * 0.22);
        c.beginPath();
        if (special === SP.ROW) { c.moveTo(left + s * 0.14, cy + o); c.lineTo(left + s * 0.86, cy + o); } else { c.moveTo(cx + o, top + s * 0.14); c.lineTo(cx + o, top + s * 0.86); }
        c.stroke();
      }
    } else if (special === SP.BOMB) {
      c.fillStyle = 'rgba(0,0,0,.55)';
      c.beginPath(); c.arc(cx, cy, s * 0.24, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.92)';
      c.font = `800 ${Math.round(s * 0.34)}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✦', cx, cy + 1);
      c.textAlign = 'left';
    }

    c.globalAlpha = 1;
  }

  _rainbow(c, cx, cy, r) {
    const cols = ['#ff5a63', '#ffb03a', '#3fce6a', '#3aa0ff', '#a566ff', '#ff5fae'];
    for (let i = 0; i < cols.length; i += 1) {
      c.fillStyle = cols[i];
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, r, (i / cols.length) * Math.PI * 2 - Math.PI / 2, ((i + 1) / cols.length) * Math.PI * 2 - Math.PI / 2);
      c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.arc(cx, cy, r * 0.32, 0, Math.PI * 2); c.fill();
  }

  _round(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }
}

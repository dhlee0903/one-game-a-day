// Read-only renderer. Draws the in-canvas HUD (stage / score / progress /
// moves), the checkered board, gems with per-type shapes and special-block
// decorations, the selection highlight, clearing shrink-out, and the clear /
// special-activation effects (pop, line beam, bomb ring, rainbow flash).

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_W, BOARD_H, CANVAS_W, CANVAS_H,
  SP, GEM_COLORS, UI,
} from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    this.ctx.scale(dpr, dpr);
  }

  render(game) {
    const c = this.ctx;
    c.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this._hud(c, game);

    // clip everything else to the board region below the HUD
    c.save();
    this._round(c, 0, HUD_H, BOARD_W, BOARD_H, 16); c.clip();
    this._board(c, game);
    this._gems(c, game);
    this._clearing(c, game);
    this._effects(c, game);
    c.restore();
  }

  // ---- HUD ----

  _hud(c, game) {
    const w = CANVAS_W;
    c.textBaseline = 'alphabetic';
    // stage + moves on the top line
    c.font = '700 14px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = UI.dim; c.fillText('STAGE', 16, 22);
    c.fillStyle = UI.text; c.fillText(String(game.stageIndex + 1), 16 + c.measureText('STAGE').width + 8, 22);
    c.textAlign = 'right';
    c.fillStyle = game.movesLeft <= 5 ? '#ff6b74' : UI.text;
    c.fillText(String(game.movesLeft), w - 16, 22);
    c.fillStyle = UI.dim; c.fillText('MOVES', w - 16 - c.measureText(String(game.movesLeft)).width - 8, 22);

    // big score, centred
    c.textAlign = 'center';
    c.fillStyle = UI.text;
    c.font = '800 30px "Segoe UI", system-ui, sans-serif';
    c.fillText(String(game.score), w / 2, 52);

    // progress bar toward the stage target
    const bx = 56; const bw = w - 112; const by = 64; const bh = 8;
    c.fillStyle = '#0e1626';
    this._round(c, bx, by, bw, bh, 4); c.fill();
    const p = Math.max(0, Math.min(1, game.score / game.target));
    if (p > 0) {
      const grad = c.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#3fce6a'); grad.addColorStop(1, '#ffd23f');
      c.fillStyle = grad;
      this._round(c, bx, by, Math.max(bh, bw * p), bh, 4); c.fill();
    }
    c.font = '600 11px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = UI.dim;
    c.fillText(`목표 ${game.target}`, w / 2, 82);
    c.textAlign = 'left';
  }

  // ---- board / gems ----

  _board(c, game) {
    c.fillStyle = UI.bg;
    this._round(c, 0, HUD_H, BOARD_W, BOARD_H, 16); c.fill();
    for (let r = 0; r < ROWS; r += 1) {
      for (let col = 0; col < COLS; col += 1) {
        c.fillStyle = (r + col) % 2 ? UI.cell1 : UI.cell0;
        c.fillRect(PAD + col * CELL, HUD_H + PAD + r * CELL, CELL, CELL);
      }
    }
    if (game.selected) {
      const { r, c: col } = game.selected;
      c.strokeStyle = UI.select; c.lineWidth = 3;
      this._round(c, PAD + col * CELL + 2, HUD_H + PAD + r * CELL + 2, CELL - 4, CELL - 4, 10); c.stroke();
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
      c.fillStyle = 'rgba(255,255,255,.28)';
      this._round(c, left + s * 0.16, top + s * 0.12, s * 0.5, s * 0.28, s * 0.14); c.fill();
    }

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
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
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

  // ---- effects ----

  _effects(c, game) {
    for (const fx of game.effects) {
      const p = fx.t / fx.life; // 0..1
      if (fx.type === 'pop') {
        const g = fx.color >= 0 ? GEM_COLORS[fx.color].light : '#ffffff';
        c.strokeStyle = g; c.globalAlpha = (1 - p) * 0.9; c.lineWidth = 3;
        c.beginPath(); c.arc(fx.x, fx.y, 6 + p * 20, 0, Math.PI * 2); c.stroke();
      } else if (fx.type === 'beam') {
        const col = fx.color >= 0 ? GEM_COLORS[fx.color].light : '#ffffff';
        c.globalAlpha = (1 - p) * 0.85;
        c.fillStyle = col;
        const thick = (1 - p) * CELL * 0.9 + 4;
        if (fx.axis === 'row') {
          const y = HUD_H + PAD + fx.r * CELL + CELL / 2;
          c.fillRect(PAD, y - thick / 2, COLS * CELL, thick);
        } else {
          const x = PAD + fx.c * CELL + CELL / 2;
          c.fillRect(x - thick / 2, HUD_H + PAD, thick, ROWS * CELL);
        }
      } else if (fx.type === 'ring') {
        const col = fx.color >= 0 ? GEM_COLORS[fx.color].light : '#ffffff';
        c.strokeStyle = col; c.globalAlpha = (1 - p) * 0.9; c.lineWidth = 4 + (1 - p) * 6;
        c.beginPath(); c.arc(fx.x, fx.y, p * CELL * 2.2, 0, Math.PI * 2); c.stroke();
      } else if (fx.type === 'flash') {
        c.globalAlpha = Math.sin(p * Math.PI) * 0.5;
        const grad = c.createLinearGradient(0, HUD_H, BOARD_W, HUD_H + BOARD_H);
        grad.addColorStop(0, '#ff5a63'); grad.addColorStop(0.5, '#3aa0ff'); grad.addColorStop(1, '#a566ff');
        c.fillStyle = grad;
        c.fillRect(0, HUD_H, BOARD_W, BOARD_H);
      }
      c.globalAlpha = 1;
    }
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

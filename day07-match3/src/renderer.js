// Read-only renderer. Draws the in-canvas HUD (stage / score / progress /
// moves), the checkered board, gems with per-type shapes and special-block
// decorations, the selection highlight, clearing shrink-out, and the clear /
// special-activation effects (pop, line beam, bomb ring, rainbow flash).

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_W, BOARD_H, CANVAS_W, CANVAS_H,
  SP, GEM_COLORS, UI, VERSION,
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
    this._hint(c, game);
    this._clearing(c, game);
    this._effects(c, game);
    c.restore();

    // small build tag so the live version is identifiable at a glance
    c.font = '600 10px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = 'rgba(143,160,181,.55)';
    c.textAlign = 'right'; c.textBaseline = 'alphabetic';
    c.fillText(VERSION, CANVAS_W - 8, CANVAS_H - 7);
    c.textAlign = 'left';
  }

  // ---- HUD ----

  _hud(c, game) {
    const w = CANVAS_W;
    // HUD panel
    c.fillStyle = '#101725';
    this._round(c, 4, 4, w - 8, HUD_H - 8, 14); c.fill();

    // stage / moves pills
    this._pill(c, 12, 11, 'STAGE', String(game.stageIndex + 1), false, false);
    this._pill(c, w - 12, 11, 'MOVES', String(game.movesLeft), game.movesLeft <= 5, true);

    // big score, centred
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = UI.text;
    c.font = '800 30px "Segoe UI", system-ui, sans-serif';
    c.fillText(String(game.score), w / 2, 52);

    // progress bar toward the stage target
    const bx = 56; const bw = w - 112; const by = 62; const bh = 9;
    c.fillStyle = '#0a1120';
    this._round(c, bx, by, bw, bh, 5); c.fill();
    const p = Math.max(0, Math.min(1, game.score / game.target));
    if (p > 0) {
      const grad = c.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#3fce6a'); grad.addColorStop(1, '#ffd23f');
      c.fillStyle = grad;
      c.shadowColor = 'rgba(255,210,63,.4)'; c.shadowBlur = 6;
      this._round(c, bx, by, Math.max(bh, bw * p), bh, 5); c.fill();
      c.shadowBlur = 0;
    }
    c.font = '600 11px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = UI.dim; c.textAlign = 'center';
    c.fillText(`목표 ${game.target}`, w / 2, 80);
    c.textAlign = 'left';
  }

  // label+value rounded pill; anchored at x (left) or right edge if rightAlign
  _pill(c, x, y, label, val, danger, rightAlign) {
    const h = 26;
    c.font = '700 12px "Segoe UI", system-ui, sans-serif';
    const lw = c.measureText(label).width;
    c.font = '800 15px "Segoe UI", system-ui, sans-serif';
    const vw = c.measureText(val).width;
    const padX = 11; const gap = 6;
    const pw = padX * 2 + lw + gap + vw;
    const px = rightAlign ? x - pw : x;
    c.fillStyle = '#1a2536';
    this._round(c, px, y, pw, h, 13); c.fill();
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = '700 12px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = UI.dim; c.fillText(label, px + padX, y + h / 2 + 1);
    c.font = '800 15px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = danger ? '#ff6b74' : UI.text; c.fillText(val, px + padX + lw + gap, y + h / 2 + 1);
    c.textBaseline = 'alphabetic';
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

  _hint(c, game) {
    if (!game.hint) return;
    const a = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(game.tick * 0.16));
    c.strokeStyle = `rgba(255,210,63,${a})`;
    c.lineWidth = 3;
    for (const p of [game.hint.a, game.hint.b]) {
      this._round(c, PAD + p.c * CELL + 3, HUD_H + PAD + p.r * CELL + 3, CELL - 6, CELL - 6, 10);
      c.stroke();
    }
  }

  _clearing(c, game) {
    for (const cl of game.clearing) {
      const k = Math.max(0, 1 - cl.t / 16);
      // dead = true → the monster shows its dying face as it shrinks away
      this.drawGem(c, cl.gem.x, cl.gem.y, cl.gem.color, cl.gem.special, 0.5 + k * 0.5, k, true);
    }
  }

  drawGem(c, x, y, color, special, scale, alpha, dead = false) {
    const s = (CELL - 8) * scale;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const left = cx - s / 2;
    const top = cy - s / 2;
    c.globalAlpha = alpha;

    if (color < 0) {
      this._rainbow(c, cx, cy, s / 2);
      this._special(c, special, left, top, s, cx, cy);
      c.globalAlpha = 1;
      return;
    }

    const m = GEM_COLORS[color];
    const grad = c.createLinearGradient(left, top, left, top + s);
    grad.addColorStop(0, m.light);
    grad.addColorStop(0.55, m.base);
    grad.addColorStop(1, m.dark);
    c.fillStyle = grad;
    this._round(c, left, top, s, s, s * 0.3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)';
    this._round(c, left + s * 0.16, top + s * 0.1, s * 0.5, s * 0.24, s * 0.12); c.fill();

    this._features(c, m, left, top, s);
    this._face(c, m.kind, left, top, s, dead);
    this._special(c, special, left, top, s, cx, cy);
    c.globalAlpha = 1;
  }

  // special-block overlay (row/col stripes, bomb, drawn over the monster)
  _special(c, special, left, top, s, cx, cy) {
    if (special === SP.ROW || special === SP.COL) {
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = 0; i < 3; i += 1) {
        const o = (i - 1) * (s * 0.34);
        c.beginPath();
        if (special === SP.ROW) { c.moveTo(left + s * 0.1, cy + o); c.lineTo(left + s * 0.9, cy + o); } else { c.moveTo(cx + o, top + s * 0.1); c.lineTo(cx + o, top + s * 0.9); }
        c.stroke();
      }
    } else if (special === SP.BOMB) {
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5;
      this._round(c, left + s * 0.06, top + s * 0.06, s * 0.88, s * 0.88, s * 0.28); c.stroke();
      c.fillStyle = '#fff';
      c.font = `800 ${Math.round(s * 0.24)}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('✦', left + s * 0.82, top + s * 0.18);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    }
  }

  // per-monster silhouette accents (horns, stem, drips, stitches)
  _features(c, m, left, top, s) {
    const cx = left + s / 2;
    const k = m.kind;
    if (k === 'demon') {
      c.fillStyle = m.dark;
      c.beginPath(); c.moveTo(left + s * 0.1, top + s * 0.18); c.lineTo(left + s * 0.3, top - s * 0.02); c.lineTo(left + s * 0.36, top + s * 0.2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(left + s * 0.9, top + s * 0.18); c.lineTo(left + s * 0.7, top - s * 0.02); c.lineTo(left + s * 0.64, top + s * 0.2); c.closePath(); c.fill();
    } else if (k === 'pumpkin') {
      c.fillStyle = '#5f7d2e';
      this._round(c, cx - s * 0.06, top - s * 0.08, s * 0.12, s * 0.16, s * 0.04); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.1)'; c.lineWidth = Math.max(1, s * 0.045);
      c.beginPath(); c.arc(cx, top + s * 0.5, s * 0.3, -1.1, 1.1); c.stroke();
      c.beginPath(); c.arc(cx, top + s * 0.5, s * 0.13, -1.2, 1.2); c.stroke();
    } else if (k === 'slime') {
      c.fillStyle = m.base;
      c.beginPath(); c.arc(left + s * 0.32, top + s * 0.98, s * 0.09, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(left + s * 0.7, top + s * 1.0, s * 0.07, 0, Math.PI * 2); c.fill();
    } else if (k === 'zombie') {
      c.fillStyle = 'rgba(0,0,0,.1)';
      c.beginPath(); c.arc(left + s * 0.26, top + s * 0.28, s * 0.12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = m.dark; c.lineWidth = Math.max(1, s * 0.03);
      const sx = left + s * 0.76; const y0 = top + s * 0.48; const y1 = top + s * 0.66;
      c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx, y1); c.stroke();
      for (const yy of [y0 + (y1 - y0) * 0.3, y0 + (y1 - y0) * 0.7]) { c.beginPath(); c.moveTo(sx - s * 0.05, yy); c.lineTo(sx + s * 0.05, yy); c.stroke(); }
    }
  }

  // monster face — alive (per kind) or dying (X eyes + tongue) when dead
  _face(c, kind, left, top, s, dead) {
    const cx = left + s / 2;
    const eyeY = top + s * 0.44;
    const gap = s * 0.2;
    const lx = cx - gap; const rx = cx + gap;

    if (dead) {
      this._xEye(c, lx, eyeY, s * 0.12);
      this._xEye(c, rx, eyeY, s * 0.12);
      c.fillStyle = '#3a1020';
      c.beginPath(); c.ellipse(cx, top + s * 0.74, s * 0.13, s * 0.15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff6b8a';
      c.beginPath(); c.ellipse(cx, top + s * 0.82, s * 0.08, s * 0.06, 0, 0, Math.PI * 2); c.fill();
      return;
    }

    if (kind === 'skeleton') {
      c.fillStyle = '#2a2f3a';
      c.beginPath(); c.arc(lx, eyeY, s * 0.14, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(rx, eyeY, s * 0.14, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)';
      c.beginPath(); c.arc(lx + s * 0.02, eyeY, s * 0.045, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(rx + s * 0.02, eyeY, s * 0.045, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2f3a';
      c.beginPath(); c.moveTo(cx, eyeY + s * 0.12); c.lineTo(cx - s * 0.05, eyeY + s * 0.22); c.lineTo(cx + s * 0.05, eyeY + s * 0.22); c.closePath(); c.fill();
      const mw = s * 0.36; const mx = cx - mw / 2; const my = top + s * 0.72; const mh = s * 0.12;
      c.fillStyle = '#2a2f3a'; c.fillRect(mx, my, mw, mh);
      c.strokeStyle = '#e7edf4'; c.lineWidth = Math.max(1, s * 0.03);
      for (let i = 1; i < 4; i += 1) { const xx = mx + (mw * i) / 4; c.beginPath(); c.moveTo(xx, my); c.lineTo(xx, my + mh); c.stroke(); }
      return;
    }
    if (kind === 'pumpkin') {
      c.fillStyle = '#3a2410';
      const eye = (ex) => { c.beginPath(); c.moveTo(ex - s * 0.1, eyeY + s * 0.06); c.lineTo(ex + s * 0.1, eyeY + s * 0.06); c.lineTo(ex, eyeY - s * 0.09); c.closePath(); c.fill(); };
      eye(lx); eye(rx);
      const mw = s * 0.5; const mx = cx - mw / 2; const my = top + s * 0.68; const steps = 6;
      c.beginPath(); c.moveTo(mx, my);
      for (let i = 0; i <= steps; i += 1) c.lineTo(mx + (mw * i) / steps, my + (i % 2 ? s * 0.12 : 0));
      for (let i = steps; i >= 0; i -= 1) c.lineTo(mx + (mw * i) / steps, my + s * 0.05 + (i % 2 ? 0 : s * 0.1));
      c.closePath(); c.fill();
      return;
    }
    if (kind === 'ghost') {
      c.fillStyle = '#2a2440';
      c.beginPath(); c.ellipse(lx, eyeY, s * 0.09, s * 0.13, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(rx, eyeY, s * 0.09, s * 0.13, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx, top + s * 0.72, s * 0.08, s * 0.1, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    if (kind === 'demon') {
      this._roundEye(c, lx, eyeY, s * 0.12, '#ffe14d');
      this._roundEye(c, rx, eyeY, s * 0.12, '#ffe14d');
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(1.5, s * 0.05); c.lineCap = 'round';
      c.beginPath(); c.moveTo(lx - s * 0.1, eyeY - s * 0.17); c.lineTo(lx + s * 0.1, eyeY - s * 0.06); c.stroke();
      c.beginPath(); c.moveTo(rx + s * 0.1, eyeY - s * 0.17); c.lineTo(rx - s * 0.1, eyeY - s * 0.06); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(1.5, s * 0.045);
      c.beginPath(); c.arc(cx, top + s * 0.64, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(cx - s * 0.09, top + s * 0.72); c.lineTo(cx - s * 0.03, top + s * 0.72); c.lineTo(cx - s * 0.06, top + s * 0.82); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + s * 0.09, top + s * 0.72); c.lineTo(cx + s * 0.03, top + s * 0.72); c.lineTo(cx + s * 0.06, top + s * 0.82); c.closePath(); c.fill();
      return;
    }
    if (kind === 'zombie') {
      this._roundEye(c, lx, eyeY + s * 0.02, s * 0.14, '#fff');
      this._roundEye(c, rx, eyeY, s * 0.1, '#fff');
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(1.5, s * 0.045); c.lineCap = 'round';
      const my = top + s * 0.72; const mw = s * 0.34;
      c.beginPath();
      c.moveTo(cx - mw / 2, my);
      c.lineTo(cx - mw / 6, my + s * 0.06); c.lineTo(cx + mw / 6, my - s * 0.02); c.lineTo(cx + mw / 2, my + s * 0.05);
      c.stroke();
      return;
    }
    // slime (default): big shiny eyes + tiny smile
    this._roundEye(c, lx, eyeY, s * 0.15, '#fff');
    this._roundEye(c, rx, eyeY, s * 0.15, '#fff');
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(1.5, s * 0.04); c.lineCap = 'round';
    c.beginPath(); c.arc(cx, top + s * 0.7, s * 0.08, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
  }

  _roundEye(c, ex, ey, r, sclera) {
    c.fillStyle = sclera || '#fff';
    c.beginPath(); c.arc(ex, ey, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a2230';
    c.beginPath(); c.arc(ex + r * 0.12, ey + r * 0.1, r * 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.beginPath(); c.arc(ex - r * 0.22, ey - r * 0.25, r * 0.22, 0, Math.PI * 2); c.fill();
  }

  _xEye(c, ex, ey, r) {
    c.strokeStyle = '#1a2230'; c.lineWidth = Math.max(1.5, r * 0.55); c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ex - r, ey - r); c.lineTo(ex + r, ey + r);
    c.moveTo(ex + r, ey - r); c.lineTo(ex - r, ey + r);
    c.stroke();
  }

  _rainbow(c, cx, cy, r) {
    const cols = ['#4cc85a', '#e7edf4', '#ff4d44', '#38a1ff', '#b06bff', '#ff9a2e'];
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
      } else if (fx.type === 'combo') {
        const pop = p < 0.28 ? p / 0.28 : 1;
        const alpha = p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.4);
        const cx = BOARD_W / 2; const cy = HUD_H + BOARD_H * 0.4 - p * 24;
        c.save();
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.scale(0.6 + pop * 0.5, 0.6 + pop * 0.5);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '800 42px "Segoe UI", system-ui, sans-serif';
        c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.45)';
        c.strokeText(`COMBO x${fx.n}`, 0, 0);
        c.fillStyle = '#ffd23f';
        c.fillText(`COMBO x${fx.n}`, 0, 0);
        c.restore();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
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

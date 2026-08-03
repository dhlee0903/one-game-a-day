// Read-only renderer. Draws the in-canvas HUD (stage / score / progress /
// moves), the checkered board, gems with per-type shapes and special-block
// decorations, the selection highlight, clearing shrink-out, and the clear /
// special-activation effects (pop, line beam, bomb ring, rainbow flash).

import {
  COLS, ROWS, CELL, PAD, HUD_H, BOARD_W, BOARD_H, CANVAS_W, CANVAS_H,
  SP, GEM_COLORS, UI, VERSION, CLEAR_LIFE,
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
    this._missiles(c, game);
    this._armed(c, game);
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

  // Armed active-item mode: only the range preview under the pointer (no tint,
  // no banner). The item button itself shows the armed state.
  _armed(c, game) {
    if (!game.armed || !game.preview) return;
    const a = 0.28 + 0.16 * (0.5 + 0.5 * Math.sin(game.tick * 0.25));
    c.fillStyle = `rgba(255,210,63,${a})`;
    c.strokeStyle = 'rgba(255,235,150,.9)'; c.lineWidth = 2;
    for (const p of game.itemCells(game.armed, game.preview)) {
      const x = PAD + p.c * CELL; const y = HUD_H + PAD + p.r * CELL;
      this._round(c, x + 2, y + 2, CELL - 4, CELL - 4, 9); c.fill();
      this._round(c, x + 2, y + 2, CELL - 4, CELL - 4, 9); c.stroke();
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
      const k = Math.max(0, 1 - cl.t / CLEAR_LIFE);
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

    if (special !== SP.NONE) {
      this._specialBlock(c, special, color, left, top, s, cx, cy);
      c.globalAlpha = 1;
      return;
    }

    const m = GEM_COLORS[color] || GEM_COLORS[0];
    this._blockBody(c, m, left, top, s);
    this._features(c, m, left, top, s);
    this._face(c, m.kind, left, top, s, dead);
    c.globalAlpha = 1;
  }

  // Rounded block body with a subtle rim (definition on the dark board) and a
  // soft top gloss. Shared by monsters and special blocks.
  _blockBody(c, m, left, top, s) {
    const grad = c.createLinearGradient(left, top, left, top + s);
    grad.addColorStop(0, m.light);
    grad.addColorStop(0.5, m.base);
    grad.addColorStop(1, m.dark);
    c.fillStyle = grad;
    this._round(c, left, top, s, s, s * 0.3); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = Math.max(1, s * 0.03);
    this._round(c, left + 0.6, top + 0.6, s - 1.2, s - 1.2, s * 0.29); c.stroke();
    const gl = c.createLinearGradient(left, top, left, top + s * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,.34)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    this._round(c, left + s * 0.1, top + s * 0.08, s * 0.8, s * 0.4, s * 0.2); c.fill();
  }

  // Dedicated special-block graphics — drawn straight onto the board with NO
  // monster body behind them, just the symbol sized to fill the cell.
  _specialBlock(c, special, color, left, top, s, cx, cy) {
    if (special === SP.COLOR) { this._colorBlock(c, left, top, s, cx, cy); return; }
    const m = GEM_COLORS[color] || GEM_COLORS[0];
    if (special === SP.ROW || special === SP.COL) this._rocket(c, special === SP.ROW, m, cx, cy, s);
    else if (special === SP.BOMB) this._bombBlock(c, cx, cy, s);
  }

  // 4-match rocket: flies along the line it clears (horizontal = whole row).
  _rocket(c, horiz, m, cx, cy, s) {
    c.save();
    c.translate(cx, cy);
    if (horiz) c.rotate(Math.PI / 2); // default nose-up (COL); rotate for ROW
    const w = s * 0.30;        // body width
    const noseY = -s * 0.42;   // nose tip
    const shTop = -s * 0.22;   // shoulder (body top)
    const bot = s * 0.24;      // tail
    // exhaust flame
    const fl = c.createLinearGradient(0, bot, 0, bot + s * 0.26);
    fl.addColorStop(0, '#ffe14d'); fl.addColorStop(0.5, 'rgba(255,150,40,.85)'); fl.addColorStop(1, 'rgba(255,90,40,0)');
    c.fillStyle = fl;
    c.beginPath(); c.moveTo(-w * 0.4, bot); c.quadraticCurveTo(0, bot + s * 0.3, w * 0.4, bot); c.closePath(); c.fill();
    // fins
    c.fillStyle = m.dark;
    c.beginPath(); c.moveTo(-w * 0.48, bot - s * 0.14); c.lineTo(-w * 0.92, bot + s * 0.04); c.lineTo(-w * 0.48, bot); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(w * 0.48, bot - s * 0.14); c.lineTo(w * 0.92, bot + s * 0.04); c.lineTo(w * 0.48, bot); c.closePath(); c.fill();
    // body + nose (rounded fuselage with a bright centre stripe)
    const bg = c.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    bg.addColorStop(0, m.dark); bg.addColorStop(0.35, m.base); bg.addColorStop(0.5, m.light); bg.addColorStop(0.65, m.base); bg.addColorStop(1, m.dark);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-w * 0.5, bot);
    c.lineTo(-w * 0.5, shTop);
    c.quadraticCurveTo(-w * 0.5, noseY, 0, noseY);
    c.quadraticCurveTo(w * 0.5, noseY, w * 0.5, shTop);
    c.lineTo(w * 0.5, bot);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = Math.max(1, s * 0.025); c.stroke();
    // cockpit window
    c.fillStyle = '#bfeaff';
    c.beginPath(); c.arc(0, shTop + s * 0.13, w * 0.3, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = Math.max(1, s * 0.02); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath(); c.arc(-w * 0.09, shTop + s * 0.09, w * 0.1, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // 2x2 guided missile: metallic warhead with a targeting reticle — distinct
  // from the (coloured) line rocket and the rainbow orb.
  _bombBlock(c, cx, cy, s) {
    const w = s * 0.24;
    const noseY = cy - s * 0.4;
    const shTop = cy - s * 0.14; // shoulder (body top / nose base)
    const bot = cy + s * 0.26;
    // exhaust flame
    const fl = c.createLinearGradient(0, 0, 0, s * 0.2);
    fl.addColorStop(0, '#ffe14d'); fl.addColorStop(0.5, 'rgba(255,150,40,.8)'); fl.addColorStop(1, 'rgba(255,90,40,0)');
    c.save(); c.translate(cx, bot);
    c.fillStyle = fl;
    c.beginPath(); c.moveTo(-w * 0.34, 0); c.quadraticCurveTo(0, s * 0.22, w * 0.34, 0); c.closePath(); c.fill();
    c.restore();
    // fins
    c.fillStyle = '#39424f';
    c.beginPath(); c.moveTo(cx - w * 0.5, bot - s * 0.12); c.lineTo(cx - w * 0.95, bot + s * 0.03); c.lineTo(cx - w * 0.5, bot); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(cx + w * 0.5, bot - s * 0.12); c.lineTo(cx + w * 0.95, bot + s * 0.03); c.lineTo(cx + w * 0.5, bot); c.closePath(); c.fill();
    // metallic body
    const bg = c.createLinearGradient(cx - w * 0.5, 0, cx + w * 0.5, 0);
    bg.addColorStop(0, '#5a6577'); bg.addColorStop(0.5, '#cdd6e2'); bg.addColorStop(1, '#5a6577');
    c.fillStyle = bg;
    this._round(c, cx - w * 0.5, shTop, w, bot - shTop, w * 0.28); c.fill();
    // red warhead nose
    c.fillStyle = '#e2483c';
    c.beginPath();
    c.moveTo(cx - w * 0.5, shTop + s * 0.02);
    c.quadraticCurveTo(cx - w * 0.5, noseY, cx, noseY);
    c.quadraticCurveTo(cx + w * 0.5, noseY, cx + w * 0.5, shTop + s * 0.02);
    c.closePath(); c.fill();
    // dark band between nose and body
    c.fillStyle = '#39424f';
    c.fillRect(cx - w * 0.5, shTop + s * 0.02, w, s * 0.045);
    // targeting reticle (the "guided" signifier)
    c.strokeStyle = 'rgba(255,210,63,.95)'; c.lineWidth = Math.max(1.4, s * 0.03);
    const rr = s * 0.15; const ry = cy + s * 0.04;
    c.beginPath(); c.arc(cx, ry, rr, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(cx - rr - s * 0.05, ry); c.lineTo(cx - rr + s * 0.03, ry);
    c.moveTo(cx + rr - s * 0.03, ry); c.lineTo(cx + rr + s * 0.05, ry);
    c.moveTo(cx, ry - rr - s * 0.05); c.lineTo(cx, ry - rr + s * 0.03);
    c.moveTo(cx, ry + rr - s * 0.03); c.lineTo(cx, ry + rr + s * 0.05);
    c.stroke();
    c.fillStyle = 'rgba(255,210,63,.95)';
    c.beginPath(); c.arc(cx, ry, s * 0.03, 0, Math.PI * 2); c.fill();
  }

  // 5-match colour bomb: dark glossy orb with fixed rainbow sprinkles.
  _colorBlock(c, left, top, s, cx, cy) {
    const r = s * 0.42;
    const bg = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    bg.addColorStop(0, '#3b3452'); bg.addColorStop(0.6, '#1d1832'); bg.addColorStop(1, '#0a0714');
    c.fillStyle = bg;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    // rainbow sprinkles at fixed spots (deterministic → no per-frame jitter)
    const cols = ['#ff5a63', '#ffb03a', '#ffe14d', '#3fce6a', '#3aa0ff', '#a566ff', '#ff5fae'];
    const pts = [[-0.30, -0.34, 0.5], [0.26, -0.40, -0.6], [0.42, 0.02, 1.1], [-0.44, 0.06, 0.3],
      [-0.16, 0.36, -0.4], [0.30, 0.34, 0.8], [0.02, -0.04, 0.0], [-0.34, 0.30, 1.3], [0.44, -0.24, -0.9]];
    for (let i = 0; i < pts.length; i += 1) {
      const [px, py, rot] = pts[i];
      c.save();
      c.translate(cx + px * r, cy + py * r); c.rotate(rot);
      c.fillStyle = cols[i % cols.length];
      this._round(c, -s * 0.055, -s * 0.022, s * 0.11, s * 0.044, s * 0.02); c.fill();
      c.restore();
    }
    // gloss + rim
    c.fillStyle = 'rgba(255,255,255,.32)';
    c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.34, r * 0.2, -0.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = Math.max(1, s * 0.03);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
  }

  // per-monster silhouette accents (horns, stem, drips, stitches)
  _features(c, m, left, top, s) {
    const cx = left + s / 2;
    const k = m.kind;
    if (k === 'demon') {
      // little stubby rounded horns (cute, don't poke far up)
      c.fillStyle = m.dark; c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = Math.max(1, s * 0.02);
      c.beginPath();
      c.moveTo(left + s * 0.19, top + s * 0.15);
      c.quadraticCurveTo(left + s * 0.15, top + s * 0.01, left + s * 0.3, top + s * 0.05);
      c.quadraticCurveTo(left + s * 0.28, top + s * 0.11, left + s * 0.31, top + s * 0.17);
      c.closePath(); c.fill(); c.stroke();
      c.beginPath();
      c.moveTo(left + s * 0.81, top + s * 0.15);
      c.quadraticCurveTo(left + s * 0.85, top + s * 0.01, left + s * 0.7, top + s * 0.05);
      c.quadraticCurveTo(left + s * 0.72, top + s * 0.11, left + s * 0.69, top + s * 0.17);
      c.closePath(); c.fill(); c.stroke();
    } else if (k === 'ghost') {
      // wavy hem scallops along the bottom → floaty ghost silhouette
      c.fillStyle = m.dark;
      const n = 3; const bw = s * 0.26; const by = top + s * 0.92; const x0 = cx - (n * bw) / 2;
      for (let i = 0; i < n; i += 1) { c.beginPath(); c.arc(x0 + bw * (i + 0.5), by, bw * 0.5, 0, Math.PI); c.fill(); }
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
      // hollow eye sockets — tall ovals, no glint (glint read as robot lenses)
      c.fillStyle = '#2a2f3a';
      c.beginPath(); c.ellipse(lx, eyeY, s * 0.125, s * 0.155, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(rx, eyeY, s * 0.125, s * 0.155, 0, 0, Math.PI * 2); c.fill();
      // nasal cavity
      c.beginPath(); c.moveTo(cx, eyeY + s * 0.14); c.lineTo(cx - s * 0.045, eyeY + s * 0.23); c.lineTo(cx + s * 0.045, eyeY + s * 0.23); c.closePath(); c.fill();
      // grinning jaw with a rounded bottom + tooth gaps
      const mw = s * 0.44; const mx = cx - mw / 2; const my = top + s * 0.7; const mh = s * 0.15;
      c.beginPath();
      c.moveTo(mx, my); c.lineTo(mx + mw, my);
      c.lineTo(mx + mw, my + mh * 0.5);
      c.quadraticCurveTo(cx, my + mh * 1.2, mx, my + mh * 0.5);
      c.closePath(); c.fill();
      c.strokeStyle = '#e7edf4'; c.lineWidth = Math.max(1.2, s * 0.03);
      for (let i = 1; i < 4; i += 1) { const xx = mx + (mw * i) / 4; c.beginPath(); c.moveTo(xx, my); c.lineTo(xx, my + mh * 0.72); c.stroke(); }
      return;
    }
    if (kind === 'pumpkin') {
      // big round eyes → friendlier than the classic triangle jack-o cut-outs
      this._roundEye(c, lx, eyeY, s * 0.12, '#fff');
      this._roundEye(c, rx, eyeY, s * 0.12, '#fff');
      // cute curved grin with two little teeth
      const my = top + s * 0.66;
      c.strokeStyle = '#3a2410'; c.lineWidth = Math.max(1.5, s * 0.05); c.lineCap = 'round';
      c.beginPath(); c.arc(cx, my, s * 0.18, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
      c.fillStyle = '#3a2410';
      c.beginPath(); c.moveTo(cx - s * 0.09, my + s * 0.07); c.lineTo(cx - s * 0.02, my + s * 0.07); c.lineTo(cx - s * 0.055, my + s * 0.15); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + s * 0.09, my + s * 0.07); c.lineTo(cx + s * 0.02, my + s * 0.07); c.lineTo(cx + s * 0.055, my + s * 0.15); c.closePath(); c.fill();
      return;
    }
    if (kind === 'ghost') {
      // big round eyes glancing to the side (cute + characterful)
      this._roundEye(c, lx, eyeY, s * 0.12, '#fff');
      this._roundEye(c, rx, eyeY, s * 0.12, '#fff');
      // blush
      c.fillStyle = 'rgba(255,150,205,.42)';
      c.beginPath(); c.arc(lx - s * 0.06, eyeY + s * 0.15, s * 0.055, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(rx + s * 0.06, eyeY + s * 0.15, s * 0.055, 0, Math.PI * 2); c.fill();
      // open "boo" mouth
      c.fillStyle = '#2a2440';
      c.beginPath(); c.ellipse(cx, top + s * 0.72, s * 0.07, s * 0.1, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    if (kind === 'demon') {
      // big round eyes — mischievous but cute
      this._roundEye(c, lx, eyeY, s * 0.13, '#fff');
      this._roundEye(c, rx, eyeY, s * 0.13, '#fff');
      // soft little brows (character without the menace)
      c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(1.5, s * 0.04); c.lineCap = 'round';
      c.beginPath(); c.moveTo(lx - s * 0.12, eyeY - s * 0.2); c.lineTo(lx + s * 0.05, eyeY - s * 0.13); c.stroke();
      c.beginPath(); c.moveTo(rx + s * 0.12, eyeY - s * 0.2); c.lineTo(rx - s * 0.05, eyeY - s * 0.13); c.stroke();
      // simple friendly smile (no fangs)
      const my = top + s * 0.68;
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = Math.max(1.5, s * 0.045); c.lineCap = 'round';
      c.beginPath(); c.arc(cx, my, s * 0.15, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
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

  // ---- guided missiles ----

  _missiles(c, game) {
    for (const m of game.missiles) {
      // target reticle
      c.strokeStyle = 'rgba(255,210,63,.7)'; c.lineWidth = 2;
      const pulse = 8 + (m.t % 12) * 0.4;
      c.beginPath(); c.arc(m.tx, m.ty, pulse, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(m.tx - 13, m.ty); c.lineTo(m.tx - 5, m.ty); c.moveTo(m.tx + 5, m.ty); c.lineTo(m.tx + 13, m.ty);
      c.moveTo(m.tx, m.ty - 13); c.lineTo(m.tx, m.ty - 5); c.moveTo(m.tx, m.ty + 5); c.lineTo(m.tx, m.ty + 13);
      c.stroke();
      // trail — a long tapered streak (bright + wide near the head)
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 1; i < m.trail.length; i += 1) {
        const a = i / m.trail.length; const p0 = m.trail[i - 1]; const p1 = m.trail[i];
        c.strokeStyle = `rgba(255,180,60,${a * 0.6})`;
        c.lineWidth = 1 + a * 6;
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      }
      // inner hot core of the streak
      for (let i = 1; i < m.trail.length; i += 1) {
        const a = i / m.trail.length; const p0 = m.trail[i - 1]; const p1 = m.trail[i];
        c.strokeStyle = `rgba(255,240,180,${a * 0.5})`;
        c.lineWidth = 0.5 + a * 2.4;
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      }
      // head: small glowing dart pointing along its velocity
      const ang = Math.atan2(m.ty - m.sy, m.tx - m.sx);
      c.save(); c.translate(m.x, m.y); c.rotate(ang);
      c.fillStyle = '#ff9a2e';
      c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -5); c.lineTo(-3, 0); c.lineTo(-6, 5); c.closePath(); c.fill();
      c.fillStyle = '#ffe14d';
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-2, -2.4); c.lineTo(-2, 2.4); c.closePath(); c.fill();
      c.restore();
    }
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
      } else if (fx.type === 'smash') {
        c.globalAlpha = 1 - p;
        c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.lineCap = 'round';
        const R = 10 + p * 26;
        for (let i = 0; i < 6; i += 1) {
          const ang = (i / 6) * Math.PI * 2;
          c.beginPath();
          c.moveTo(fx.x + Math.cos(ang) * R * 0.5, fx.y + Math.sin(ang) * R * 0.5);
          c.lineTo(fx.x + Math.cos(ang) * R, fx.y + Math.sin(ang) * R);
          c.stroke();
        }
        c.fillStyle = `rgba(255,255,255,${(1 - p) * 0.5})`;
        c.beginPath(); c.arc(fx.x, fx.y, 6 + p * 8, 0, Math.PI * 2); c.fill();
      } else if (fx.type === 'swirl') {
        c.save();
        c.globalAlpha = (1 - p) * 0.55;
        c.translate(BOARD_W / 2, HUD_H + BOARD_H / 2);
        c.rotate(p * Math.PI * 2.2);
        c.strokeStyle = '#8fd0ff'; c.lineWidth = 6; c.lineCap = 'round';
        const rr = BOARD_H * 0.42 * (0.3 + p * 0.7);
        c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 1.5); c.stroke();
        c.restore();
      } else if (fx.type === 'warn') {
        const blink = Math.sin(fx.t * 0.35) > 0 ? 1 : 0.4;
        const alpha = p < 0.85 ? blink : (1 - p) / 0.15 * blink;
        c.save();
        c.globalAlpha = Math.max(0, alpha);
        c.fillStyle = 'rgba(255,60,70,.12)';
        c.fillRect(0, HUD_H, BOARD_W, BOARD_H);
        c.translate(BOARD_W / 2, HUD_H + BOARD_H * 0.34);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = '800 34px "Segoe UI", system-ui, sans-serif';
        c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.5)';
        c.strokeText(fx.text, 0, 0);
        c.fillStyle = '#ff5a6a';
        c.fillText(fx.text, 0, 0);
        c.restore();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
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

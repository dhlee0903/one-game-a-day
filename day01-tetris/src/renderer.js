// All canvas drawing lives here. The renderer reads game state but never
// mutates it, so the visual layer stays swappable and testable in isolation.

import { COLS, ROWS, CELL, COLORS, SHAPES } from './config.js';

export class Renderer {
  constructor(boardCanvas, nextCanvas, holdCanvas) {
    this.ctx = boardCanvas.getContext('2d');
    this.nctx = nextCanvas.getContext('2d');
    this.hctx = holdCanvas.getContext('2d');
    this.boardCanvas = boardCanvas;
    this.nextCanvas = nextCanvas;
    this.holdCanvas = holdCanvas;
  }

  // A single block with a light top edge and dark bottom edge for depth.
  drawCell(ctx, x, y, color, size = CELL) {
    const px = x * size;
    const py = y * size;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(px, py, size, size * 0.14);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(px, py + size * 0.86, size, size * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  drawGridLines() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,.03)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.strokeRect(c * CELL + 0.5, r * CELL + 0.5, CELL - 1, CELL - 1);
      }
    }
  }

  // Draw settled blocks, the falling piece, and its landing ghost.
  render(board, piece, ghostY) {
    const { ctx } = this;
    this.drawGridLines();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = board.grid[r][c];
        if (t) this.drawCell(ctx, c, r, COLORS[t]);
      }
    }

    if (!piece) return;

    ctx.globalAlpha = 0.22;
    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v) this.drawCell(ctx, piece.x + c, ghostY + r, COLORS[piece.type]);
      });
    });
    ctx.globalAlpha = 1;

    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) {
          this.drawCell(ctx, piece.x + c, piece.y + r, COLORS[piece.type]);
        }
      });
    });
  }

  // Shared mini-preview used by the Hold and Next panels. `alpha` dims the
  // Hold slot while it is temporarily locked.
  _drawPreview(ctx, canvas, piece, alpha = 1) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!piece) return;
    const shape = SHAPES[piece.type];
    const size = 18;
    const w = shape[0].length;
    const h = shape.length;
    const ox = (canvas.width - w * size) / 2;
    const oy = (canvas.height - h * size) / 2;
    ctx.globalAlpha = alpha;
    shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        ctx.save();
        ctx.translate(ox, oy);
        this.drawCell(ctx, c, r, COLORS[piece.type], size);
        ctx.restore();
      });
    });
    ctx.globalAlpha = 1;
  }

  // Preview of the upcoming piece.
  drawNext(piece) {
    this._drawPreview(this.nctx, this.nextCanvas, piece);
  }

  // The stashed piece; dimmed when hold is on cooldown for this drop.
  drawHold(piece, enabled = true) {
    this._drawPreview(this.hctx, this.holdCanvas, piece, enabled ? 1 : 0.35);
  }
}

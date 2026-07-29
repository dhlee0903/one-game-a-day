// Canvas rendering. Reads game state only.

import { COLS, ROWS, CELL, COLORS } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(game) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._board();
    if (game.food) this._food(game.food);
    this._snake(game.snake, game.phase);
    if (game.effects) game.effects.forEach((e) => this._burst(e));
    if (game.crash) this._crashMark(game.crash);
  }

  // Checkerboard so every cell reads clearly on the light theme.
  _board() {
    const { ctx } = this;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.cellA : COLORS.cellB;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  _roundRect(px, py, size, r, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(px, py, size, size, r);
    ctx.fill();
  }

  _food(food) {
    const { ctx } = this;
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    ctx.save();
    ctx.shadowColor = COLORS.foodGlow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(cx - CELL * 0.1, cy - CELL * 0.1, CELL * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  _snake(snake, phase) {
    const pad = 2;
    const size = CELL - pad * 2;
    snake.body.forEach((seg, i) => {
      const px = seg.x * CELL + pad;
      const py = seg.y * CELL + pad;
      if (i === 0) {
        this._roundRect(px, py, size, 8, phase === 'dying' ? COLORS.crash : COLORS.head);
        this._eyes(snake, seg);
      } else {
        this._roundRect(px, py, size, 5, i % 2 ? COLORS.bodyAlt : COLORS.body);
      }
    });
  }

  _eyes(snake, head) {
    const { ctx } = this;
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const d = snake.dir;
    const off = CELL * 0.18;
    const px = d.y !== 0 ? off : 0;
    const py = d.x !== 0 ? off : 0;
    const fx = d.x * off * 0.6;
    const fy = d.y * off * 0.6;
    ctx.fillStyle = COLORS.eye;
    [[px, py], [-px, -py]].forEach(([ex, ey]) => {
      ctx.beginPath();
      ctx.arc(cx + ex + fx, cy + ey + fy, CELL * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Expanding ring + flying particles when food is eaten (snake grows).
  _burst(e) {
    const { ctx } = this;
    const p = Math.min(1, e.age / e.dur);
    const cx = e.x * CELL + CELL / 2;
    const cy = e.y * CELL + CELL / 2;
    const alpha = 1 - p;

    ctx.save();
    ctx.strokeStyle = `rgba(229, 72, 77, ${alpha * 0.9})`;
    ctx.lineWidth = 3 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.3 + p * CELL * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(229, 72, 77, ${alpha})`;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const dist = p * CELL * 1.0;
      const r = (1 - p) * 3 + 1;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Red impact ring where the snake died.
  _crashMark(crash) {
    const { ctx } = this;
    const cx = Math.max(CELL * 0.5, Math.min((COLS - 0.5) * CELL, crash.x * CELL + CELL / 2));
    const cy = Math.max(CELL * 0.5, Math.min((ROWS - 0.5) * CELL, crash.y * CELL + CELL / 2));
    ctx.save();
    ctx.strokeStyle = COLORS.crash;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(229, 72, 77, .25)';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

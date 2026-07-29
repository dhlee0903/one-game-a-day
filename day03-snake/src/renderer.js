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
    this._grid();
    if (game.food) this._food(game.food);
    this._snake(game.snake);
  }

  _grid() {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(COLS * CELL, y * CELL + 0.5);
      ctx.stroke();
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
    // little highlight
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.arc(cx - CELL * 0.1, cy - CELL * 0.1, CELL * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  _snake(snake) {
    const pad = 2;
    const size = CELL - pad * 2;
    snake.body.forEach((seg, i) => {
      const px = seg.x * CELL + pad;
      const py = seg.y * CELL + pad;
      if (i === 0) {
        this._roundRect(px, py, size, 7, COLORS.head);
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
    // perpendicular offset for the two eyes
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
}

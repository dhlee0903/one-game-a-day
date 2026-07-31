// Canvas rendering, everything offset by the camera. Reads state only.

import { CELL, VIEW_W, VIEW_H, COLORS } from './config.js';
import { isSolid } from './physics.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(game) {
    const { ctx } = this;
    const cam = Math.round(game.camera.x);
    this._sky();
    this._hills(cam);
    this._tiles(game, cam);
    this._coins(game, cam);
    this._goal(game, cam);
    this._enemies(game, cam);
    this._player(game, cam);
  }

  _sky() {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, COLORS.sky1);
    g.addColorStop(1, COLORS.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  _hills(cam) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(120, 200, 120, .5)';
    for (let i = -1; i < 8; i += 1) {
      const x = i * 320 - (cam * 0.4) % 320;
      ctx.beginPath();
      ctx.arc(x + 120, VIEW_H - 64, 120, Math.PI, 0);
      ctx.fill();
    }
  }

  _tiles(game, cam) {
    const { ctx } = this;
    const { level } = game;
    const startX = Math.floor(cam / CELL);
    const endX = startX + VIEW_W / CELL + 1;
    for (let ty = 0; ty < level.rows; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (!isSolid(level, tx, ty) || tx < 0) continue;
        const x = tx * CELL - cam;
        const y = ty * CELL;
        const surface = !isSolid(level, tx, ty - 1);
        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = COLORS.dirtDark;
        ctx.fillRect(x, y + CELL - 4, CELL, 4);
        if (surface) {
          ctx.fillStyle = COLORS.grass;
          ctx.fillRect(x, y, CELL, 8);
        }
        ctx.strokeStyle = 'rgba(0,0,0,.08)';
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
      }
    }
  }

  _coins(game, cam) {
    const { ctx } = this;
    game.coins.forEach((c) => {
      if (c.taken) return;
      const x = c.x - cam;
      const y = c.y;
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.coinEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(x - 3, y - 5, 2, 8);
    });
  }

  _goal(game, cam) {
    const { ctx } = this;
    const g = game.level.goal;
    const x = g.x - cam + CELL / 2;
    const topY = (g.y - 6 * CELL);
    const baseY = 13 * CELL;
    ctx.fillStyle = COLORS.pole;
    ctx.fillRect(x - 3, topY, 6, baseY - topY);
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(x + 3, topY + 6);
    ctx.lineTo(x + 40, topY + 16);
    ctx.lineTo(x + 3, topY + 26);
    ctx.closePath();
    ctx.fill();
  }

  _enemies(game, cam) {
    const { ctx } = this;
    game.enemies.forEach((e) => {
      if (e.dead && e.deadTimer <= 0) return;
      const x = e.x - cam;
      const squashed = e.dead;
      const h = squashed ? 8 : e.h;
      const y = e.y + (e.h - h);
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.roundRect(x, y, e.w, h, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.enemyFoot;
      ctx.fillRect(x, y + h - 3, e.w, 3);
      if (!squashed) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 5, y + 6, 6, 7);
        ctx.fillRect(x + e.w - 11, y + 6, 6, 7);
        ctx.fillStyle = COLORS.eye;
        ctx.fillRect(x + 7, y + 8, 3, 4);
        ctx.fillRect(x + e.w - 9, y + 8, 3, 4);
      }
    });
  }

  _player(game, cam) {
    const { ctx } = this;
    const p = game.player;
    const x = Math.round(p.x - cam);
    const y = Math.round(p.y);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(x, y, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.playerDark;
    ctx.fillRect(x, y + p.h - 6, p.w, 6);      // shoes
    ctx.fillRect(x, y + 2, p.w, 7);            // cap
    // eyes, facing
    const ex = p.facing > 0 ? x + p.w - 12 : x + 6;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, y + 11, 6, 7);
    ctx.fillStyle = COLORS.eye;
    ctx.fillRect(ex + (p.facing > 0 ? 3 : 0), y + 13, 3, 4);
  }
}

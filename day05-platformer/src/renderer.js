// Canvas rendering, everything offset by the camera. Reads state only.

import { CELL, VIEW_W, VIEW_H, COLORS, TILE } from './config.js';
import { isSolid } from './physics.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(game) {
    const cam = Math.round(game.camera.x);
    this._sky();
    this._hills(cam);
    this._tiles(game, cam);
    this._coins(game, cam);
    this._goal(game, cam);
    this._items(game, cam);
    this._enemies(game, cam);
    this._effects(game, cam);
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
    const bump = {};
    game.bumps.forEach((b) => {
      bump[`${b.tx},${b.ty}`] = -Math.sin((b.t / b.life) * Math.PI) * 7;
    });
    const startX = Math.floor(cam / CELL);
    const endX = startX + VIEW_W / CELL + 1;
    for (let ty = 0; ty < level.rows; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        if (tx < 0) continue;
        const type = level.tiles[ty] && level.tiles[ty][tx];
        if (!type) continue;
        const x = tx * CELL - cam;
        const y = ty * CELL + (bump[`${tx},${ty}`] || 0);
        this._tile(x, y, type, !isSolid(level, tx, ty - 1));
      }
    }
  }

  _tile(x, y, type, surface) {
    const { ctx } = this;
    if (type === TILE.GROUND) {
      ctx.fillStyle = COLORS.dirt;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = COLORS.dirtDark;
      ctx.fillRect(x, y + CELL - 4, CELL, 4);
      if (surface) { ctx.fillStyle = COLORS.grass; ctx.fillRect(x, y, CELL, 8); }
    } else if (type === TILE.BRICK || type === TILE.COINBRICK) {
      ctx.fillStyle = COLORS.brick;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = COLORS.brickLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.beginPath();
      ctx.moveTo(x, y + CELL / 2); ctx.lineTo(x + CELL, y + CELL / 2);
      ctx.moveTo(x + CELL / 2, y); ctx.lineTo(x + CELL / 2, y + CELL / 2);
      ctx.moveTo(x + CELL / 4, y + CELL / 2); ctx.lineTo(x + CELL / 4, y + CELL);
      ctx.moveTo(x + 3 * CELL / 4, y + CELL / 2); ctx.lineTo(x + 3 * CELL / 4, y + CELL);
      ctx.stroke();
    } else if (type === TILE.QCOIN || type === TILE.QITEM) {
      ctx.fillStyle = COLORS.qblock;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = COLORS.qblockDark;
      ctx.fillRect(x, y + CELL - 5, CELL, 5);
      [[x + 3, y + 3], [x + CELL - 6, y + 3], [x + 3, y + CELL - 8], [x + CELL - 6, y + CELL - 8]].forEach(([rx, ry]) => ctx.fillRect(rx, ry, 3, 3));
      ctx.fillStyle = '#5a3b00';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + CELL / 2, y + CELL / 2 + 1);
    } else if (type === TILE.USED) {
      ctx.fillStyle = COLORS.used;
      ctx.fillRect(x, y, CELL, CELL);
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    }
  }

  _coins(game, cam) {
    const { ctx } = this;
    game.level.coins.forEach((c) => {
      if (c.taken) return;
      const x = c.x - cam;
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(x, c.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.coinEdge; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 3, c.y - 5, 2, 8);
    });
  }

  _items(game, cam) {
    const { ctx } = this;
    game.items.forEach((it) => {
      const x = it.x - cam;
      const y = it.y;
      ctx.fillStyle = COLORS.mushroomStem;
      ctx.fillRect(x + 4, y + it.h / 2, it.w - 8, it.h / 2);
      ctx.fillStyle = COLORS.mushroom;
      ctx.beginPath();
      ctx.arc(x + it.w / 2, y + it.h / 2, it.w / 2, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 8, y + 9, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + it.w - 8, y + 9, 3, 0, Math.PI * 2); ctx.fill();
    });
  }

  _goal(game, cam) {
    const { ctx } = this;
    const g = game.level.goal;
    const x = g.x - cam + CELL / 2;
    const topY = 3 * CELL;
    const baseY = 13 * CELL;
    ctx.fillStyle = COLORS.pole;
    ctx.fillRect(x - 3, topY, 6, baseY - topY);
    ctx.fillStyle = '#e8d24a';
    ctx.beginPath(); ctx.arc(x, topY, 6, 0, Math.PI * 2); ctx.fill();
    // flag: slides down with the player during the flag sequence
    const flagY = game.flag ? Math.max(topY + 8, game.player.y) : topY + 8;
    ctx.fillStyle = COLORS.flag;
    ctx.beginPath();
    ctx.moveTo(x - 3, flagY);
    ctx.lineTo(x - 40, flagY + 10);
    ctx.lineTo(x - 3, flagY + 20);
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
      ctx.beginPath(); ctx.roundRect(x, y, e.w, h, 6); ctx.fill();
      ctx.fillStyle = COLORS.enemyFoot;
      ctx.fillRect(x, y + h - 3, e.w, 3);
      if (!squashed) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 5, y + 6, 6, 7); ctx.fillRect(x + e.w - 11, y + 6, 6, 7);
        ctx.fillStyle = COLORS.eye;
        ctx.fillRect(x + 7, y + 8, 3, 4); ctx.fillRect(x + e.w - 9, y + 8, 3, 4);
      }
    });
  }

  _effects(game, cam) {
    const { ctx } = this;
    game.effects.forEach((e) => {
      const a = 1 - e.t / e.life;
      if (e.type === 'coin') {
        ctx.globalAlpha = a;
        ctx.fillStyle = COLORS.coin;
        ctx.beginPath(); ctx.arc(e.x - cam, e.y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (e.type === 'shard') {
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(e.x - cam - 4, e.y - 4, 8, 8);
      }
    });
  }

  _player(game, cam) {
    const { ctx } = this;
    const p = game.player;
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return; // blink
    const x = Math.round(p.x - cam);
    const y = Math.round(p.y);
    const body = p.big ? COLORS.playerBig : COLORS.player;
    const dark = p.big ? COLORS.playerBigDark : COLORS.playerDark;
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(x, y, p.w, p.h, 6); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + p.h - 6, p.w, 6);  // shoes
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y + 2, p.w, 7);        // cap (always red)
    const ex = p.facing > 0 ? x + p.w - 12 : x + 6;
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex, y + 11, 6, 7);
    ctx.fillStyle = COLORS.eye;
    ctx.fillRect(ex + (p.facing > 0 ? 3 : 0), y + 13, 3, 4);
  }
}

// Read-only renderer. Paints sky, the converging road with scrolling lane
// stripes, obstacles/coins sorted far-to-near for correct overlap, the runner,
// and hit/coin effects. Never mutates game state.

import {
  VIEW_W, VIEW_H, HORIZON_Y, GROUND_Y, DRAW_DIST, ROAD_HALF,
  LANE_SPREAD, JUMP_HEIGHT, OB, COLORS,
} from './config.js';
import { project, depthScale, CENTER_X } from './projection.js';

export class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.w = VIEW_W;
    this.h = VIEW_H;
  }

  render(game) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    this._sky(c);
    this._road(c, game.distance);
    this._entities(c, game);
    this._player(c, game);
    this._effects(c, game);
  }

  _sky(c) {
    const g = c.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, COLORS.sky1);
    g.addColorStop(0.7, COLORS.sky2);
    g.addColorStop(1, COLORS.sky3);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, HORIZON_Y);

    // low sun glow at the vanishing point
    const sun = c.createRadialGradient(CENTER_X, HORIZON_Y, 4, CENTER_X, HORIZON_Y, 90);
    sun.addColorStop(0, 'rgba(255,225,170,.9)');
    sun.addColorStop(1, 'rgba(255,225,170,0)');
    c.fillStyle = sun;
    c.fillRect(CENTER_X - 90, HORIZON_Y - 90, 180, 100);
  }

  // Road as a trapezoid plus perspective-correct lane stripes and side rails.
  _road(c, distance) {
    const nearHalf = ROAD_HALF;
    const farHalf = ROAD_HALF * depthScale(DRAW_DIST);

    // ground fill below horizon
    c.fillStyle = '#182338';
    c.fillRect(0, HORIZON_Y, this.w, this.h - HORIZON_Y);

    // road surface
    c.fillStyle = COLORS.road;
    c.beginPath();
    c.moveTo(CENTER_X - farHalf, HORIZON_Y);
    c.lineTo(CENTER_X + farHalf, HORIZON_Y);
    c.lineTo(CENTER_X + nearHalf, GROUND_Y);
    c.lineTo(CENTER_X - nearHalf, GROUND_Y);
    c.closePath();
    c.fill();

    // glowing edges
    c.strokeStyle = COLORS.roadEdge;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(CENTER_X - farHalf, HORIZON_Y); c.lineTo(CENTER_X - nearHalf, GROUND_Y);
    c.moveTo(CENTER_X + farHalf, HORIZON_Y); c.lineTo(CENTER_X + nearHalf, GROUND_Y);
    c.stroke();

    // dashed lane dividers between the three lanes, scrolling with distance
    for (const div of [-1, 1]) {
      this._laneStripes(c, div * LANE_SPREAD, distance);
    }
  }

  _laneStripes(c, laneX, distance) {
    // paint dashes at fixed world distances so they appear to rush toward us
    const period = 2;               // world spacing between dashes
    const phase = distance % period;
    c.fillStyle = COLORS.roadLine;
    for (let d = DRAW_DIST; d > 0; d -= period) {
      const dd = d - phase;
      if (dd <= 0.15 || dd > DRAW_DIST) continue;
      const a = project(laneX, dd);
      const b = project(laneX, Math.max(0.05, dd - period * 0.5));
      const wA = Math.max(1, 6 * a.t);
      const wB = Math.max(1, 6 * b.t);
      c.beginPath();
      c.moveTo(a.x - wA / 2, a.y);
      c.lineTo(a.x + wA / 2, a.y);
      c.lineTo(b.x + wB / 2, b.y);
      c.lineTo(b.x - wB / 2, b.y);
      c.closePath();
      c.fill();
    }
  }

  _entities(c, game) {
    // far to near so nearer objects overlap correctly
    const sorted = [...game.entities].sort((a, b) => b.d - a.d);
    for (const e of sorted) {
      if (e.d > DRAW_DIST || e.d < -2 || e.taken) continue;
      if (e.kind === OB.COIN) this._coin(c, e);
      else this._obstacle(c, e);
    }
  }

  _obstacle(c, e) {
    const p = project(e.lane, e.d);
    const size = 66 * p.t;
    const laneW = ROAD_HALF * LANE_SPREAD * 0.92 * p.t;

    // contact shadow
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(p.x, p.y, laneW * 0.6, laneW * 0.18, 0, 0, Math.PI * 2);
    c.fill();

    if (e.kind === OB.BLOCK) {
      // deliberately taller than the jump arc — reads as "switch lanes"
      this._box(c, p.x, p.y, laneW * 1.15, size * 2.4, COLORS.block, COLORS.blockDark);
    } else if (e.kind === OB.LOW) {
      // low barrier — jump it
      this._box(c, p.x, p.y, laneW * 1.15, size * 0.62, COLORS.low, COLORS.lowDark);
    } else if (e.kind === OB.HIGH) {
      // overhead beam — slide under it; leaves a gap at ground level
      const h = size * 0.55;
      const top = p.y - size * 1.7;
      this._boxAt(c, p.x, top, laneW * 1.25, h, COLORS.high, COLORS.highDark);
      // support posts
      c.fillStyle = COLORS.highDark;
      c.fillRect(p.x - laneW * 0.6, top, Math.max(2, 5 * p.t), (p.y - top));
      c.fillRect(p.x + laneW * 0.6 - Math.max(2, 5 * p.t), top, Math.max(2, 5 * p.t), (p.y - top));
    }
  }

  // Box whose base sits on (x, baseY), rising by height.
  _box(c, x, baseY, halfW, height, face, side) {
    this._boxAt(c, x, baseY - height, halfW, height, face, side);
  }

  _boxAt(c, x, topY, halfW, height, face, side) {
    c.fillStyle = side;
    c.fillRect(x - halfW, topY, halfW * 2, height);
    c.fillStyle = face;
    c.fillRect(x - halfW, topY, halfW * 2 - Math.max(3, halfW * 0.22), height);
    c.fillStyle = 'rgba(255,255,255,.14)';
    c.fillRect(x - halfW, topY, halfW * 2, Math.max(2, height * 0.12));
  }

  _coin(c, e) {
    const p = project(e.lane, e.d);
    const r = Math.max(2, 15 * p.t);
    const cy = p.y - 40 * p.t; // float above the road
    const wob = Math.abs(Math.cos(e.spin + e.d)); // fake spin, 0..1 width
    c.save();
    c.translate(p.x, cy);
    c.fillStyle = COLORS.coinEdge;
    c.beginPath(); c.ellipse(0, 0, Math.max(1.5, r * wob) + 1.5, r + 1.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.coin;
    c.beginPath(); c.ellipse(0, 0, Math.max(1, r * wob), r, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  _player(c, game) {
    const p = game.player;
    const proj = project(p.laneX, 0);
    const baseX = proj.x;
    const groundY = GROUND_Y;
    const lift = p.lift * JUMP_HEIGHT;
    const baseY = groundY - lift;
    const sliding = p.sliding;

    // shadow shrinks as the player rises
    const shScale = 1 - p.lift * 0.55;
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(baseX, groundY, 42 * shScale, 12 * shScale, 0, 0, Math.PI * 2);
    c.fill();

    const bob = Math.sin(p.runT * 0.4) * 3;
    this._runner(c, baseX, baseY - (sliding ? 0 : bob), p, sliding);
  }

  _runner(c, x, footY, p, sliding) {
    const flick = (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0);
    if (flick) c.globalAlpha = 0.4;

    const bodyH = sliding ? 34 : 74;
    const bodyW = sliding ? 60 : 40;
    const topY = footY - bodyH;
    const swing = Math.sin(p.runT * 0.4) * (sliding ? 0 : 10);

    // legs
    c.strokeStyle = COLORS.playerDark;
    c.lineWidth = 9;
    c.lineCap = 'round';
    if (!sliding) {
      c.beginPath();
      c.moveTo(x - 8, footY - 30); c.lineTo(x - 8 + swing, footY);
      c.moveTo(x + 8, footY - 30); c.lineTo(x + 8 - swing, footY);
      c.stroke();
    }

    // body
    c.fillStyle = COLORS.player;
    this._roundRect(c, x - bodyW / 2, topY, bodyW, bodyH, 12);
    c.fill();
    c.fillStyle = COLORS.playerDark;
    this._roundRect(c, x - bodyW / 2, topY, bodyW, Math.min(bodyH, 16), 12);
    c.fill();

    // arms
    if (!sliding) {
      c.strokeStyle = COLORS.player;
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(x - bodyW / 2, topY + 24); c.lineTo(x - bodyW / 2 - 6, topY + 24 - swing);
      c.moveTo(x + bodyW / 2, topY + 24); c.lineTo(x + bodyW / 2 + 6, topY + 24 + swing);
      c.stroke();
    }

    // head
    const headR = sliding ? 13 : 16;
    const headY = topY - headR + 2;
    c.fillStyle = COLORS.playerSkin;
    c.beginPath(); c.arc(x, headY, headR, 0, Math.PI * 2); c.fill();
    // cap
    c.fillStyle = COLORS.playerDark;
    c.beginPath();
    c.arc(x, headY, headR, Math.PI, Math.PI * 2);
    c.fill();

    c.globalAlpha = 1;
  }

  _effects(c, game) {
    for (const fx of game.effects) {
      if (fx.type === 'flash') {
        c.fillStyle = `rgba(224,87,79,${0.4 * (1 - fx.t / fx.life)})`;
        c.fillRect(0, 0, this.w, this.h);
      } else if (fx.type === 'spark') {
        const proj = project(fx.lane, 0);
        const prog = fx.t / fx.life;
        const r = 8 + prog * 34;
        c.strokeStyle = `rgba(255,210,63,${1 - prog})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(proj.x, GROUND_Y - 50, r, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  _roundRect(c, x, y, w, h, r) {
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

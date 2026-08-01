// Read-only renderer. Paints a dusk sky with distant hills, a converging road
// with scrolling ground bands / rails / lane lines, obstacles and coins drawn
// far-to-near (and flowing off the bottom past the camera), the runner with
// jump/slide animation, hit/coin effects, and the score/time/lives HUD — all
// inside the canvas. Never mutates game state.

import {
  VIEW_W, VIEW_H, HORIZON_Y, GROUND_Y, DRAW_DIST, PASS_D, ROAD_HALF,
  LANE_SPREAD, JUMP_HEIGHT, START_LIVES, OB, COLORS,
} from './config.js';
import { project, depthScale, CENTER_X } from './projection.js';

const RAIL_X = 1 / LANE_SPREAD;        // lane-x of the road edge
const BAND = 1.6;                      // world length of one ground band

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = VIEW_W;
    this.h = VIEW_H;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    this.ctx.scale(dpr, dpr);
  }

  render(game) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);

    // screen shake on hit
    let sx = 0; let sy = 0;
    if (game.shake > 0) {
      const m = game.shake / 16;
      sx = (Math.random() * 2 - 1) * 7 * m;
      sy = (Math.random() * 2 - 1) * 7 * m;
    }
    c.save();
    c.translate(sx, sy);

    this._sky(c, game);
    this._road(c, game.distance);
    this._entities(c, game);
    this._player(c, game);
    this._effects(c, game);

    c.restore();
    this._hud(c, game);
  }

  // ---------- sky ----------

  _sky(c, game) {
    const g = c.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, COLORS.sky0);
    g.addColorStop(0.42, COLORS.sky1);
    g.addColorStop(0.72, COLORS.sky2);
    g.addColorStop(0.9, COLORS.sky3);
    g.addColorStop(1, COLORS.sky4);
    c.fillStyle = g;
    c.fillRect(-20, 0, this.w + 40, HORIZON_Y);

    // sun
    const sun = c.createRadialGradient(CENTER_X, HORIZON_Y - 6, 6, CENTER_X, HORIZON_Y - 6, 120);
    sun.addColorStop(0, 'rgba(255,238,200,.95)');
    sun.addColorStop(0.5, 'rgba(255,180,120,.35)');
    sun.addColorStop(1, 'rgba(255,180,120,0)');
    c.fillStyle = sun;
    c.beginPath(); c.arc(CENTER_X, HORIZON_Y - 6, 120, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe9b8';
    c.beginPath(); c.arc(CENTER_X, HORIZON_Y - 10, 34, 0, Math.PI * 2); c.fill();

    this._hills(c, game.distance);
  }

  _hills(c, distance) {
    const drift = (distance * 0.4) % (this.w + 200);
    const base = HORIZON_Y;
    const draw = (color, h, wd, off) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-100, base);
      for (let x = -100; x <= this.w + 100; x += wd) {
        const px = x - ((drift * off) % wd);
        c.lineTo(px, base - h * (0.6 + 0.4 * Math.sin(x * 0.9)));
        c.lineTo(px + wd / 2, base - h * (0.9 + 0.2 * Math.cos(x * 1.7)));
      }
      c.lineTo(this.w + 100, base);
      c.closePath(); c.fill();
    };
    draw(COLORS.hillFar, 46, 150, 0.3);
    draw(COLORS.hill, 30, 110, 0.6);
  }

  // ---------- road ----------

  _road(c, distance) {
    // ground fill
    const gg = c.createLinearGradient(0, HORIZON_Y, 0, this.h);
    gg.addColorStop(0, COLORS.ground);
    gg.addColorStop(1, '#0c1324');
    c.fillStyle = gg;
    c.fillRect(0, HORIZON_Y, this.w, this.h - HORIZON_Y);

    // scrolling ground bands (the sense of speed)
    const off = distance % BAND;
    for (let dFar = DRAW_DIST - off + BAND; dFar > 0; dFar -= BAND) {
      const dNear = dFar - BAND;
      const b = Math.min(DRAW_DIST, dFar);
      const a = Math.max(0, dNear);
      if (b <= 0 || a >= DRAW_DIST) continue;
      const tF = depthScale(b); const tN = depthScale(a);
      const yF = project(0, b).y; const yN = project(0, a).y;
      const hF = ROAD_HALF * tF; const hN = ROAD_HALF * tN;
      const worldIdx = Math.round((distance + dFar) / BAND);
      c.fillStyle = worldIdx % 2 ? COLORS.roadA : COLORS.roadB;
      c.beginPath();
      c.moveTo(CENTER_X - hF, yF); c.lineTo(CENTER_X + hF, yF);
      c.lineTo(CENTER_X + hN, yN); c.lineTo(CENTER_X - hN, yN);
      c.closePath(); c.fill();
    }

    // side rails (posts flowing toward the camera)
    this._rails(c, distance);

    // lane dividers
    this._laneStripes(c, -0.5, distance);
    this._laneStripes(c, 0.5, distance);

    // glowing road edges
    const nearH = ROAD_HALF; const farH = ROAD_HALF * depthScale(DRAW_DIST);
    c.strokeStyle = COLORS.roadEdgeGlow;
    c.lineWidth = 3;
    c.shadowColor = COLORS.roadEdgeGlow; c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(CENTER_X - farH, HORIZON_Y); c.lineTo(CENTER_X - nearH, GROUND_Y);
    c.moveTo(CENTER_X + farH, HORIZON_Y); c.lineTo(CENTER_X + nearH, GROUND_Y);
    c.stroke();
    c.shadowBlur = 0;
  }

  _rails(c, distance) {
    const step = 2.2;
    const off = distance % step;
    for (let d = DRAW_DIST - off; d > PASS_D; d -= step) {
      if (d > DRAW_DIST) continue;
      const t = depthScale(d);
      const ph = Math.max(2, 26 * t);
      for (const sgn of [-1, 1]) {
        const p = project(sgn * RAIL_X, d);
        c.fillStyle = COLORS.rail;
        c.fillRect(p.x - Math.max(1, 3 * t), p.y - ph, Math.max(2, 6 * t), ph);
        c.fillStyle = COLORS.roadEdgeGlow;
        c.fillRect(p.x - Math.max(1, 3 * t), p.y - ph, Math.max(2, 6 * t), Math.max(1, 3 * t));
      }
    }
  }

  _laneStripes(c, laneX, distance) {
    const period = 2.0;
    const phase = distance % period;
    c.fillStyle = COLORS.laneLine;
    for (let d = DRAW_DIST; d > 0; d -= period) {
      const dd = d - phase;
      if (dd <= 0.1 || dd > DRAW_DIST) continue;
      const a = project(laneX, dd);
      const b = project(laneX, Math.max(0.05, dd - period * 0.5));
      const wA = Math.max(1, 7 * a.t); const wB = Math.max(1, 7 * b.t);
      c.beginPath();
      c.moveTo(a.x - wA / 2, a.y); c.lineTo(a.x + wA / 2, a.y);
      c.lineTo(b.x + wB / 2, b.y); c.lineTo(b.x - wB / 2, b.y);
      c.closePath(); c.fill();
    }
  }

  // ---------- entities ----------

  _entities(c, game) {
    const sorted = [...game.entities].sort((a, b) => b.d - a.d);
    for (const e of sorted) {
      if (e.d > DRAW_DIST || e.d < PASS_D || e.taken) continue;
      if (e.kind === OB.COIN) this._coin(c, e);
      else this._obstacle(c, e);
    }
  }

  _obstacle(c, e) {
    const p = project(e.lane, e.d);
    const t = p.t;
    const laneW = ROAD_HALF * LANE_SPREAD * 0.9 * t;
    const unit = 70 * t;

    // contact shadow
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(p.x, p.y, laneW * 0.62, laneW * 0.2, 0, 0, Math.PI * 2);
    c.fill();

    if (e.kind === OB.BLOCK) {
      // tall container — cannot be jumped, must change lane
      const h = unit * 2.5;
      this._prism(c, p.x, p.y, laneW * 1.1, h, e.lane, COLORS.block, COLORS.blockDark, COLORS.blockLight);
      // warning chevrons
      c.fillStyle = 'rgba(0,0,0,.22)';
      for (let i = 0; i < 3; i += 1) {
        const yy = p.y - h + h * (0.28 + i * 0.22);
        c.fillRect(p.x - laneW * 1.1, yy, laneW * 2.2, Math.max(2, h * 0.05));
      }
    } else if (e.kind === OB.LOW) {
      // low hurdle — jump it. striped bar on two posts.
      const h = unit * 0.72;
      const topY = p.y - h;
      c.fillStyle = COLORS.lowDark;
      c.fillRect(p.x - laneW, topY, Math.max(2, 6 * t), h);
      c.fillRect(p.x + laneW - Math.max(2, 6 * t), topY, Math.max(2, 6 * t), h);
      const barH = Math.max(4, h * 0.42);
      const stripeW = Math.max(4, laneW * 0.32);
      for (let x = -laneW; x < laneW; x += stripeW) {
        c.fillStyle = Math.round(x / stripeW) % 2 ? COLORS.low : '#20242e';
        c.fillRect(p.x + x, topY, Math.min(stripeW, laneW - x), barH);
      }
      c.fillStyle = 'rgba(255,255,255,.18)';
      c.fillRect(p.x - laneW, topY, laneW * 2, Math.max(1, barH * 0.2));
    } else if (e.kind === OB.HIGH) {
      // overhead gantry — slide under it. gap at ground level.
      const postH = unit * 2.4;
      const topY = p.y - postH;
      const beamH = Math.max(5, unit * 0.5);
      const postW = Math.max(2, 7 * t);
      c.fillStyle = COLORS.highDark;
      c.fillRect(p.x - laneW * 1.15, topY, postW, postH);
      c.fillRect(p.x + laneW * 1.15 - postW, topY, postW, postH);
      // beam
      this._prismAt(c, p.x, topY, laneW * 1.25, beamH, e.lane, COLORS.high, COLORS.highDark, COLORS.highLight);
      // sign glow
      c.fillStyle = 'rgba(196,176,255,.5)';
      c.fillRect(p.x - laneW * 0.5, topY + beamH * 0.25, laneW, Math.max(2, beamH * 0.3));
    }
  }

  // Pseudo-3D box sitting on (x, baseY), rising by height. `lane` sets which
  // side face shows (parallax toward the vanishing point at centre).
  _prism(c, x, baseY, halfW, height, lane, face, dark, light) {
    this._prismAt(c, x, baseY - height, halfW, height, lane, face, dark, light);
  }

  _prismAt(c, x, topY, halfW, height, lane, face, dark, light) {
    const depth = Math.min(18, height * 0.22);
    const dir = lane < 0 ? 1 : -1; // show the side that faces the vanishing point
    // side face
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x + dir * halfW, topY);
    c.lineTo(x + dir * halfW + dir * depth * 0.7, topY - depth);
    c.lineTo(x + dir * halfW + dir * depth * 0.7, topY - depth + height);
    c.lineTo(x + dir * halfW, topY + height);
    c.closePath(); c.fill();
    // top face
    c.fillStyle = light;
    c.beginPath();
    c.moveTo(x - halfW, topY);
    c.lineTo(x + halfW, topY);
    c.lineTo(x + halfW + dir * depth * 0.7, topY - depth);
    c.lineTo(x - halfW + dir * depth * 0.7, topY - depth);
    c.closePath(); c.fill();
    // front face with vertical shade
    const g = c.createLinearGradient(x - halfW, 0, x + halfW, 0);
    g.addColorStop(0, face); g.addColorStop(0.5, light); g.addColorStop(1, face);
    c.fillStyle = g;
    c.fillRect(x - halfW, topY, halfW * 2, height);
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.fillRect(x - halfW, topY + height - Math.max(2, height * 0.08), halfW * 2, Math.max(2, height * 0.08));
  }

  _coin(c, e) {
    const p = project(e.lane, e.d);
    const r = Math.max(2, 16 * p.t);
    const cy = p.y - 46 * p.t;
    const wob = Math.abs(Math.cos(e.spin + e.d * 0.9));
    c.save();
    c.translate(p.x, cy);
    c.shadowColor = 'rgba(255,210,63,.6)'; c.shadowBlur = 10 * p.t;
    c.fillStyle = COLORS.coinEdge;
    c.beginPath(); c.ellipse(0, 0, Math.max(1.5, r * wob) + 2, r + 2, 0, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = COLORS.coin;
    c.beginPath(); c.ellipse(0, 0, Math.max(1, r * wob), r, 0, 0, Math.PI * 2); c.fill();
    if (r * wob > 4) {
      c.fillStyle = COLORS.coinShine;
      c.beginPath(); c.ellipse(-r * wob * 0.3, -r * 0.3, Math.max(1, r * wob * 0.32), r * 0.42, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ---------- player ----------

  _player(c, game) {
    const p = game.player;
    const proj = project(p.laneX, 0.02);
    const x = proj.x;
    const groundY = GROUND_Y;
    const lift = p.lift * JUMP_HEIGHT;
    const sliding = p.sliding;

    // shadow shrinks as the player rises
    const shScale = 1 - p.lift * 0.5;
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(x, groundY, 46 * shScale, 13 * shScale, 0, 0, Math.PI * 2);
    c.fill();

    const bob = sliding ? 0 : Math.sin(p.runT * 0.4) * 3;
    this._runner(c, x, groundY - lift - bob, p, sliding);
  }

  _runner(c, x, footY, p, sliding) {
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) c.globalAlpha = 0.35;

    const swing = sliding ? 0 : Math.sin(p.runT * 0.4) * 11;
    const bodyH = sliding ? 34 : 78;
    const bodyW = sliding ? 74 : 46;
    const topY = footY - bodyH;

    // legs
    if (!sliding) {
      c.strokeStyle = COLORS.playerDark; c.lineWidth = 11; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - 9, footY - 34); c.lineTo(x - 9 + swing, footY);
      c.moveTo(x + 9, footY - 34); c.lineTo(x + 9 - swing, footY);
      c.stroke();
    } else {
      // tucked legs streaming back
      c.strokeStyle = COLORS.playerDark; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x + bodyW * 0.2, footY - 8); c.lineTo(x + bodyW * 0.5, footY - 4);
      c.stroke();
    }

    // body (rounded, with light gradient)
    const g = c.createLinearGradient(x - bodyW / 2, topY, x + bodyW / 2, topY + bodyH);
    g.addColorStop(0, COLORS.playerLight);
    g.addColorStop(0.5, COLORS.player);
    g.addColorStop(1, COLORS.playerDark);
    c.fillStyle = g;
    this._roundRect(c, x - bodyW / 2, topY, bodyW, bodyH, sliding ? 16 : 15); c.fill();

    // arms
    if (!sliding) {
      c.strokeStyle = COLORS.player; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - bodyW / 2 + 3, topY + 26); c.lineTo(x - bodyW / 2 - 7, topY + 26 - swing);
      c.moveTo(x + bodyW / 2 - 3, topY + 26); c.lineTo(x + bodyW / 2 + 7, topY + 26 + swing);
      c.stroke();
    }

    // head
    const headR = sliding ? 14 : 17;
    const headCx = sliding ? x - bodyW * 0.28 : x;
    const headCy = sliding ? topY + 2 : topY - headR + 3;
    c.fillStyle = COLORS.playerSkin;
    c.beginPath(); c.arc(headCx, headCy, headR, 0, Math.PI * 2); c.fill();
    // cap
    c.fillStyle = COLORS.playerDark;
    c.beginPath(); c.arc(headCx, headCy, headR, Math.PI * 0.96, Math.PI * 2.04); c.fill();
    c.fillRect(headCx - headR, headCy - 2, headR * (sliding ? -1.4 : 1.5), 4);

    c.globalAlpha = 1;
  }

  // ---------- effects ----------

  _effects(c, game) {
    for (const fx of game.effects) {
      if (fx.type === 'flash') {
        c.fillStyle = `rgba(255,90,106,${0.4 * (1 - fx.t / fx.life)})`;
        c.fillRect(0, 0, this.w, this.h);
      } else if (fx.type === 'spark') {
        const proj = project(fx.lane, 0);
        const prog = fx.t / fx.life;
        c.strokeStyle = `rgba(255,215,90,${1 - prog})`;
        c.lineWidth = 3;
        c.beginPath(); c.arc(proj.x, GROUND_Y - 60, 8 + prog * 40, 0, Math.PI * 2); c.stroke();
      }
    }
    // speed lines at high speed
    const boost = (game.speed - 0.185) / (0.42 - 0.185);
    if (boost > 0.35) {
      c.strokeStyle = `rgba(180,210,255,${0.06 + boost * 0.12})`;
      c.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const yy = (game.frames * (6 + i * 2) + i * 130) % this.h;
        const side = i % 2 ? 26 : this.w - 26;
        c.beginPath(); c.moveTo(side, yy); c.lineTo(side, yy + 40); c.stroke();
      }
    }
  }

  // ---------- HUD (inside the canvas) ----------

  _hud(c, game) {
    const sec = Math.floor(game.frames / 60);
    const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    c.textBaseline = 'alphabetic';
    // score
    c.fillStyle = COLORS.hud;
    c.font = '800 34px "Segoe UI", system-ui, sans-serif';
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 6; c.shadowOffsetY = 1;
    c.fillText(String(Math.floor(game.score)), 18, 44);
    c.shadowBlur = 0; c.shadowOffsetY = 0;

    // time + coins under the score
    c.font = '700 15px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = COLORS.hudDim;
    c.fillText(`TIME ${time}`, 19, 66);
    c.fillStyle = COLORS.coin;
    c.beginPath(); c.arc(112, 61, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.hud;
    c.fillText(`${game.coins}`, 122, 66);

    // hearts top-right
    const n = START_LIVES;
    c.font = '22px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'right';
    for (let i = 0; i < n; i += 1) {
      const filled = i < game.lives;
      c.fillStyle = filled ? COLORS.heart : 'rgba(255,255,255,.25)';
      c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 4;
      c.fillText(filled ? '♥' : '♡', this.w - 16 - (n - 1 - i) * 26, 40);
    }
    c.shadowBlur = 0;
    c.textAlign = 'left';

    // best (small, top-right under hearts)
    c.font = '700 13px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = COLORS.hudDim;
    c.textAlign = 'right';
    c.fillText(`BEST ${game.best}`, this.w - 16, 62);
    c.textAlign = 'left';
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

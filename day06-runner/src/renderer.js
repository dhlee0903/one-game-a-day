// Read-only renderer. Paints a dusk sky with distant hills and horizon haze, a
// three-lane asphalt road with grass shoulders / painted edge lines / dashed
// lane dividers, roadside streetlights that flow past for a sense of speed,
// obstacles and coins (drawn far-to-near and flowing off the bottom), an
// athletic runner with jump/slide animation, effects, and the HUD — all inside
// the canvas. Never mutates game state.

import {
  VIEW_W, VIEW_H, HORIZON_Y, GROUND_Y, DRAW_DIST, PASS_D, ROAD_HALF,
  LANE_SPREAD, JUMP_HEIGHT, START_LIVES, OB, COLORS,
} from './config.js';
import { project, depthScale, CENTER_X } from './projection.js';

const LAMP_X = 1.92;           // streetlights just outside the road edge
const BAND = 1.7;              // world length of one asphalt band

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

    let sx = 0; let sy = 0;
    if (game.shake > 0) {
      const m = game.shake / 16;
      sx = (Math.random() * 2 - 1) * 7 * m;
      sy = (Math.random() * 2 - 1) * 7 * m;
    }
    c.save();
    c.translate(sx, sy);

    this._sky(c, game);
    this._ground(c);
    this._road(c, game.distance);
    this._streetlights(c, game.distance);
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
    g.addColorStop(0.4, COLORS.sky1);
    g.addColorStop(0.72, COLORS.sky2);
    g.addColorStop(0.9, COLORS.sky3);
    g.addColorStop(1, COLORS.sky4);
    c.fillStyle = g;
    c.fillRect(-20, 0, this.w + 40, HORIZON_Y + 2);

    // stars in the upper sky
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 97) % this.w;
      const y = (i * 53) % (HORIZON_Y * 0.5);
      c.globalAlpha = 0.15 + ((i * 7) % 10) / 20;
      c.fillRect(x, y, 1.6, 1.6);
    }
    c.globalAlpha = 1;

    // sun
    const sun = c.createRadialGradient(CENTER_X, HORIZON_Y - 4, 6, CENTER_X, HORIZON_Y - 4, 130);
    sun.addColorStop(0, 'rgba(255,240,205,.95)');
    sun.addColorStop(0.5, 'rgba(255,175,115,.35)');
    sun.addColorStop(1, 'rgba(255,175,115,0)');
    c.fillStyle = sun;
    c.beginPath(); c.arc(CENTER_X, HORIZON_Y - 4, 130, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe6b4';
    c.beginPath(); c.arc(CENTER_X, HORIZON_Y - 8, 36, 0, Math.PI * 2); c.fill();

    this._hills(c, game.distance);
  }

  _hills(c, distance) {
    const base = HORIZON_Y;
    const layer = (color, h, wd, speed) => {
      const drift = (distance * speed) % wd;
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-100, base);
      for (let x = -100; x <= this.w + 120; x += wd) {
        const px = x - drift;
        c.lineTo(px, base - h * (0.55 + 0.45 * Math.sin(x * 0.7)));
        c.lineTo(px + wd / 2, base - h * (0.85 + 0.2 * Math.cos(x * 1.3)));
      }
      c.lineTo(this.w + 120, base); c.closePath(); c.fill();
    };
    layer(COLORS.hillFar, 50, 168, 0.22);
    layer(COLORS.hill, 32, 116, 0.4);
  }

  // ---------- ground + road ----------

  _ground(c) {
    const g = c.createLinearGradient(0, HORIZON_Y, 0, this.h);
    g.addColorStop(0, COLORS.grass1);
    g.addColorStop(1, COLORS.grass2);
    c.fillStyle = g;
    c.fillRect(0, HORIZON_Y, this.w, this.h - HORIZON_Y);
  }

  _road(c, distance) {
    const nearH = ROAD_HALF;
    const farH = ROAD_HALF * depthScale(DRAW_DIST);

    // asphalt base
    c.fillStyle = COLORS.asphalt1;
    c.beginPath();
    c.moveTo(CENTER_X - farH, HORIZON_Y); c.lineTo(CENTER_X + farH, HORIZON_Y);
    c.lineTo(CENTER_X + nearH, GROUND_Y); c.lineTo(CENTER_X - nearH, GROUND_Y);
    c.closePath(); c.fill();

    // subtle scrolling bands (low-contrast asphalt tone variation)
    const off = distance % BAND;
    for (let dFar = DRAW_DIST - off + BAND; dFar > 0; dFar -= BAND) {
      const dNear = dFar - BAND;
      const b = Math.min(DRAW_DIST, dFar);
      const a = Math.max(0, dNear);
      if (b <= 0 || a >= DRAW_DIST) continue;
      if (Math.round((distance + dFar) / BAND) % 2) continue;
      const hF = ROAD_HALF * depthScale(b); const hN = ROAD_HALF * depthScale(a);
      const yF = project(0, b).y; const yN = project(0, a).y;
      c.fillStyle = COLORS.asphalt2;
      c.beginPath();
      c.moveTo(CENTER_X - hF, yF); c.lineTo(CENTER_X + hF, yF);
      c.lineTo(CENTER_X + hN, yN); c.lineTo(CENTER_X - hN, yN);
      c.closePath(); c.fill();
    }

    // dashed lane dividers (between the three lanes)
    this._laneStripes(c, -0.5, distance);
    this._laneStripes(c, 0.5, distance);

    // solid painted road edges
    c.strokeStyle = COLORS.edgeLine;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(CENTER_X - farH, HORIZON_Y); c.lineTo(CENTER_X - nearH, GROUND_Y);
    c.moveTo(CENTER_X + farH, HORIZON_Y); c.lineTo(CENTER_X + nearH, GROUND_Y);
    c.stroke();

    // horizon haze — road/terrain fade into the dusk near the vanishing point
    const fog = c.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 90);
    fog.addColorStop(0, COLORS.fog);
    fog.addColorStop(1, 'rgba(122,106,142,0)');
    c.fillStyle = fog;
    c.fillRect(0, HORIZON_Y, this.w, 90);
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
      const wA = Math.max(1, 6 * a.t); const wB = Math.max(1, 6 * b.t);
      c.beginPath();
      c.moveTo(a.x - wA / 2, a.y); c.lineTo(a.x + wA / 2, a.y);
      c.lineTo(b.x + wB / 2, b.y); c.lineTo(b.x - wB / 2, b.y);
      c.closePath(); c.fill();
    }
  }

  // Roadside streetlights, flowing toward the camera — the sense of speed the
  // old neon lines were trying (and failing) to convey, but readable this time.
  _streetlights(c, distance) {
    const step = 5.0;
    const off = distance % step;
    // draw far-to-near so nearer poles overlap correctly
    for (let d = DRAW_DIST - off; d > PASS_D; d -= step) {
      if (d > DRAW_DIST) continue;
      for (const sgn of [-1, 1]) this._lamp(c, sgn, d);
    }
  }

  _lamp(c, sgn, d) {
    const base = project(sgn * LAMP_X, d);
    const t = base.t;
    const poleH = 150 * t;
    const topY = base.y - poleH;
    const pw = Math.max(1.5, 4 * t);

    // pole
    c.fillStyle = COLORS.poleDark;
    c.fillRect(base.x - pw / 2, topY, pw, poleH);
    c.fillStyle = COLORS.pole;
    c.fillRect(base.x - pw / 2, topY, Math.max(1, pw * 0.5), poleH);

    // arm reaching over the road + lamp head
    const armLen = -sgn * 34 * t;
    c.strokeStyle = COLORS.pole; c.lineWidth = Math.max(1.5, 3 * t);
    c.beginPath(); c.moveTo(base.x, topY + 2); c.lineTo(base.x + armLen, topY + 2); c.stroke();
    const lx = base.x + armLen; const ly = topY + 4;
    // glow
    const r = 34 * t;
    const gl = c.createRadialGradient(lx, ly, 1, lx, ly, r);
    gl.addColorStop(0, 'rgba(255,217,160,.6)');
    gl.addColorStop(1, 'rgba(255,217,160,0)');
    c.fillStyle = gl;
    c.beginPath(); c.arc(lx, ly, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.lampGlow;
    c.beginPath(); c.ellipse(lx, ly, Math.max(2, 6 * t), Math.max(1.2, 3.5 * t), 0, 0, Math.PI * 2); c.fill();
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
    const laneW = ROAD_HALF * LANE_SPREAD * 0.38 * t;
    const unit = 70 * t;

    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(p.x, p.y, laneW * 1.0, laneW * 0.32, 0, 0, Math.PI * 2);
    c.fill();

    if (e.kind === OB.BLOCK) {
      const h = unit * 2.5;
      this._prism(c, p.x, p.y, laneW, h, e.lane, COLORS.block, COLORS.blockDark, COLORS.blockLight);
      c.fillStyle = 'rgba(0,0,0,.22)';
      for (let i = 0; i < 3; i += 1) {
        const yy = p.y - h + h * (0.28 + i * 0.22);
        c.fillRect(p.x - laneW, yy, laneW * 2, Math.max(2, h * 0.05));
      }
    } else if (e.kind === OB.LOW) {
      // low hurdle — jump it. FIXED stripe count so the pattern scales smoothly
      // instead of wobbling as it approaches.
      const h = unit * 0.72;
      const topY = p.y - h;
      c.fillStyle = COLORS.lowDark;
      c.fillRect(p.x - laneW, topY, Math.max(2, 6 * t), h);
      c.fillRect(p.x + laneW - Math.max(2, 6 * t), topY, Math.max(2, 6 * t), h);
      const barH = Math.max(4, h * 0.44);
      const segs = 6;
      const segW = (laneW * 2) / segs;
      for (let i = 0; i < segs; i += 1) {
        c.fillStyle = i % 2 ? COLORS.low : '#1a1e26';
        c.fillRect(p.x - laneW + i * segW, topY, segW + 0.6, barH);
      }
      c.fillStyle = 'rgba(255,255,255,.16)';
      c.fillRect(p.x - laneW, topY, laneW * 2, Math.max(1, barH * 0.2));
    } else if (e.kind === OB.HIGH) {
      const postH = unit * 2.4;
      const topY = p.y - postH;
      const beamH = Math.max(5, unit * 0.5);
      const postW = Math.max(2, 7 * t);
      c.fillStyle = COLORS.highDark;
      c.fillRect(p.x - laneW * 1.0, topY, postW, postH);
      c.fillRect(p.x + laneW * 1.0 - postW, topY, postW, postH);
      this._prismAt(c, p.x, topY, laneW * 1.05, beamH, e.lane, COLORS.high, COLORS.highDark, COLORS.highLight);
      c.fillStyle = 'rgba(196,176,255,.5)';
      c.fillRect(p.x - laneW * 0.5, topY + beamH * 0.25, laneW, Math.max(2, beamH * 0.3));
    }
  }

  _prism(c, x, baseY, halfW, height, lane, face, dark, light) {
    this._prismAt(c, x, baseY - height, halfW, height, lane, face, dark, light);
  }

  _prismAt(c, x, topY, halfW, height, lane, face, dark, light) {
    const depth = Math.min(9, height * 0.13);
    const dir = lane < 0 ? 1 : -1;
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x + dir * halfW, topY);
    c.lineTo(x + dir * halfW + dir * depth * 0.7, topY - depth);
    c.lineTo(x + dir * halfW + dir * depth * 0.7, topY - depth + height);
    c.lineTo(x + dir * halfW, topY + height);
    c.closePath(); c.fill();
    c.fillStyle = light;
    c.beginPath();
    c.moveTo(x - halfW, topY);
    c.lineTo(x + halfW, topY);
    c.lineTo(x + halfW + dir * depth * 0.7, topY - depth);
    c.lineTo(x - halfW + dir * depth * 0.7, topY - depth);
    c.closePath(); c.fill();
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

    const shScale = 1 - p.lift * 0.5;
    c.fillStyle = COLORS.shadow;
    c.beginPath();
    c.ellipse(x, groundY, 40 * shScale, 12 * shScale, 0, 0, Math.PI * 2);
    c.fill();

    c.save();
    c.translate(x, groundY - lift);
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) c.globalAlpha = 0.4;
    if (p.sliding) this._runnerSlide(c, p);
    else this._runnerRun(c, p);
    c.globalAlpha = 1;
    c.restore();
  }

  // Athletic runner: beanie, hoodie, backpack, joggers, sneakers. Origin at the
  // feet (0,0), drawn upward.
  _runnerRun(c, p) {
    const s = Math.sin(p.runT * 0.36);
    const bob = Math.sin(p.runT * 0.72) * 2;
    c.save();
    c.translate(0, -bob);

    // --- legs (behind body) ---
    this._leg(c, -6, s * 12);
    this._leg(c, 6, -s * 12);

    // --- backpack (behind torso) ---
    c.fillStyle = COLORS.pack;
    this._rr(c, -22, -70, 16, 30, 6); c.fill();
    c.fillStyle = COLORS.packLight;
    this._rr(c, -20, -66, 8, 14, 4); c.fill();

    // --- torso: hoodie ---
    const g = c.createLinearGradient(-16, -74, 16, -34);
    g.addColorStop(0, COLORS.hoodieLight);
    g.addColorStop(0.55, COLORS.hoodie);
    g.addColorStop(1, COLORS.hoodieDark);
    c.fillStyle = g;
    this._rr(c, -17, -76, 34, 46, 13); c.fill();
    // hood at the neck
    c.fillStyle = COLORS.hoodieDark;
    this._rr(c, -13, -80, 26, 12, 6); c.fill();
    // drawstring pocket line
    c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-12, -44); c.lineTo(12, -44); c.stroke();

    // --- arms ---
    this._arm(c, -17, -s * 13);
    this._arm(c, 17, s * 13);

    // --- head ---
    this._head(c, -83);

    c.restore();
  }

  _leg(c, hipX, swing) {
    const footX = hipX + swing;
    // jogger
    c.strokeStyle = COLORS.pants; c.lineWidth = 11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hipX, -34); c.lineTo(footX, -6); c.stroke();
    c.strokeStyle = COLORS.pantsDark; c.lineWidth = 4;
    c.beginPath(); c.moveTo(hipX, -34); c.lineTo(footX, -8); c.stroke();
    // sneaker
    c.fillStyle = COLORS.shoe;
    this._rr(c, footX - 7, -8, 15, 8, 4); c.fill();
    c.fillStyle = COLORS.shoeSole;
    c.fillRect(footX - 7, -2, 15, 3);
  }

  _arm(c, shoulderX, swing) {
    const dir = shoulderX < 0 ? -1 : 1;
    const handX = shoulderX + dir * 5 + swing * 0.4;
    const handY = -50 + Math.abs(swing) * 0.2;
    c.strokeStyle = COLORS.hoodie; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(shoulderX, -70); c.lineTo(handX, handY); c.stroke();
    c.fillStyle = COLORS.skin;
    c.beginPath(); c.arc(handX, handY, 4, 0, Math.PI * 2); c.fill();
  }

  _head(c, cy) {
    // face
    c.fillStyle = COLORS.skin;
    c.beginPath(); c.arc(0, cy, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.skinDark;
    c.beginPath(); c.arc(2, cy + 2, 15, -0.3, 0.9); c.fill();
    // beanie
    c.fillStyle = COLORS.beanie;
    c.beginPath(); c.arc(0, cy, 15, Math.PI * 1.04, Math.PI * 2.04); c.fill();
    c.fillStyle = COLORS.beanieCuff;
    c.fillRect(-15, cy - 3, 30, 5);
    c.fillStyle = COLORS.beanie;
    c.beginPath(); c.arc(0, cy - 15, 4, 0, Math.PI * 2); c.fill(); // pom
  }

  _runnerSlide(c, p) {
    // leaning-back slide: low, elongated, with a dust puff behind
    c.save();
    // dust
    const dust = (Math.floor(p.slideT / 3) % 2) ? 0.5 : 0.35;
    c.fillStyle = `rgba(200,205,215,${dust})`;
    for (let i = 0; i < 4; i += 1) {
      c.beginPath(); c.arc(24 + i * 10, -6, 5 + i * 2, 0, Math.PI * 2); c.fill();
    }

    // legs extended forward (to the left/front)
    c.strokeStyle = COLORS.pants; c.lineWidth = 11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(2, -18); c.lineTo(-30, -10); c.stroke();
    c.fillStyle = COLORS.shoe;
    this._rr(c, -38, -14, 15, 9, 4); c.fill();
    c.fillStyle = COLORS.shoeSole; c.fillRect(-38, -14, 15, 3);

    // torso reclined
    const g = c.createLinearGradient(-20, -34, 20, -10);
    g.addColorStop(0, COLORS.hoodieLight);
    g.addColorStop(1, COLORS.hoodieDark);
    c.fillStyle = g;
    c.save();
    c.rotate(-0.5);
    this._rr(c, -6, -30, 46, 26, 12); c.fill();
    c.restore();

    // head (leaned back, toward front)
    c.translate(-14, -26);
    c.fillStyle = COLORS.skin;
    c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.beanie;
    c.beginPath(); c.arc(0, 0, 13, Math.PI * 0.7, Math.PI * 1.9); c.fill();
    c.restore();
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
        c.beginPath(); c.arc(proj.x, GROUND_Y - 50, 8 + prog * 40, 0, Math.PI * 2); c.stroke();
      }
    }
    const boost = (game.speed - 0.185) / (0.42 - 0.185);
    if (boost > 0.4) {
      c.strokeStyle = `rgba(210,220,255,${0.05 + boost * 0.1})`;
      c.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const yy = (game.frames * (6 + i * 2) + i * 130) % this.h;
        const side = i % 2 ? 20 : this.w - 20;
        c.beginPath(); c.moveTo(side, yy); c.lineTo(side, yy + 44); c.stroke();
      }
    }
  }

  // ---------- HUD ----------

  _hud(c, game) {
    const sec = Math.floor(game.frames / 60);
    const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    c.textBaseline = 'alphabetic';
    c.fillStyle = COLORS.hud;
    c.font = '800 34px "Segoe UI", system-ui, sans-serif';
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 6; c.shadowOffsetY = 1;
    c.fillText(String(Math.floor(game.score)), 18, 44);
    c.shadowBlur = 0; c.shadowOffsetY = 0;

    c.font = '700 15px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = COLORS.hudDim;
    c.fillText(`TIME ${time}`, 19, 66);
    c.fillStyle = COLORS.coin;
    c.beginPath(); c.arc(112, 61, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = COLORS.hud;
    c.fillText(`${game.coins}`, 122, 66);

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

    c.font = '700 13px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = COLORS.hudDim;
    c.fillText(`BEST ${game.best}`, this.w - 16, 62);
    c.textAlign = 'left';
  }

  // rounded-rect path helper
  _rr(c, x, y, w, h, r) {
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

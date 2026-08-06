// 읽기 전용 렌더러 — 도트(픽셀) 그래픽. 모든 것을 PX 격자에 스냅해서 그린다.
// 스프라이트는 문자 픽셀맵(sprites.js), 색은 팔레트로 갈아끼운다.

import { W, H, HUD_H, BOSS, VERSION } from './config.js';
import { PLAYER, ENEMY, BOMBER, BOSS as BOSS_SPR, DRONE, FONT } from './sprites.js';

const PX = 2;                    // 도트 하나의 논리 크기
const snap = (v) => Math.round(v / PX) * PX;
const LOOP = 1500;

// 팔레트: 스프라이트 문자 → 색
const PAL = {
  player: { K: '#16324f', E: '#2f6fd0', W: '#dbe6f5', C: '#8fd8ff', P: '#b9cde6', G: '#3c4552', Y: '#ffd23f' },
  grunt: { K: '#173a1c', E: '#4aa054', W: '#cfe3cd', C: '#ffe9a8', P: '#9fb79c', G: '#2b3a2c', Y: '#ffd23f' },
  zig: { K: '#4a3410', E: '#e0a32c', W: '#f7e6bd', C: '#ffe9a8', P: '#c9b184', G: '#4a3a1c', Y: '#ffd23f' },
  diver: { K: '#4d1512', E: '#d8453c', W: '#f6d3d0', C: '#ffe0a8', P: '#c49a96', G: '#3f1a17', Y: '#ffd23f' },
  gunner: { K: '#232b36', E: '#68758a', W: '#c3cddb', C: '#ffd27a', P: '#93a0b2', G: '#39424f', Y: '#ffd23f' },
  boss: { K: '#1b2330', E: '#5b6a80', W: '#aab8cb', C: '#ffd27a', P: '#8d9bb0', G: '#333d4a', Y: '#ff8a3c' },
};
const ENEMY_PAL = { grunt: PAL.grunt, zig: PAL.zig, diver: PAL.diver };

const ISLANDS = [
  { x: 52, y: 120, r: 26, kind: 'sand' },
  { x: 306, y: 400, r: 20, kind: 'green' },
  { x: 150, y: 700, r: 32, kind: 'green' },
  { x: 36, y: 980, r: 17, kind: 'sand' },
  { x: 328, y: 1160, r: 24, kind: 'sand' },
  { x: 210, y: 1330, r: 15, kind: 'green' },
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  render(game) {
    const c = this.ctx;
    this._sea(c, game.scroll);
    this._pickups(c, game.pickups);
    this._enemies(c, game.enemies);
    this._boss(c, game.boss);
    this._player(c, game);
    this._bullets(c, game);
    this._fx(c, game.fx);
    if (game.bombFlash > 0) {
      c.fillStyle = `rgba(255,255,255,${(game.bombFlash / 34) * 0.7})`;
      c.fillRect(0, 0, W, H);
    }
    this._hud(c, game);
  }

  // ---- 픽셀 원시 도형 ----

  _px(c, x, y, w = 1, h = 1) {
    c.fillRect(snap(x), snap(y), w * PX, h * PX);
  }

  // 스프라이트를 (cx,cy) 중심에 그린다. scale은 도트 배율(정수).
  _spr(c, rows, pal, cx, cy, scale = 1) {
    const s = PX * scale;
    const w = rows[0].length;
    const x0 = snap(cx - (w * s) / 2);
    const y0 = snap(cy - (rows.length * s) / 2);
    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r];
      let run = 0;
      let runCh = null;
      for (let i = 0; i <= row.length; i += 1) {
        const ch = row[i];
        if (ch === runCh) { run += 1; continue; }
        if (runCh && runCh !== '.') {                 // 같은 색은 한 번에 그린다
          c.fillStyle = pal[runCh] || '#f0f';
          c.fillRect(x0 + (i - run) * s, y0 + r * s, run * s, s);
        }
        runCh = ch; run = 1;
      }
    }
  }

  // 격자에 스냅된 타원 — 가장자리가 계단처럼 보여 도트 느낌이 난다
  _blob(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    const x0 = snap(cx - rx); const x1 = snap(cx + rx);
    const y0 = snap(cy - ry); const y1 = snap(cy + ry);
    for (let y = y0; y <= y1; y += PX) {
      const dy = (y + PX / 2 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const sx = snap(cx - half); const ex = snap(cx + half);
      if (ex > sx) c.fillRect(sx, y, ex - sx, PX);
    }
  }

  _text(c, str, x, y, color, scale = 1) {
    const s = PX * scale;
    c.fillStyle = color;
    let cx = snap(x);
    for (const raw of String(str).toUpperCase()) {
      const g = FONT[raw];
      if (!g) { cx += 4 * s; continue; }
      for (let r = 0; r < 5; r += 1) {
        for (let i = 0; i < 3; i += 1) {
          if (g[r][i] === '1') c.fillRect(cx + i * s, snap(y) + r * s, s, s);
        }
      }
      cx += 4 * s;
    }
    return cx;
  }

  // ---- 배경 ----

  _sea(c, scroll) {
    // 깊이별 색 띠(그라데이션 대신 단색 밴드 — 도트 감성)
    const bands = ['#4fb8ee', '#38a5e0', '#2b93d2', '#1f80c2'];
    const bh = Math.ceil(H / bands.length / PX) * PX;
    for (let i = 0; i < bands.length; i += 1) {
      c.fillStyle = bands[i];
      c.fillRect(0, i * bh, W, bh);
    }
    // 디더링 — 밴드 경계를 점으로 섞는다
    c.fillStyle = 'rgba(255,255,255,.10)';
    for (let i = 1; i < bands.length; i += 1) {
      const y = i * bh;
      for (let x = 0; x < W; x += PX * 2) this._px(c, x + (i % 2) * PX, y - PX);
    }
    // 파도 — 2도트 짜리 흰 점선이 아래로 흐른다
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let k = 0; k < 22; k += 1) {
      const y = ((k * 42 + scroll) % (H + 60)) - 30;
      const x = ((k * 97) % (W - 30)) + 8;
      this._px(c, x, y, 3, 1);
      this._px(c, x + 5 * PX, y + PX, 2, 1);
    }
    // 섬
    for (const isl of ISLANDS) {
      const y = (isl.y + scroll) % LOOP;
      if (y < -100 || y > H + 100) continue;
      this._island(c, isl.x, y, isl.r, isl.kind);
    }
  }

  _island(c, x, y, r, kind) {
    this._blob(c, x, y, r * 1.25, r * 0.98, 'rgba(255,255,255,.30)'); // 여울
    this._blob(c, x, y, r, r * 0.78, '#efdca8');                      // 모래
    if (kind === 'green') {
      this._blob(c, x - r * 0.1, y - r * 0.06, r * 0.64, r * 0.48, '#5cae57');
      this._blob(c, x + r * 0.25, y + r * 0.12, r * 0.28, r * 0.2, '#478f45');
    }
  }

  // ---- 기체 ----

  _player(c, game) {
    const p = game.player;
    if (game.phase === 'dead' && game.lives < 0) return;
    if (p.invul > 0 && Math.floor(p.invul / 4) % 2 === 0) return;
    for (let i = 0; i < game.options; i += 1) {
      this._spr(c, DRONE, PAL.player, p.x + (i === 0 ? -26 : 26), p.y + 10, 1);
    }
    this._spr(c, PLAYER, PAL.player, p.x, p.y, 2);
  }

  _enemies(c, list) {
    for (const e of list) {
      const flash = e.hit > 0;
      if (e.type === 'gunner') this._spr(c, BOMBER, flash ? this._white(PAL.gunner) : PAL.gunner, e.x, e.y, 2);
      else this._spr(c, ENEMY, flash ? this._white(ENEMY_PAL[e.type]) : ENEMY_PAL[e.type], e.x, e.y, 2);
    }
  }

  // 피격 순간엔 스프라이트를 하얗게 — 도트 게임의 관례
  _white(pal) {
    const out = {};
    for (const k of Object.keys(pal)) out[k] = k === 'K' ? '#7a8496' : '#ffffff';
    return out;
  }

  _boss(c, b) {
    if (!b) return;
    this._spr(c, BOSS_SPR, b.hit > 0 ? this._white(PAL.boss) : PAL.boss, b.x, b.y, 4);
  }

  // ---- 탄 ----

  _bullets(c, game) {
    for (const b of game.pb) {
      c.fillStyle = '#fff9c4';
      this._px(c, b.x - PX, b.y - PX * 2, 2, 4);
      c.fillStyle = '#ffe14d';
      this._px(c, b.x - PX, b.y - PX, 2, 2);
    }
    for (const b of game.eb) {
      c.fillStyle = '#ff8f88';                 // 바깥 테
      this._px(c, b.x - PX * 2, b.y - PX, 4, 2);
      this._px(c, b.x - PX, b.y - PX * 2, 2, 4);
      c.fillStyle = '#ff2f24';                 // 심
      this._px(c, b.x - PX, b.y - PX, 2, 2);
      c.fillStyle = '#fff0ee';
      this._px(c, b.x - PX, b.y - PX, 1, 1);
    }
  }

  // ---- 아이템 ----

  _pickups(c, list) {
    const COL = { P: '#ff5a63', O: '#3fce6a', B: '#3aa0ff', L: '#ffb03a' };
    for (const it of list) {
      const bob = Math.sin(it.t / 9) * 2;
      const x = it.x; const y = it.y + bob;
      c.fillStyle = '#ffffff';
      this._px(c, x - PX * 6, y - PX * 6, 12, 12);
      c.fillStyle = '#1b2330';
      this._px(c, x - PX * 5, y - PX * 5, 10, 10);
      c.fillStyle = COL[it.kind] || '#888';
      this._px(c, x - PX * 4, y - PX * 4, 8, 8);
      this._text(c, it.kind, x - PX * 1.5, y - PX * 2.5, '#ffffff', 1);
    }
  }

  // ---- 폭발: 도트 파편 ----

  _fx(c, list) {
    for (const f of list) {
      const p = f.t / f.life;
      const rad = f.r * (0.3 + p * 1.15);
      c.fillStyle = p < 0.45 ? '#fff6c8' : '#ff9a3c';
      const n = 8;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + f.x * 0.01;
        this._px(c, f.x + Math.cos(a) * rad, f.y + Math.sin(a) * rad, 2, 2);
      }
      if (p < 0.5) {
        c.fillStyle = '#ffffff';
        this._px(c, f.x - PX * 1.5, f.y - PX * 1.5, 3, 3);
      }
    }
  }

  // ---- HUD ----

  _hud(c, game) {
    c.fillStyle = '#0b2036';   // 불투명 — 위에서 진입하는 적기를 가려준다
    c.fillRect(0, 0, W, HUD_H);
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 0; x < W; x += PX * 2) this._px(c, x, HUD_H - PX);

    this._text(c, String(game.score).padStart(6, '0'), 8, 8, '#ffffff', 2);
    this._text(c, `BEST ${Math.max(game.best, game.score)}`, 8, 26, '#a9d8ff', 1);

    // 목숨(작은 기체) · 폭탄(도트 원)
    for (let i = 0; i < Math.max(0, game.lives); i += 1) {
      this._spr(c, PLAYER, PAL.player, W - 16 - i * 18, 15, 1);
    }
    for (let i = 0; i < game.bombs; i += 1) {
      const x = W - 16 - i * 14;
      c.fillStyle = '#ffd23f';
      this._px(c, x - PX * 2, 28, 4, 4);
      c.fillStyle = '#fff6c8';
      this._px(c, x - PX * 2, 28, 2, 2);
    }
    this._text(c, `PWR ${game.power}${game.options ? ` +${game.options}` : ''}`, W / 2 - 34, 10, '#ffffff', 1);

    const b = game.boss;
    if (b && b.state !== 'enter') {
      const bw = Math.floor((W - 40) / PX) * PX;
      c.fillStyle = '#1b2330';
      c.fillRect(20, HUD_H + 2, bw, 8);
      const ratio = Math.max(0, b.hp / b.maxHp);
      c.fillStyle = ratio <= BOSS.phase3 ? '#ff2f24' : (ratio <= BOSS.phase2 ? '#ff9a2e' : '#ffd23f');
      c.fillRect(20, HUD_H + 2, Math.max(PX, snap(bw * ratio)), 8);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.fillRect(20, HUD_H + 2, Math.max(PX, snap(bw * ratio)), PX);
    }

    this._text(c, VERSION, W - 32, H - 12, 'rgba(255,255,255,.45)', 1);
  }
}

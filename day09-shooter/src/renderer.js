// 읽기 전용 렌더러: 게임 상태를 캔버스에 그린다. 상태를 바꾸지 않는다.
// 배경은 밝은 대낮 바다 — 파도선과 섬이 아래로 흐른다.

import { W, H, HUD_H, PLAYER, BOSS, VERSION } from './config.js';

const LOOP = 1500; // 섬 배치가 반복되는 세계 높이

// 고정 배치(매 프레임 난수를 쓰지 않아 깜빡이지 않는다)
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

  // ---- 배경 ----

  _sea(c, scroll) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5cc0f0');
    g.addColorStop(0.5, '#2f9fdd');
    g.addColorStop(1, '#1c7fc0');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // 파도선
    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.lineWidth = 2; c.lineCap = 'round';
    for (let k = 0; k < 14; k += 1) {
      const y = ((k * 58 + scroll) % (H + 80)) - 40;
      const off = (k % 3) * 90;
      c.beginPath();
      for (let i = 0; i < 3; i += 1) {
        const x = ((i * 130 + off + k * 37) % (W + 60)) - 30;
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 14, y - 4, x + 28, y);
      }
      c.stroke();
    }

    // 섬
    for (const isl of ISLANDS) {
      const y = (isl.y + scroll) % LOOP;
      if (y < -100 || y > H + 100) continue;
      this._island(c, isl.x, y, isl.r, isl.kind);
    }
  }

  _island(c, x, y, r, kind) {
    c.fillStyle = 'rgba(255,255,255,.35)'; // 물결 테두리
    c.beginPath(); c.ellipse(x, y, r * 1.22, r * 0.95, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f0dfae';               // 모래
    c.beginPath(); c.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2); c.fill();
    if (kind === 'green') {
      c.fillStyle = '#5cae57';
      c.beginPath(); c.ellipse(x - r * 0.1, y - r * 0.06, r * 0.66, r * 0.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a9748';
      c.beginPath(); c.ellipse(x + r * 0.22, y + r * 0.1, r * 0.3, r * 0.22, 0, 0, Math.PI * 2); c.fill();
    }
  }

  // ---- 플레이어 ----

  _player(c, game) {
    const p = game.player;
    if (game.phase === 'dead' && game.lives < 0) return;
    // 무적 중엔 깜빡인다
    if (p.invul > 0 && Math.floor(p.invul / 4) % 2 === 0) return;

    for (let i = 0; i < game.options; i += 1) {
      this._drone(c, p.x + (i === 0 ? -26 : 26), p.y + 10);
    }
    this._planeUp(c, p.x, p.y);
  }

  // 바다 위 그림자 — 깊이감을 준다
  _shadow(c, w, h) {
    c.fillStyle = 'rgba(10,50,80,.16)';
    c.beginPath(); c.ellipse(3, 9, w, h, 0, 0, Math.PI * 2); c.fill();
  }

  _planeUp(c, x, y) {
    c.save(); c.translate(x, y);
    this._shadow(c, 17, 6);
    // 프로펠러(기수 앞)
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.beginPath(); c.ellipse(0, -17, 12, 3, 0, 0, Math.PI * 2); c.fill();
    // 수평 미익(뒤쪽, 작게)
    c.fillStyle = '#c9d5e4';
    c.beginPath(); c.moveTo(-9, 11); c.lineTo(9, 11); c.lineTo(6, 16); c.lineTo(-6, 16); c.closePath(); c.fill();
    // 주익 — 뒤로 젖혀진 사다리꼴
    c.fillStyle = '#e8eef6';
    c.beginPath(); c.moveTo(-20, 7); c.lineTo(20, 7); c.lineTo(13, -1); c.lineTo(-13, -1); c.closePath(); c.fill();
    c.fillStyle = 'rgba(47,111,208,.35)'; // 날개 끝 식별색
    c.fillRect(-20, 3, 6, 4); c.fillRect(14, 3, 6, 4);
    // 동체
    c.fillStyle = '#2f6fd0';
    c.beginPath();
    c.moveTo(0, -16); c.quadraticCurveTo(5, -9, 5, 4); c.lineTo(3.4, 16);
    c.lineTo(-3.4, 16); c.lineTo(-5, 4); c.quadraticCurveTo(-5, -9, 0, -16);
    c.closePath(); c.fill();
    // 캐노피
    c.fillStyle = '#bfe6ff';
    c.beginPath(); c.ellipse(0, -4, 3, 5, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  _drone(c, x, y) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#e8eef6';
    c.beginPath(); c.ellipse(0, 0, 5.5, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2f6fd0';
    c.beginPath(); c.ellipse(0, 0, 3, 4.4, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // ---- 적 ----

  _enemies(c, list) {
    for (const e of list) {
      c.save(); c.translate(e.x, e.y);
      if (e.hit > 0) c.globalAlpha = 0.55;
      if (e.type === 'gunner') this._bomber(c);
      else this._planeDown(c, e);
      c.restore();
    }
  }

  // 아래를 향한 적기 — 기수가 아래, 미익이 위
  _planeDown(c, e) {
    const skin = { grunt: '#3f8f4a', zig: '#d9932a', diver: '#cf3b33' }[e.type] || '#5b6a7d';
    const wing = { grunt: '#cfe3cd', zig: '#f4e2b6', diver: '#f0cbc8' }[e.type] || '#dfe6ee';
    this._shadow(c, 15, 5);
    // 프로펠러(기수 앞 = 아래)
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath(); c.ellipse(0, 15, 10, 2.6, 0, 0, Math.PI * 2); c.fill();
    // 수평 미익(위)
    c.fillStyle = wing;
    c.beginPath(); c.moveTo(-8, -13); c.lineTo(8, -13); c.lineTo(5, -8); c.lineTo(-5, -8); c.closePath(); c.fill();
    // 주익 — 뒤(위)로 젖혀진 사다리꼴
    c.beginPath(); c.moveTo(-17, -5); c.lineTo(17, -5); c.lineTo(11, 3); c.lineTo(-11, 3); c.closePath(); c.fill();
    c.fillStyle = skin; c.globalAlpha = 0.45;
    c.fillRect(-17, -5, 5, 4); c.fillRect(12, -5, 5, 4);
    c.globalAlpha = 1;
    // 동체
    c.fillStyle = skin;
    c.beginPath();
    c.moveTo(0, 14); c.quadraticCurveTo(4.6, 7, 4.6, -4); c.lineTo(3.2, -13);
    c.lineTo(-3.2, -13); c.lineTo(-4.6, -4); c.quadraticCurveTo(-4.6, 7, 0, 14);
    c.closePath(); c.fill();
    // 캐노피
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.beginPath(); c.ellipse(0, 2, 2.4, 3.6, 0, 0, Math.PI * 2); c.fill();
  }

  // 대형 폭격기(gunner) — 쌍발 엔진
  _bomber(c) {
    this._shadow(c, 22, 7);
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.beginPath(); c.ellipse(0, 18, 12, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c3cddb';
    c.beginPath(); c.moveTo(-11, -17); c.lineTo(11, -17); c.lineTo(7, -11); c.lineTo(-7, -11); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-23, -6); c.lineTo(23, -6); c.lineTo(15, 4); c.lineTo(-15, 4); c.closePath(); c.fill();
    c.fillStyle = '#57616f';
    c.beginPath();
    c.moveTo(0, 17); c.quadraticCurveTo(7, 8, 7, -5); c.lineTo(4.5, -16);
    c.lineTo(-4.5, -16); c.lineTo(-7, -5); c.quadraticCurveTo(-7, 8, 0, 17);
    c.closePath(); c.fill();
    c.fillStyle = '#3c4552'; // 엔진
    c.beginPath(); c.ellipse(-13, -2, 4, 7, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(13, -2, 4, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd27a';
    c.beginPath(); c.ellipse(0, 5, 3, 4.5, 0, 0, Math.PI * 2); c.fill();
  }

  // ---- 보스 ----

  _boss(c, b) {
    if (!b) return;
    c.save(); c.translate(b.x, b.y);
    if (b.hit > 0) c.globalAlpha = 0.6;
    // 주익
    c.fillStyle = '#b9c4d2';
    c.beginPath();
    c.moveTo(-62, -6); c.lineTo(-18, 6); c.lineTo(18, 6); c.lineTo(62, -6);
    c.lineTo(48, -24); c.lineTo(-48, -24); c.closePath(); c.fill();
    // 동체
    c.fillStyle = '#4a5666';
    c.beginPath();
    c.moveTo(0, 40); c.quadraticCurveTo(18, 20, 18, -12); c.lineTo(11, -30);
    c.lineTo(-11, -30); c.lineTo(-18, -12); c.quadraticCurveTo(-18, 20, 0, 40);
    c.closePath(); c.fill();
    // 엔진 4기
    c.fillStyle = '#333d4a';
    for (const ex of [-40, -26, 26, 40]) {
      c.beginPath(); c.ellipse(ex, -8, 6, 12, 0, 0, Math.PI * 2); c.fill();
    }
    // 콕핏·포탑
    c.fillStyle = '#ffd27a';
    c.beginPath(); c.ellipse(0, 6, 6, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b3441';
    c.beginPath(); c.arc(0, 26, 7, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // ---- 탄 ----

  _bullets(c, game) {
    c.fillStyle = '#fff36b';
    for (const b of game.pb) {
      c.beginPath(); c.ellipse(b.x, b.y, b.r * 0.7, b.r * 1.5, 0, 0, Math.PI * 2); c.fill();
    }
    for (const b of game.eb) {
      c.fillStyle = 'rgba(255,90,80,.35)';
      c.beginPath(); c.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff4d44';
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe0dd';
      c.beginPath(); c.arc(b.x - 1, b.y - 1, b.r * 0.42, 0, Math.PI * 2); c.fill();
    }
  }

  // ---- 아이템 ----

  _pickups(c, list) {
    const COL = { P: ['#ff5a63', '#fff'], O: ['#3fce6a', '#fff'], B: ['#3aa0ff', '#fff'], L: ['#ffb03a', '#fff'] };
    for (const it of list) {
      const [bg, fg] = COL[it.kind] || ['#888', '#fff'];
      const bob = Math.sin(it.t / 9) * 2;
      c.save(); c.translate(it.x, it.y + bob);
      c.fillStyle = 'rgba(255,255,255,.85)';
      this._round(c, -13, -13, 26, 26, 8); c.fill();
      c.fillStyle = bg;
      this._round(c, -11, -11, 22, 22, 7); c.fill();
      c.fillStyle = fg;
      c.font = '800 15px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(it.kind, 0, 1);
      c.restore();
    }
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }

  // ---- 폭발 ----

  _fx(c, list) {
    for (const f of list) {
      const p = f.t / f.life;
      c.globalAlpha = 1 - p;
      c.fillStyle = '#fff2b0';
      c.beginPath(); c.arc(f.x, f.y, f.r * (0.35 + p * 0.9), 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ff9a3c'; c.lineWidth = 3 * (1 - p);
      c.beginPath(); c.arc(f.x, f.y, f.r * (0.5 + p * 1.25), 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }
  }

  // ---- HUD ----

  _hud(c, game) {
    const g = c.createLinearGradient(0, 0, 0, HUD_H);
    g.addColorStop(0, 'rgba(6,26,44,.55)');
    g.addColorStop(1, 'rgba(6,26,44,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, HUD_H);

    c.fillStyle = '#fff';
    c.font = '800 17px "Segoe UI", system-ui, sans-serif';
    c.textBaseline = 'alphabetic';
    c.fillText(String(game.score).padStart(6, '0'), 10, 22);
    c.font = '600 11px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText(`BEST ${Math.max(game.best, game.score)}`, 10, 36);

    // 목숨(작은 기체) · 폭탄(원) · 파워
    for (let i = 0; i < Math.max(0, game.lives); i += 1) {
      const x = W - 14 - i * 15;
      c.fillStyle = '#e8eef6';
      c.beginPath(); c.moveTo(x, 10); c.lineTo(x + 5, 20); c.lineTo(x - 5, 20); c.closePath(); c.fill();
    }
    for (let i = 0; i < game.bombs; i += 1) {
      const x = W - 14 - i * 15;
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(x, 31, 4.5, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.font = '800 11px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(`PWR ${game.power}${game.options ? ` +${game.options}` : ''}`, W / 2, 22);
    c.textAlign = 'left';

    // 보스 체력바
    const b = game.boss;
    if (b && b.state !== 'enter') {
      const bw = W - 40;
      c.fillStyle = 'rgba(0,0,0,.35)';
      this._round(c, 20, HUD_H - 6, bw, 9, 4.5); c.fill();
      const ratio = Math.max(0, b.hp / b.maxHp);
      const col = ratio <= BOSS.phase3 ? '#ff4d44' : (ratio <= BOSS.phase2 ? '#ff9a2e' : '#ffd23f');
      c.fillStyle = col;
      this._round(c, 20, HUD_H - 6, Math.max(2, bw * ratio), 9, 4.5); c.fill();
    }

    c.fillStyle = 'rgba(255,255,255,.5)';
    c.font = '600 9px "Segoe UI", system-ui, sans-serif';
    c.fillText(VERSION, W - 30, H - 8);
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

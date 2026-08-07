// 읽기 전용 렌더러 — 1픽셀 = 1도트 해상도의 도트 그래픽.
// 기체 스프라이트는 시작할 때 한 번 구워두고(sprites.js) 이후엔 blit만 한다.

import { W, H, HUD_H, BOSS, PLAYER, VERSION } from './config.js';
import { bakeSprite, MAPS, FONT } from './sprites.js';
import { Backdrop } from './backdrop.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    // 스프라이트를 한 번만 굽는다
    this.spr = {};
    for (const name of Object.keys(MAPS)) this.spr[name] = bakeSprite(name);
    // 좌우 기울기: 같은 픽셀맵에서 주익만 기울여 굽는다
    this.spr.bankL = bakeSprite('player', { bank: -1 });
    this.spr.bankR = bakeSprite('player', { bank: 1 });
    this.flash = {};   // 피격용 흰색 실루엣(요청 시 생성)
    this.backdrop = new Backdrop('day');
  }

  render(game) {
    const c = this.ctx;
    this.backdrop.set(game.stage ? game.stage.theme : 'day');
    this.backdrop.below(c, game.scroll);
    this._pickups(c, game.pickups);
    this._enemies(c, game.enemies);
    this._boss(c, game.boss);
    this._player(c, game);
    this._bullets(c, game);
    this.backdrop.above(c, game.scroll);      // 구름은 기체 위를 지나간다
    this._fx(c, game.fx);
    if (game.bombFlash > 0) {
      c.fillStyle = `rgba(255,255,255,${(game.bombFlash / 34) * 0.7})`;
      c.fillRect(0, 0, W, H);
    }
    this._hud(c, game);
    this._banner(c, game);
  }

  // 스프라이트를 정수 좌표에 중심 정렬로 찍는다(반올림 → 도트가 흔들리지 않음)
  _blit(c, img, x, y) {
    c.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }

  // 피격 순간용 흰 실루엣 — 원본의 알파만 남겨 하얗게 태운다
  _flashOf(name) {
    if (this.flash[name]) return this.flash[name];
    const src = this.spr[name];
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const x = cv.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.fillRect(0, 0, cv.width, cv.height);
    this.flash[name] = cv;
    return cv;
  }

  // 픽셀 타원 — 폭발 코어에 쓴다(배경 쪽 타원은 backdrop.js가 따로 갖고 있다)
  _ellipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y += 1) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)));
      if (half > 0) c.fillRect(Math.round(cx) - half, y, half * 2, 1);
    }
  }

  // ---- 기체 ----

  _player(c, game) {
    const p = game.player;
    if (game.phase === 'dead' && game.lives < 0) return;
    if (p.dead > 0) return;                                          // 격추 후 잠시 사라진다
    if (p.invul > 0 && Math.floor(p.invul / 4) % 2 === 0) return;    // 무적 동안 깜빡임
    for (let i = 0; i < game.options; i += 1) {
      this._blit(c, this.spr.drone, p.x + (i === 0 ? -24 : 24), p.y + 9);
    }
    // 좌우로 움직이면 기울어진 자세로
    const b = p.bank || 0;
    const name = b < -PLAYER.bankAt ? 'bankL' : (b > PLAYER.bankAt ? 'bankR' : 'player');
    this._blit(c, this.spr[name], p.x, p.y);
  }

  _enemies(c, list) {
    for (const e of list) {
      const img = e.hit > 0 ? this._flashOf(e.type) : this.spr[e.type];
      this._blit(c, img, e.x, e.y);
    }
  }

  _boss(c, b) {
    if (!b) return;
    const key = b.sprite || 'boss';
    this._blit(c, b.hit > 0 ? this._flashOf(key) : this.spr[key], b.x, b.y);
  }

  // ---- 탄 ----

  _bullets(c, game) {
    for (const b of game.pb) {
      const x = Math.round(b.x); const y = Math.round(b.y);
      c.fillStyle = '#fff8bd'; c.fillRect(x - 1, y - 5, 2, 8);   // 잔광
      c.fillStyle = '#ffe14d'; c.fillRect(x - 1, y - 4, 2, 5);   // 심
      c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 4, 2, 2);   // 앞머리
    }
    for (const b of game.eb) {
      const x = Math.round(b.x); const y = Math.round(b.y);
      c.fillStyle = '#7a0f0a';                                    // 외곽
      c.fillRect(x - 2, y - 3, 4, 6); c.fillRect(x - 3, y - 2, 6, 4);
      c.fillStyle = '#ff3b2f';                                    // 본체
      c.fillRect(x - 2, y - 2, 4, 4); c.fillRect(x - 1, y - 3, 2, 6); c.fillRect(x - 3, y - 1, 6, 2);
      c.fillStyle = '#ffd2cd'; c.fillRect(x - 1, y - 2, 2, 2);    // 하이라이트
      c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 2, 1, 1);
    }
  }

  // ---- 아이템 ----

  _pickups(c, list) {
    const COL = { P: ['#ff5a63', '#7d1219'], O: ['#3fce6a', '#14601f'], B: ['#3aa0ff', '#123f78'], L: ['#ffb03a', '#7a4a08'] };
    for (const it of list) {
      const x = Math.round(it.x); const y = Math.round(it.y + Math.sin(it.t / 9) * 2);
      const [bright, dark] = COL[it.kind] || ['#888', '#333'];
      c.fillStyle = '#101822'; c.fillRect(x - 8, y - 8, 16, 16);   // 외곽
      c.fillStyle = dark; c.fillRect(x - 7, y - 7, 14, 14);
      c.fillStyle = bright; c.fillRect(x - 6, y - 6, 12, 12);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 6, y - 6, 12, 2);  // 상단 광택
      this._text(c, it.kind, x - 2, y - 3, '#ffffff');
    }
  }

  // ---- 폭발: 도트 파편 + 링 ----

  _fx(c, list) {
    for (const f of list) {
      const p = f.t / f.life;
      const cx = Math.round(f.x); const cy = Math.round(f.y);
      const rad = f.r * (0.25 + p * 1.2);
      // 화염 코어
      if (p < 0.55) {
        const cr = Math.round(f.r * (0.55 - p) * 1.6);
        c.fillStyle = p < 0.25 ? '#ffffff' : '#ffe066';
        this._ellipse(c, cx, cy, cr, cr, p < 0.25 ? '#ffffff' : '#ffe066');
      }
      // 파편
      c.fillStyle = p < 0.5 ? '#ffd24d' : '#ff7a2e';
      const n = 10;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + (cx % 7) * 0.3;
        const r = rad * (i % 2 ? 1 : 0.72);
        c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2);
      }
      // 연기 잔재
      if (p > 0.5) {
        c.fillStyle = 'rgba(90,90,110,.35)';
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2;
          c.fillRect(Math.round(cx + Math.cos(a) * rad * 0.6), Math.round(cy + Math.sin(a) * rad * 0.6), 3, 3);
        }
      }
    }
  }

  // ---- 텍스트(5x7 도트 폰트) ----

  _text(c, str, x, y, color, scale = 1) {
    c.fillStyle = color;
    let cx = Math.round(x);
    const yy = Math.round(y);
    for (const raw of String(str).toUpperCase()) {
      const g = FONT[raw];
      if (!g) { cx += 6 * scale; continue; }
      for (let r = 0; r < 7; r += 1) {
        const row = g[r];
        for (let i = 0; i < 5; i += 1) {
          if (row[i] === '1') c.fillRect(cx + i * scale, yy + r * scale, scale, scale);
        }
      }
      cx += 6 * scale;
    }
    return cx;
  }

  // ---- HUD ----

  _hud(c, game) {
    c.fillStyle = '#0a1c2e';
    c.fillRect(0, 0, W, HUD_H);
    c.fillStyle = '#16324f';
    c.fillRect(0, HUD_H - 2, W, 1);
    c.fillStyle = '#25496f';
    for (let x = 0; x < W; x += 2) c.fillRect(x, HUD_H - 1, 1, 1);

    this._text(c, String(game.score).padStart(6, '0'), 8, 8, '#ffffff', 2);
    this._text(c, `BEST ${Math.max(game.best, game.score)}`, 8, 26, '#7fc4ff', 1);

    for (let i = 0; i < Math.max(0, game.lives); i += 1) {
      const x = W - 16 - i * 16;
      c.fillStyle = '#3f83d8';
      c.fillRect(x - 1, 10, 2, 9); c.fillRect(x - 5, 14, 10, 2); c.fillRect(x - 3, 18, 6, 1);
      c.fillStyle = '#bfe9ff'; c.fillRect(x - 1, 11, 1, 2);
    }
    for (let i = 0; i < game.bombs; i += 1) {
      const x = W - 15 - i * 12;
      c.fillStyle = '#7a4a08'; c.fillRect(x - 3, 27, 6, 6);
      c.fillStyle = '#ffd23f'; c.fillRect(x - 3, 27, 5, 5);
      c.fillStyle = '#fff6c8'; c.fillRect(x - 3, 27, 2, 2);
    }
    this._text(c, `PWR ${game.power}${game.options ? ` +${game.options}` : ''}`, W / 2 - 30, 22, '#ffffff', 1);
    this._text(c, `STAGE ${game.stageIdx + 1}`, W / 2 - 24, 9, '#ffd23f', 1);

    const b = game.boss;
    if (b && b.state !== 'enter') {
      const bw = W - 40;
      c.fillStyle = '#10161f'; c.fillRect(19, HUD_H + 3, bw + 2, 9);
      c.fillStyle = '#2a3444'; c.fillRect(20, HUD_H + 4, bw, 7);
      const ratio = Math.max(0, b.hp / b.maxHp);
      const fw = Math.max(1, Math.round(bw * ratio));
      c.fillStyle = ratio <= BOSS.phase3 ? '#e03024' : (ratio <= BOSS.phase2 ? '#ff8a2e' : '#ffd23f');
      c.fillRect(20, HUD_H + 4, fw, 7);
      c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(20, HUD_H + 4, fw, 1);
    }

    this._text(c, VERSION, W - 26, H - 10, 'rgba(255,255,255,.4)', 1);
  }

  // ---- 스테이지 안내 ----

  // 가운데 크게 뜨는 도트 문자. 들어올 때·나갈 때만 흐려진다.
  _banner(c, game) {
    const b = game.banner;
    if (!b) return;
    // hold(조작 대기) 중에는 사라지지 않는다 — 들어올 때만 서서히 나타난다
    const fadeIn = Math.min(1, b.t / 10);
    const fadeOut = b.hold ? 1 : Math.max(0, Math.min(1, (b.life - b.t) / 14));
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0) return;
    const cy = Math.round(H * 0.42);
    const draw = (txt, scale, y, col) => {
      const w = String(txt).length * 6 * scale - scale;
      this._text(c, txt, Math.round(W / 2 - w / 2), y, col, scale);
    };
    // 뒤에 깔리는 반투명 띠 — 배경이 밝아도 글자가 읽힌다
    c.fillStyle = `rgba(8,20,34,${0.62 * a})`;
    c.fillRect(0, cy - 12, W, 44);
    c.fillStyle = `rgba(255,210,63,${0.7 * a})`;
    c.fillRect(0, cy - 12, W, 1); c.fillRect(0, cy + 31, W, 1);
    draw(b.text, 3, cy - 6, `rgba(255,255,255,${a})`);
    if (b.sub) draw(b.sub, 1, cy + 18, `rgba(255,210,63,${a})`);
    // 조작 대기 중에는 안내가 깜빡인다
    if (b.hold && Math.floor(b.t / 26) % 2 === 0) {
      draw(b.hint || 'MOVE TO START', 1, cy + 44, `rgba(255,255,255,${0.85 * a})`);
    }
  }
}

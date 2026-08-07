// 배경 — 층을 나눠 서로 다른 속도로 흘려 깊이를 만든다.
//
//   깊은 물(0.45x)  →  수면·섬·배(1.0x)  →  [기체·탄]  →  구름(1.9x)
//
// 구름이 기체 위를 빠르게 지나가는 게 가장 강한 원근 단서다.
// 층마다 오프스크린 캔버스에 **한 번만** 굽고(세로로 이어 붙어도 티가 안 나는 길이),
// 매 프레임은 blit 두어 번으로 끝낸다 — 도트를 아무리 촘촘히 찍어도 비용이 그대로다.

import { W, H } from './config.js';

// 결정적 난수 — 같은 스테이지는 항상 같은 배치가 나온다
const lcg = (s) => () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

const LOOP_DEEP = 900;
const LOOP_SURF = 1200;
const LOOP_SKY = 800;

export const THEMES = {
  // 1스테이지 — 한낮 열대 바다
  day: {
    seed: 7,
    sea: ['#5cc2f2', '#42ade4', '#2f97d5', '#1f81c2', '#1a6ea8'],
    deepBlot: 'rgba(12,74,124,.13)', current: 'rgba(160,225,255,.14)',
    foam: 'rgba(255,255,255,.55)',
    glitter: 'rgba(255,250,215,.5)', glitterX: 0.5,
    shoal: '#7fd0f4', surfRing: '#e8f6ff',
    sandWet: '#c2a469', sand: '#e6cf95', sandHi: '#f5e7bd', sandEdge: '#9c8149',
    grass: ['#3f8a45', '#5aab55', '#77c56a'], tree: '#2b5f30',
    reef: 'rgba(30,110,80,.42)',
    hull: ['#2c3644', '#4c5a70', '#8494a8'], deck: '#b9c4d2', wake: 'rgba(255,255,255,.5)',
    cloud: ['rgba(255,255,255,.13)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.3)'],
    islands: 6, ships: 3, reefs: 7, clouds: 6,
  },
  // 2스테이지 — 해질녘 해협. 물빛이 따뜻해지고 구름이 붉게 물든다
  dusk: {
    seed: 23,
    sea: ['#8a7f92', '#6d6883', '#514f70', '#3b3d5a', '#2a2d44'],
    deepBlot: 'rgba(26,18,40,.17)', current: 'rgba(255,186,126,.14)',
    foam: 'rgba(255,222,186,.46)',
    glitter: 'rgba(255,186,110,.55)', glitterX: 0.66,
    shoal: '#7d7f9c', surfRing: '#ffd9ac',
    sandWet: '#9a7a4c', sand: '#c9a874', sandHi: '#e8cd9a', sandEdge: '#6d5430',
    grass: ['#2f5f39', '#446e42', '#5c8a4e'], tree: '#233f26',
    reef: 'rgba(20,70,60,.45)',
    hull: ['#221b22', '#3d3340', '#6b5f6b'], deck: '#9a8a92', wake: 'rgba(255,222,190,.45)',
    cloud: ['rgba(255,170,120,.13)', 'rgba(255,196,146,.19)', 'rgba(255,226,186,.29)'],
    islands: 7, ships: 4, reefs: 8, clouds: 7,
  },
  // 3스테이지 — 야간 강습. 달빛 한 줄기와 짙은 구름
  night: {
    seed: 41,
    sea: ['#1d3352', '#182b47', '#13233c', '#0f1c31', '#0b1526'],
    deepBlot: 'rgba(4,8,20,.20)', current: 'rgba(120,170,235,.10)',
    foam: 'rgba(196,222,255,.4)',
    glitter: 'rgba(214,232,255,.42)', glitterX: 0.36,
    shoal: '#254566', surfRing: '#9fc0e2',
    sandWet: '#4a4436', sand: '#6b6350', sandHi: '#8a8068', sandEdge: '#2d2a22',
    grass: ['#1c3324', '#28472f', '#365d3b'], tree: '#122116',
    reef: 'rgba(6,30,40,.5)',
    hull: ['#0d1119', '#1d2532', '#3d4859'], deck: '#5d6a7c', wake: 'rgba(180,210,245,.34)',
    cloud: ['rgba(30,44,74,.24)', 'rgba(58,78,116,.24)', 'rgba(120,146,190,.2)'],
    islands: 5, ships: 4, reefs: 6, clouds: 8,
  },
};

const surface = (w, h) => {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return { cv, c };
};

export class Backdrop {
  constructor(theme) { this.name = null; this.set(theme); }

  /** 테마가 바뀔 때만 다시 굽는다(스테이지 전환 시 한 번). */
  set(name) {
    if (this.name === name) return;
    const th = THEMES[name] || THEMES.day;
    this.name = name;
    this.th = th;
    this.base = this._base(th);
    this.deep = this._deep(th);
    this.surf = this._surf(th);
    this.sky = this._sky(th);
  }

  // 기체 아래에 깔리는 층
  below(c, scroll) {
    c.drawImage(this.base, 0, 0);
    this._tile(c, this.deep, scroll * 0.45);
    this._tile(c, this.surf, scroll);
  }

  // 기체 위를 지나가는 구름 — 가장 빠르다
  above(c, scroll) { this._tile(c, this.sky, scroll * 1.9); }

  _tile(c, img, off) {
    const L = img.height;
    let y = Math.round(off) % L;
    if (y > 0) y -= L;
    for (; y < H; y += L) c.drawImage(img, 0, y);
  }

  // ---- 층별 굽기 ----

  // 수심 밴드: 아래로 갈수록 깊고 어둡다. 경계는 두 줄 체커로 흩어 밴드 티를 없앤다.
  _base(th) {
    const { cv, c } = surface(W, H);
    const n = th.sea.length;
    const bh = Math.ceil(H / n);
    for (let i = 0; i < n; i += 1) {
      c.fillStyle = th.sea[i];
      c.fillRect(0, i * bh, W, bh);
    }
    for (let i = 1; i < n; i += 1) {
      const y = i * bh;
      c.fillStyle = th.sea[i - 1];
      for (let x = 0; x < W; x += 2) { c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y + 2, 1, 1); }
      c.fillStyle = th.sea[i];
      for (let x = 0; x < W; x += 2) { c.fillRect(x + 1, y - 3, 1, 1); c.fillRect(x, y - 1, 1, 1); }
    }
    return cv;
  }

  // 깊은 물: 천천히 흐르는 큰 얼룩과 해류 줄기. 느리게 흘러 바닥이 멀어 보인다.
  _deep(th) {
    const { cv, c } = surface(W, LOOP_DEEP);
    const r = lcg(th.seed);
    for (let i = 0; i < 20; i += 1) {
      const x = r() * W;
      const y = r() * LOOP_DEEP;
      const rx = 16 + r() * 30;
      const ry = 7 + r() * 12;
      this._blob(c, x, y, rx, ry, th.deepBlot);
      this._dither(c, x, y, rx + 6, ry + 4, 5, th.deepBlot);   // 가장자리를 흩어 얼룩 티를 없앤다
    }
    // 해류 — 가로로 누운 짧은 줄기. 세로로 길면 긁힌 자국처럼 보인다.
    c.fillStyle = th.current;
    for (let i = 0; i < 26; i += 1) {
      const x = Math.round(r() * W);
      const y = Math.round(r() * LOOP_DEEP);
      const len = 10 + Math.round(r() * 22);
      for (let k = 0; k < len; k += 2) c.fillRect(x + k, y + Math.round(Math.sin(k / 7) * 2), 2, 1);
    }
    return cv;
  }

  // 수면: 잔물결 · 윤슬 · 암초 · 섬 · 배. 스크롤과 1:1로 흐른다.
  _surf(th) {
    const { cv, c } = surface(W, LOOP_SURF);
    const r = lcg(th.seed + 101);

    // 잔물결 — 1~3도트 점선
    c.fillStyle = th.foam;
    for (let i = 0; i < 190; i += 1) {
      const x = Math.round(r() * (W - 8)) + 3;
      const y = Math.round(r() * LOOP_SURF);
      const len = 1 + Math.floor(r() * 3);
      c.fillRect(x, y, len, 1);
      if (r() < 0.5) c.fillRect(x + len + 2, y + 1, 1, 1);
    }

    // 윤슬 — 햇빛(달빛)이 떨어지는 띠에만 반짝임을 몰아준다
    const gx = W * th.glitterX;
    c.fillStyle = th.glitter;
    for (let i = 0; i < 150; i += 1) {
      const spread = 22 + r() * 46;
      const x = Math.round(gx + (r() - 0.5) * spread * 2);
      const y = Math.round(r() * LOOP_SURF);
      if (x < 1 || x > W - 3) continue;
      c.fillRect(x, y, 1 + (r() < 0.35 ? 1 : 0), 1);
    }

    // 암초 — 물에 잠긴 어두운 반점 + 부서지는 물거품
    for (let i = 0; i < th.reefs; i += 1) {
      const x = r() * W;
      const y = r() * LOOP_SURF;
      const rx = 8 + r() * 14;
      this._blob(c, x, y, rx, rx * 0.6, th.reef);
      c.fillStyle = th.surfRing;
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2;
        c.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * rx * 0.6), 1, 1);
      }
    }

    // 배 — 크기의 기준이 되어 바다가 넓어 보인다
    for (let i = 0; i < th.ships; i += 1) {
      this._ship(c, Math.round(20 + r() * (W - 40)), Math.round(r() * LOOP_SURF), th, r);
    }

    // 섬
    for (let i = 0; i < th.islands; i += 1) {
      const rad = 13 + r() * 20;
      this._island(c, Math.round(r() * W), Math.round(r() * LOOP_SURF), rad, r() < 0.55, th, r);
    }
    return cv;
  }

  // 구름: 기체 위를 가장 빠르게 지나간다
  _sky(th) {
    const { cv, c } = surface(W, LOOP_SKY);
    const r = lcg(th.seed + 211);
    for (let i = 0; i < th.clouds; i += 1) {
      this._cloud(c, r() * W, r() * LOOP_SKY, 15 + r() * 22, th, r);
    }
    return cv;
  }

  // ---- 요소 ----

  // 픽셀 타원 — 반폭을 정수로 반올림해 가장자리를 계단지게
  _blob(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y += 1) {
      const dy = (y - cy) / ry;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)));
      if (half > 0) c.fillRect(Math.round(cx) - half, y, half * 2, 1);
    }
  }

  _blobEdge(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y += 1) {
      const dy = (y - cy) / ry;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy)));
      if (half <= 0) continue;
      c.fillRect(Math.round(cx) - half, y, 1, 1);
      c.fillRect(Math.round(cx) + half - 1, y, 1, 1);
    }
  }

  // 두 타원 사이를 체커로 흩는다 — 도트로 만드는 그라데이션
  _dither(c, cx, cy, rx, ry, inset, color) {
    c.fillStyle = color;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y += 1) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)));
      const inner = Math.round((rx - inset) * Math.sqrt(Math.max(0, 1 - ((y - cy) / (ry - inset)) ** 2)));
      for (let x = Math.round(cx) - half; x < cx + half; x += 1) {
        if (Math.abs(x - cx) < inner || (x + y) % 2) continue;
        c.fillRect(x, y, 1, 1);
      }
    }
  }

  _island(c, x, y, r, green, th, rnd) {
    const rx = Math.round(r * 1.15);
    const ry = Math.round(r * 0.8);
    this._dither(c, x, y, rx + 7, ry + 6, 4, th.shoal);
    this._blob(c, x, y, rx + 3, ry + 3, th.shoal);
    this._blob(c, x, y, rx + 1, ry + 1, th.surfRing);
    this._blob(c, x, y, rx, ry, th.sandWet);
    this._blob(c, x, y - 1, rx - 3, ry - 2, th.sand);
    this._blob(c, x - 1, y - 2, rx - 7, ry - 5, th.sandHi);
    if (green) {
      this._blob(c, x, y - 1, rx - 5, ry - 4, th.grass[0]);
      this._blob(c, x - 1, y - 2, rx - 7, ry - 6, th.grass[1]);
      this._blob(c, x - 2, y - 3, rx - 11, ry - 8, th.grass[2]);
      c.fillStyle = th.tree;
      for (let i = 0; i < 4; i += 1) {
        const a = rnd() * Math.PI * 2;
        const d = 0.3 + rnd() * 0.5;
        c.fillRect(Math.round(x + Math.cos(a) * rx * d), Math.round(y + Math.sin(a) * ry * d), 2, 2);
      }
    }
    this._blobEdge(c, x, y, rx, ry, th.sandEdge);
  }

  // 함선 — 선체 + V자 항적. 바다에 크기 기준을 준다.
  _ship(c, x, y, th, rnd) {
    const len = 13 + Math.round(rnd() * 12);
    const half = 2 + Math.round(rnd() * 1);
    // 항적: 뒤로 갈수록 벌어지는 흰 점선
    c.fillStyle = th.wake;
    for (let i = 1; i < len + 20; i += 1) {
      const spread = 1 + i * 0.35;
      if (i % 2) continue;
      c.fillRect(Math.round(x - spread), y + Math.round(len / 2) + i, 1, 1);
      c.fillRect(Math.round(x + spread), y + Math.round(len / 2) + i, 1, 1);
    }
    // 이물 물살
    c.fillStyle = th.surfRing;
    c.fillRect(x - 1, y - Math.round(len / 2) - 1, 2, 1);
    // 선체
    for (let i = 0; i < len; i += 1) {
      const t = i / (len - 1);
      const hw = Math.max(1, Math.round(half * (t < 0.25 ? t / 0.25 : (t > 0.85 ? 0.8 : 1))));
      const yy = y - Math.round(len / 2) + i;
      c.fillStyle = th.hull[0];
      c.fillRect(x - hw, yy, hw * 2, 1);
      c.fillStyle = th.hull[1];
      c.fillRect(x - hw + 1, yy, Math.max(1, hw * 2 - 2), 1);
    }
    // 갑판 구조물
    c.fillStyle = th.deck;
    c.fillRect(x - 1, y - 1, 2, 3);
    c.fillStyle = th.hull[2];
    c.fillRect(x - 1, y + 3, 2, 2);
  }

  // 구름 — 뭉게뭉게 겹친 반투명 덩어리. 위쪽이 밝다.
  _cloud(c, x, y, r, th, rnd) {
    const puffs = 5 + Math.floor(rnd() * 4);
    const parts = [];
    for (let i = 0; i < puffs; i += 1) {
      parts.push({
        x: x + (rnd() - 0.5) * r * 2.1,
        y: y + (rnd() - 0.5) * r * 0.7,
        rx: r * (0.38 + rnd() * 0.42),
        ry: r * (0.24 + rnd() * 0.26),
      });
    }
    for (const p of parts) this._blob(c, p.x, p.y, p.rx, p.ry, th.cloud[0]);
    for (const p of parts) this._blob(c, p.x, p.y - p.ry * 0.3, p.rx * 0.78, p.ry * 0.66, th.cloud[1]);
    for (const p of parts) this._blob(c, p.x - p.rx * 0.15, p.y - p.ry * 0.55, p.rx * 0.44, p.ry * 0.36, th.cloud[2]);
  }
}

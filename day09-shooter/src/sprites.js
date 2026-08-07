// 도트 스프라이트 — 한 글자가 한 도트다.
// 기체는 좌우 대칭이므로 **왼쪽 절반 + 가운데 열**만 찍고 굽는 시점에 뒤집어 붙인다.
// (한 줄 = 왼쪽 끝 → 가운데. 폭 w인 스프라이트의 줄 길이는 (w+1)/2)
// 명암은 위에서 비추는 원통 조명 기준 — 가장자리가 어둡고 가운데가 밝다.
//
//   .  투명        X  외곽선
//   1~4 동체(어두움→밝음)      5~8 날개(뒷전→앞전)
//   c/C 금속(카울·엔진)        g/G 캐노피 유리
//   r/R 국적 표식              p  프로펠러 잔상

const SLOT = {
  X: 'line',
  1: ['body', 0], 2: ['body', 1], 3: ['body', 2], 4: ['body', 3],
  5: ['wing', 0], 6: ['wing', 1], 7: ['wing', 2], 8: ['wing', 3],
  c: ['metal', 0], C: ['metal', 2],
  g: 'glass', G: 'glassHi',
  r: 'mark', R: 'markHi',
  p: 'prop',
};

const BOSS_ROWS = [
      '......................XXX',
      '.....................X344',
      '....................X2gGG',
      '....................X2gGG',
      '...................X12ggg',
      '...................X12334',
      '...................X12334',
      '...................X12334',
      '.........p.p.p.p.p.X12334',
      '..........p.p.p.p..X12334',
      '.........p.p.p.p.p.X12334',
      '.............XCCX..X12334',
      '..p.p.p.p.p..XCCX..X12334',
      '...p.p.p.p...XCCX..X12334',
      '..p.p.p.p.p..XCCXXX112334',
      '......XCCX..XXCCX88112334',
      '......XCCXXX8XCCX77112334',
      '.....XXCCX777XCCX77112334',
      '...XX8XCCX777XCCX77112334',
      '.XX887XCCX777XCCX77112334',
      'XrRr77XCCX777XCCX77112334',
      '66r777XCCX666XCCX661123cC',
      '666666XCCX666XCCX661123cC',
      '655555XCCX555XCCX55112334',
      '555555XCCX555XCCX55112334',
      '555555XCCX555XCCX55112334',
      '555555XCCX555XCCX55112334',
      'XX5555XCCX555XCCX55112334',
      '..XXXXXCCX555XCCX55112334',
      '......XCCX555XCCX55112334',
      '......XXXXXXXXCCX55112334',
      '.............XXXX..X12334',
      '...................X12334',
      '.....................X344',
      '...........X8888888882344',
      '..........X777777777723cC',
      '..........XX5555555552344',
      '.....................X344',
      '......................X34',
      '.......................XX',
];

// ---- 픽셀맵(왼쪽 절반 + 가운데 열) ----

export const MAPS = {
  // 자기 기체 33x36 — 단발 함상 전투기. 카울 링·배기구·캐노피·주익 국적표식.
  // 회전 잔상(p)이 스피너를 감싸 프로펠러 디스크처럼 보이게 했다.
  player: {
    w: 33,
    core: 4,          // 동체 반폭 — 롤을 줄 때 이 바깥 열만 기운다
    faceDown: false,
    rows: [
      '.................',
      '.....p.p.p.p.p.p.',
      '.........p.p.p.pX',
      '...........p.p.pX',
      '.............XXXc',
      '.............XCCc',
      '.............XCCc',
      '.............XCCc',
      '...........X.X234',
      '.............X23g',
      '...........X.X2gG',
      '.............X2gG',
      '...........X.X2gG',
      '.............X2gG',
      '.............X23g',
      '.............X234',
      '.............X234',
      '.............X234',
      '.............X234',
      '............X1234',
      '.........XXX81234',
      '........X88871234',
      '.....XXX877771234',
      '....XrRr777761234',
      '.XXX87r7666661234',
      'X8886666666661234',
      'X6666666566651234',
      'X5555555555551234',
      'XXXXXXXXX55551234',
      '.........XXXX1234',
      '.............X234',
      '..........XXX1234',
      '.......XXX8888134',
      '.......X775555134',
      '.......XXXXXXXX34',
      '...............XX',
    ],
  },

  // 잡졸 27x29 — 성형엔진 카울의 뭉툭한 전투기
  grunt: {
    w: 27,
    faceDown: true,
    rows: [
      '...p.p.p.p.p.p',
      '.......p.p.p.p',
      '.........p.pXp',
      '..........XXCX',
      '..........XCCc',
      '..........XCCc',
      '..........XCCc',
      '..........X23g',
      '..........X2gG',
      '..........X2gG',
      '..........X2gG',
      '..........X23g',
      '..........X234',
      '..........X234',
      '........XX1234',
      '.......X881234',
      '....XXX8771234',
      '...X8r87771234',
      'XXX8rRr6661234',
      'X8866r66661234',
      'X6655555551234',
      'XXXXXXX5551234',
      '.......XXXX134',
      '...........X34',
      '.....XXXXXX134',
      '.....X88888134',
      '.....X55555134',
      '.....XXXXXXX34',
      '............XX',
    ],
  },

  // 지그재그 29x29 — 인라인 엔진에 배기구가 늘어선 긴 주익 기체
  zig: {
    w: 29,
    faceDown: true,
    rows: [
      '...............',
      '...p.p.p.p.p.p.',
      '.......p.p.p.pX',
      '.........p.pXpX',
      '.........X..XX4',
      '............X34',
      '.........X..X34',
      '...........X23g',
      '...........X2gG',
      '...........X2gG',
      '...........X2gG',
      '...........X23g',
      '...........X234',
      '..........X1234',
      '.......XXX81234',
      '.....XX88871234',
      '..XXX8877771234',
      'XX888r777761234',
      'X866rRr66661234',
      'X6566r666661234',
      'XXX555555551234',
      '...XXXX55551234',
      '.......XXXXX234',
      '............X34',
      '............X34',
      '.......XXXXX134',
      '......X88888134',
      '......X55555134',
      '......XXXXXXXXX',
    ],
  },

  // 급강하 25x29 — 뾰족한 기수에 후퇴각이 큰 좁은 기체
  diver: {
    w: 25,
    faceDown: true,
    rows: [
      '.............',
      '...p.p.p.p.p.',
      '.......p.p.pX',
      '.........p.pX',
      '..........XX4',
      '..........X34',
      '.........X23g',
      '.........X2gG',
      '.........X2gG',
      '.........X2gG',
      '.........X23g',
      '.........X234',
      '.........X234',
      '........X1234',
      '......XX81234',
      '.....X8871234',
      '....X87771234',
      '...X877661234',
      '.XX8766661234',
      'X886666551234',
      'X666655551234',
      'X555555XXX234',
      'XXXXXXX...X34',
      '..........X34',
      '.....XXXXX134',
      '.....X8888134',
      '.....X5555514',
      '.....XXXXXX14',
      '...........XX',
    ],
  },

  // 폭격기 43x35 — 쌍발 나셀이 주익 앞으로 길게 나온다
  gunner: {
    w: 43,
    faceDown: true,
    rows: [
      '...........p.p.p.p.p.p',
      '...............p.p.p.p',
      '.................p.pXp',
      '......XXXXX........X3X',
      '......XcCcX.......X234',
      '.....XcCCCcX......X234',
      '.....XcCCCcX......X234',
      '.....XcCCCcX.....X23gG',
      '.....XcCCCcX.....X2gGG',
      '.....XcCCCcX.....X2gGG',
      '.....XcCCCcX.....X2gGG',
      '.....XcCCCcX.....X2gGG',
      '.....XcCCCcX.....X23gG',
      '.....XcCCCcX.....X2334',
      '.....XcCCCcX.....X2334',
      '.....XcCCCcX.XXXX12334',
      '.....XcCCCccX888812334',
      '.....XcCCCcc8777712334',
      '....XccCCCcc7777712334',
      '.XXX8crCCCcc7666612334',
      'X8886rRrCCcc6666612334',
      'X66666rcCcc66666612334',
      'X55555ccCcc55555512334',
      'XXXXXX5555555555512334',
      '......XXXXXXXXXX512334',
      '................XX2334',
      '..................X234',
      '..................X234',
      '............XXXXXX1234',
      '.........XXX8888881234',
      '.........X887777771234',
      '.........X555555551234',
      '.........XXXXXXXXXX134',
      '...................X34',
      '...................XXX',
    ],
  },

  // 보스 49x40 — 4발 대형 폭격기(1스테이지). 2·3스테이지 보스는 전용 루틴으로 굽는다
  boss: { w: 49, faceDown: true, rows: BOSS_ROWS },

  // 보조기 13x13 — 유리 눈이 달린 작은 원반 드론
  drone: {
    w: 13,
    faceDown: false,
    rows: [
      '.....XX',
      '...XXcC',
      '..XcCC4',
      '.XcCC44',
      'XcCC444',
      'XcC4GGG',
      'XcC4GGG',
      'XcC4GGG',
      'XcCC444',
      '.XcCC44',
      '..XcCC4',
      '...XXcC',
      '.....XX',
    ],
  },
};

// ---- 팔레트 (어두움 → 밝음) ----

export const PALETTES = {
  player: {
    line: '#0c1f38',
    body: ['#1b4780', '#2a68b2', '#3f88d6', '#79b6f0'],
    wing: ['#8ba6c6', '#b3c8de', '#d6e3f0', '#f2f7fc'],
    metal: ['#232c3c', '#3c4859', '#6d7c92'],
    glass: '#1f4f7d', glassHi: '#a9dcff',
    mark: '#c8352c', markHi: '#ffffff', prop: '#e6f0fa',
  },
  grunt: {
    line: '#0d2612',
    body: ['#1d4623', '#2d6b34', '#438e49', '#69b96c'],
    wing: ['#7a9877', '#9fbb9a', '#c4d9be', '#e6f0e0'],
    metal: ['#20291f', '#39432f', '#5f6d52'],
    glass: '#2c4a2e', glassHi: '#d8f0c0',
    mark: '#d8ad2a', markHi: '#3a2f10', prop: '#d7e2d0',
  },
  zig: {
    line: '#37240a',
    body: ['#7a5310', '#a97418', '#d09a25', '#f0c559'],
    wing: ['#a08a5e', '#c6b184', '#e3d3aa', '#f8f0d8',
    ],
    metal: ['#33291a', '#4d4028', '#7a6a45'],
    glass: '#6b5218', glassHi: '#ffeeb0',
    mark: '#b8352c', markHi: '#ffffff', prop: '#efe4c4',
  },
  diver: {
    line: '#3a0f0c',
    body: ['#7c1a15', '#a62a21', '#cd4136', '#ea7065'],
    wing: ['#7b5a56', '#98736d', '#b78d86', '#d6ada5'],
    metal: ['#2e1512', '#48241f', '#6d3d36'],
    glass: '#6b241e', glassHi: '#ffd4cc',
    mark: '#1a1a1a', markHi: '#ffffff', prop: '#f0d4d0',
  },
  gunner: {
    line: '#121822',
    body: ['#33404f', '#4a5a70', '#68798f', '#8ea2ba'],
    wing: ['#66748a', '#8797ac', '#adbccd', '#d5dfea'],
    metal: ['#39434f', '#4e5b6c', '#7b8b9f'],
    glass: '#5f7c96', glassHi: '#dcf1ff',
    mark: '#c8352c', markHi: '#ffffff', prop: '#c6d1de',
  },
  // 2스테이지 보스 전익기 — 사막 도장의 거대한 삼각 날개
  wingboss: {
    line: '#1b1408',
    wing: ['#4a3d22', '#66552f', '#87703e', '#b09456'],
    body: ['#3a301b', '#544526', '#725d33', '#9c8046'],
    panel: '#3d3219',
    metal: ['#2b2617', '#443c26', '#6f6544'],
    intake: '#100d06',
    glass: '#5d6b3a', glassHi: '#d8ecac',
    glow: '#e0642c', glowHi: '#ffc06a',
    mark: '#a8291f', markHi: '#f0e0c0',
  },
  // 라스트 보스 비공정 — 검은 기낭에 등불만 살아 있다
  airship: {
    line: '#04060a',
    env: ['#0a0c11', '#14171d', '#23272f', '#363c48'],   // 기낭(가장자리→가운데)
    rib: '#06080c',
    fin: ['#0c0f14', '#232833'],
    metal: ['#191d24', '#2a2f39', '#454c59'],
    hull: ['#14171d', '#232833'],
    lamp: '#8a4a12', lampHi: '#ffb648',
    glow: '#e0402c', prop: '#8d94a2',
  },
  boss: {
    line: '#0e141d',
    body: ['#333f57', '#455674', '#5c7295', '#889fc2'],
    wing: ['#5d6b83', '#7d8ca6', '#a3b1c6', '#ccd6e3'],
    metal: ['#2b3543', '#3d4a5e', '#6b7c93'],
    glass: '#5d7f9c', glassHi: '#e0f2ff',
    mark: '#d03a2c', markHi: '#ffffff', prop: '#a8b4c4',
  },
};

// ---- 굽기 ----

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

// 왼쪽 절반을 가운데 열 기준으로 되접어 한 줄을 완성한다.
export function mirrorRow(half) {
  let out = half;
  for (let i = half.length - 2; i >= 0; i -= 1) out += half[i];
  return out;
}

/**
 * 롤(좌우 기울기): 동체 바깥 열을 중심에서 멀수록 세로로 밀어낸다.
 * 기울면 한쪽 날개가 내려가고 반대쪽이 올라가는 걸 그대로 옮긴 것 —
 * 열 단위로 통째로 밀기 때문에 외곽선·국적 표식·명암이 원본 그대로 따라간다.
 * dir = -1 왼쪽으로 기움(왼 날개가 내려감), +1 오른쪽.
 */
function shear(rows, w, core, dir) {
  const h = rows.length;
  const cx = (w - 1) / 2;
  const out = Array.from({ length: h }, () => new Array(w).fill('.'));
  for (let x = 0; x < w; x += 1) {
    const d = Math.abs(x - cx) - core;                  // 동체 안쪽은 기울지 않는다
    const sh = d <= 0 ? 0 : Math.round(dir * Math.sign(x - cx) * d * 0.42);
    for (let y = 0; y < h; y += 1) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      const ny = y + sh;
      if (ny >= 0 && ny < h) out[ny][x] = ch;
    }
  }
  return out.map((r) => r.join(''));
}

/**
 * 픽셀맵을 캔버스로 구워 돌려준다.
 * faceDown이면 위아래를 뒤집고, bank가 있으면 주익을 기울인다.
 */
export function bakeSprite(name, { bank = 0 } = {}) {
  const map = MAPS[name];
  const pal = PALETTES[map.pal || name] || PALETTES.player;
  let rows = map.rows.map(mirrorRow);
  const w = map.w;
  const h = rows.length;
  for (const [i, r] of rows.entries()) {
    if (r.length !== w) throw new Error(`sprite ${name} row ${i}: ${r.length} != ${w}`);
  }
  if (bank) rows = shear(rows, w, map.core ?? 4, bank);

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    const row = rows[map.faceDown ? h - 1 - y : y];
    for (let x = 0; x < w; x += 1) {
      const ch = row[x];
      if (ch === '.') continue;
      const slot = SLOT[ch];
      if (!slot) continue;
      const col = Array.isArray(slot) ? pal[slot[0]][slot[1]] : pal[slot];
      const [r, g, b] = hex(col);
      const o = (y * w + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b;
      img.data[o + 3] = ch === 'p' ? 105 : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * 2스테이지 보스 — 거대 전익기(flying wing). 79x54. 기수가 아래를 향한다.
 * 폭격기와 실루엣이 완전히 달라야 "보스"로 읽힌다 — 낮고 넓은 삼각 날개에
 * 앞전을 따라 흡입구 넷, 가운데 융기한 동체와 캐노피, 날개 끝 포탑.
 */
export function bakeWing() {
  const W = 79; const H = 54;
  const cx = (W - 1) / 2;
  const pal = PALETTES.wingboss;
  const px = new Array(W * H).fill(null);
  const put = (x, y, col) => {
    const xi = Math.round(x); const yi = Math.round(y);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
    px[yi * W + xi] = col;
  };
  const rowFill = (y, x0, x1, col) => { for (let x = Math.ceil(x0); x <= Math.floor(x1); x += 1) put(x, y, col); };

  const SPAN = 38;
  const lead = (f) => 48 - 31 * f;      // 앞전(아래) — 바깥으로 갈수록 뒤로 젖혀진다
  const trail = (f) => 5 + 10 * f;      // 뒷전(위)

  // ---- 주익 ----
  for (let x = 0; x < W; x += 1) {
    const adx = Math.abs(x - cx);
    if (adx > SPAN) continue;
    const f = adx / SPAN;
    const y0 = trail(f); const y1 = lead(f);
    for (let y = Math.round(y0); y <= Math.round(y1); y += 1) {
      const t = (y - y0) / Math.max(1, y1 - y0);      // 0 뒷전 → 1 앞전
      const tip = 1 - 0.3 * f;                        // 끝으로 갈수록 어둡게
      const v = (0.3 + 0.7 * t) * tip;
      const i = v > 0.78 ? 3 : (v > 0.55 ? 2 : (v > 0.3 ? 1 : 0));
      put(x, y, pal.wing[i]);
    }
    // 앞전 하이라이트
    put(x, Math.round(y1), pal.wing[3]);
    // 익면 패널선
    if (adx % 9 === 0 && adx > 6) for (let y = Math.round(y0) + 2; y <= Math.round(y1) - 2; y += 1) put(x, y, pal.panel);
  }

  // ---- 엔진 흡입구 + 배기 ----
  for (const sgn of [-1, 1]) {
    for (const d of [13, 26]) {
      const ex = cx + sgn * d;
      const f = d / SPAN;
      const ly = lead(f);
      for (let y = Math.round(ly) - 13; y <= Math.round(ly) - 2; y += 1) {
        const w = (y < ly - 11 || y > ly - 4) ? 2 : 4;
        for (let x = ex - w; x <= ex + w; x += 1) {
          const u = Math.abs(x - ex) / w;
          put(x, y, u > 0.75 ? pal.line : (u > 0.3 ? pal.metal[0] : pal.metal[2]));
        }
      }
      rowFill(Math.round(ly) - 2, ex - 3, ex + 3, pal.intake);     // 시커먼 흡입구
      rowFill(Math.round(ly) - 3, ex - 2, ex + 2, pal.intake);
      put(ex, Math.round(trail(f)) + 1, pal.glow);                  // 뒤쪽 배기 불빛
      put(ex - 1, Math.round(trail(f)) + 1, pal.glowHi);
    }
  }

  // ---- 가운데 융기한 동체 ----
  for (let y = 3; y <= 51; y += 1) {
    const t = (y - 3) / 48;
    const hw = 9 * Math.sin(Math.PI * (0.18 + 0.82 * t) ** 0.8);
    if (hw < 1) continue;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x += 1) {
      const u = Math.abs(x - cx) / hw;
      const i = u > 0.9 ? 0 : (u > 0.62 ? 1 : (u > 0.28 ? 2 : 3));
      put(x, y, pal.body[i]);
    }
  }
  // 캐노피 — 기수 쪽에 낮게 붙은 유리
  for (let y = 34; y <= 44; y += 1) {
    const hw = 4 - Math.abs(y - 39) * 0.42;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x += 1) {
      put(x, y, Math.abs(x - cx) / Math.max(1, hw) > 0.55 ? pal.glass : pal.glassHi);
    }
  }
  // 등 포탑
  for (let y = 12; y <= 20; y += 1) {
    const w = (y < 14 || y > 18) ? 2 : 4;
    for (let x = cx - w; x <= cx + w; x += 1) put(x, y, Math.abs(x - cx) > w - 1 ? pal.line : pal.metal[1]);
  }
  put(cx, 21, pal.glow); put(cx, 22, pal.glow);

  // ---- 날개 끝 포탑(윙렛) ----
  for (const sgn of [-1, 1]) {
    const tx = cx + sgn * (SPAN - 3);
    for (let y = 14; y <= 24; y += 1) {
      const w = (y < 16 || y > 22) ? 1 : 2;
      for (let x = tx - w; x <= tx + w; x += 1) put(x, y, Math.abs(x - tx) > w - 1 ? pal.line : pal.metal[2]);
    }
    put(tx, 25, pal.glow);
  }

  // ---- 국적 표식 ----
  for (const sgn of [-1, 1]) {
    const mx = cx + sgn * 20;
    const my = Math.round((trail(20 / SPAN) + lead(20 / SPAN)) / 2);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > 1) continue;
        put(mx + dx, my + dy, dx === 0 && dy === 0 ? pal.markHi : pal.mark);
      }
    }
  }

  // ---- 외곽선 ----
  const filled = (x, y) => x >= 0 && x < W && y >= 0 && y < H && px[y * W + x] !== null;
  const edge = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!filled(x, y)) continue;
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) edge.push(y * W + x);
    }
  }
  for (const i of edge) px[i] = pal.line;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < px.length; i += 1) {
    const col = px[i];
    if (!col) continue;
    const [r, g, b] = hex(col);
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * 라스트 보스 — 까만 열기구 비공정. 69x112. 기수가 아래를 향한다.
 * 손으로 찍기엔 너무 커서(반쪽만 해도 35x112) 전용 루틴으로 굽는다.
 * 그리는 순서: 미익 → 기낭 → 등지느러미 → 기수 캡 → 엔진 포드 → 측면 포탑 → 곤돌라 → 외곽선
 */
export function bakeAirship() {
  const W = 69; const H = 112;
  const cx = (W - 1) / 2;
  const pal = PALETTES.airship;
  const px = new Array(W * H).fill(null);
  const put = (x, y, col) => {
    const xi = Math.round(x); const yi = Math.round(y);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
    px[yi * W + xi] = col;
  };
  const row = (y, x0, x1, col) => { for (let x = Math.ceil(x0); x <= Math.floor(x1); x += 1) put(x, y, col); };

  // ---- 기낭 단면: 꼬리(위)는 뾰족하고 기수(아래)는 뭉툭한 물방울 ----
  const ENV0 = 2; const ENV1 = 90; const MAXHALF = 26; const PEAK = 0.6;
  const half = (y) => {
    const t = (y - ENV0) / (ENV1 - ENV0);
    if (t < 0 || t > 1) return -1;
    const f = t < PEAK
      ? Math.sin((t / PEAK) * (Math.PI / 2)) ** 0.68
      : 0.6 + 0.4 * Math.cos(((t - PEAK) / (1 - PEAK)) * (Math.PI / 2));
    return MAXHALF * f;
  };

  // ---- 수평 미익: 뒤로 갈수록 넓어지는 삼각 안정판 ----
  for (let y = 5; y <= 31; y += 1) {
    const t = (y - 5) / 26;
    const sp = 33 - 21 * t;
    const inner = 8;
    const tone = t > 0.55 ? pal.fin[1] : pal.fin[0];
    row(y, cx - sp, cx - inner, tone);
    row(y, cx + inner, cx + sp, tone);
    // 앞전을 한 도트 밝게 — 판이 겹쳐 보이지 않게
    put(cx - sp, y, pal.fin[1]); put(cx + sp, y, pal.fin[1]);
  }

  // ---- 기낭 ----
  for (let y = ENV0; y <= ENV1; y += 1) {
    const hw = half(y);
    if (hw < 0.6) continue;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x += 1) {
      const u = Math.abs(x - cx) / hw;
      const i = u > 0.93 ? 0 : (u > 0.68 ? 1 : (u > 0.34 ? 2 : 3));
      put(x, y, pal.env[i]);
    }
    // 늑재 — 천을 나눈 가로 이음선
    if ((y - ENV0) % 12 === 0 && y > ENV0 + 6 && y < ENV1 - 8) row(y, cx - hw + 1, cx + hw - 1, pal.rib);
  }
  // 세로 이음선 두 줄
  for (let y = ENV0 + 4; y <= ENV1 - 4; y += 1) {
    const hw = half(y);
    if (hw < 6) continue;
    put(cx - hw * 0.58, y, pal.rib);
    put(cx + hw * 0.58, y, pal.rib);
  }

  // ---- 등지느러미(수직 미익) ----
  for (let y = 1; y <= 30; y += 1) {
    const w = 1 + Math.round(y / 9);
    row(y, cx - w, cx + w, y < 5 ? pal.fin[0] : pal.fin[1]);
    put(cx, y, pal.env[3]);
  }

  // ---- 기수 캡 ----
  for (let y = 82; y <= ENV1; y += 1) {
    const hw = half(y);
    if (hw < 1) continue;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x += 1) {
      const u = Math.abs(x - cx) / Math.max(1, hw);
      put(x, y, u > 0.72 ? pal.metal[0] : (u > 0.36 ? pal.metal[1] : pal.metal[2]));
    }
  }
  row(81, cx - half(81) + 1, cx + half(81) - 1, pal.metal[2]);   // 캡 테두리 광택

  // ---- 엔진 포드 + 프로펠러 ----
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * 30;
    for (let y = 50; y <= 74; y += 1) {
      const w = (y < 54 || y > 70) ? 2 : 4;
      for (let x = Math.ceil(ex - w); x <= Math.floor(ex + w); x += 1) {
        const u = Math.abs(x - ex) / w;
        put(x, y, u > 0.72 ? pal.metal[0] : (u > 0.3 ? pal.metal[1] : pal.metal[2]));
      }
    }
    put(ex, 49, pal.metal[2]);
    for (let x = -6; x <= 6; x += 1) {                 // 프로펠러 잔상
      if (x % 2) continue;
      put(ex + x, 77, pal.prop);
      if (Math.abs(x) < 3) put(ex + x, 78, pal.prop);
    }
  }

  // ---- 측면 포탑: 기낭 옆구리에 달린 반구 + 붉은 조준등 ----
  for (const sgn of [-1, 1]) {
    const tx = cx + sgn * 21;
    for (let y = 58; y <= 68; y += 1) {
      const w = (y < 60 || y > 66) ? 2 : 4;
      for (let x = tx - w; x <= tx + w; x += 1) {
        put(x, y, Math.abs(x - tx) > w - 1 ? pal.line : pal.metal[1]);
      }
    }
    put(tx, 69, pal.glow); put(tx, 70, pal.glow);
  }

  // ---- 곤돌라: 기낭 밑에 매달려 기수 앞으로 나온다. 창에 불이 켜져 있다 ----
  for (let y = 72; y <= 106; y += 1) {
    let w;
    if (y < 76) w = 5 + (y - 72) * 1.6;
    else if (y > 100) w = 11 - (y - 100) * 1.8;
    else w = 11;
    if (w < 1) continue;
    for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x += 1) {
      const u = Math.abs(x - cx) / w;
      put(x, y, u > 0.86 ? pal.line : (u > 0.48 ? pal.hull[0] : pal.hull[1]));
    }
  }
  for (let r = 0; r < 4; r += 1) {                     // 줄지어 켜진 창
    for (let i = -2; i <= 2; i += 1) {
      put(cx + i * 4, 80 + r * 6, pal.lamp);
      put(cx + i * 4 + 1, 80 + r * 6, pal.lampHi);
    }
  }
  for (let y = 74; y <= 104; y += 2) put(cx - 12, y, pal.line);   // 용골 그림자
  for (let y = 74; y <= 104; y += 2) put(cx + 12, y, pal.line);

  // ---- 외곽선 ----
  const filled = (x, y) => x >= 0 && x < W && y >= 0 && y < H && px[y * W + x] !== null;
  const edge = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!filled(x, y) || px[y * W + x] === pal.prop) continue;
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) edge.push(y * W + x);
    }
  }
  for (const i of edge) px[i] = pal.line;

  // ---- 캔버스로 ----
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < px.length; i += 1) {
    const col = px[i];
    if (!col) continue;
    const [r, g, b] = hex(col);
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b;
    img.data[o + 3] = col === pal.prop ? 110 : 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---- 5x7 비트맵 폰트 ----
export const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

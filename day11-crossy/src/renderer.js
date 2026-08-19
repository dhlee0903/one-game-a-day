// 게임 상태를 읽어 3D 장면을 조립한다. 상태를 바꾸지 않는다.

import {
  LANE, PAL, EDGE_COLS, HALF_COLS, GRASS_TOP, ROAD_TOP, WATER_TOP, SLAB_BOTTOM,
  BEHIND_WARN, BEHIND_LIMIT,
} from './config.js';
import { Engine } from './engine.js';
import {
  FACE, CHARS, treeModel, logModel, flowerModel, ROCK, COIN, SIGNAL,
  TRAIN_CAR, TRAIN_HEAD, EAGLE, EAGLE_WING, GLYPHS, GLYPH_W, GLYPH_H,
} from './models.js';

// 결정적인 해시 — 줄마다 같은 잔물결 배치가 나오도록.
const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// 글자를 (행, 열) 칸 목록으로 펼친다. 줄은 가운데 정렬.
// space는 글자 사이 간격 — 테두리를 두를 거면 1보다 넓어야 글자끼리 붙지 않는다.
function textCells(lines, gap, space = 1) {
  const step = GLYPH_W + space;
  let cols = 0;
  for (const line of lines) cols = Math.max(cols, line.length * step - space);
  const set = new Set();
  lines.forEach((line, li) => {
    const w = line.length * step - space;
    const off = Math.round((cols - w) / 2);
    for (let i = 0; i < line.length; i += 1) {
      const g = GLYPHS[line[i]];
      if (!g) continue;
      for (let r = 0; r < GLYPH_H; r += 1) {
        for (let c = 0; c < GLYPH_W; c += 1) {
          if (g[r] & (1 << (GLYPH_W - 1 - c))) {
            set.add(`${li * (GLYPH_H + gap) + r},${off + i * step + c}`);
          }
        }
      }
    }
  });
  const rows = lines.length * GLYPH_H + (lines.length - 1) * gap;
  return { set, list: toPairs(set), rows, cols };
}

// 글자 칸의 둘레 — 검은 테두리를 두를 자리.
function outlineCells(set) {
  const out = new Set();
  for (const key of set) {
    const i = key.indexOf(',');
    const r = +key.slice(0, i); const c = +key.slice(i + 1);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const k = `${r + dr},${c + dc}`;
        if (!set.has(k)) out.add(k);
      }
    }
  }
  return toPairs(out);
}

function toPairs(set) {
  const out = [];
  for (const key of set) {
    const i = key.indexOf(',');
    out.push([+key.slice(0, i), +key.slice(i + 1)]);
  }
  return out;
}

const SLAB_W = EDGE_COLS * 2 + 1;
const SLAB_H_GRASS = GRASS_TOP - SLAB_BOTTOM;
const SLAB_H_ROAD = ROAD_TOP - SLAB_BOTTOM;
const SLAB_H_WATER = WATER_TOP - SLAB_BOTTOM;

// 체크무늬용 x 목록(고정) — 프레임마다 만들지 않는다.
const XS_EVEN = [];
const XS_ODD = [];
const XS_DASH = [];
const XS_SLEEPER = [];
for (let x = -EDGE_COLS; x <= EDGE_COLS; x += 1) {
  (x & 1 ? XS_ODD : XS_EVEN).push(x);
  if (!(x & 1)) XS_DASH.push(x);
}
for (let x = -EDGE_COLS; x <= EDGE_COLS; x += 0.62) XS_SLEEPER.push(x);

const ROWS_FRONT = 7;
const ROWS_FAR = 24;      // 지면을 그리는 끝 줄
const ROWS_DETAIL = 19;   // 나무·차량은 여기까지만(그 너머는 안개에 묻힌다)
const FOG_FADE = 165;     // 지면이 끊기는 지점부터 안개가 걷히는 거리(px)
const CHAR_SCALE = 1.22;  // 캐릭터를 칸 대비 큼직하게(원작 비율)

// 게임오버 글자: 카메라 앞 GO_DIST칸에 화면과 평행하게 세운다.
// GAME / OVER는 사이를 띄우지 않고 한 덩어리로 붙여 검은 테두리를 두른다.
const GO_DIST = 18;
const GO_CUBE = 0.208;    // 글자 한 픽셀의 크기(월드 단위)
const GO_Y = 3.0;
// 줄 사이는 한 칸만 띄워 두 줄이 검은 테두리로 이어진 한 덩어리가 되게 하고,
// 글자 사이는 두 칸 띄워 테두리가 글자를 서로 먹지 않게 한다.
const GO = textCells(['GAME', 'OVER'], 1, 2);
const GO_OUTLINE = outlineCells(GO.set);

// 안내 문구도 글자 블록으로. 작아서 입체 대신 납작한 판으로 찍는다.
const HINT_CUBE = 0.061;
const HINT_Y = 0.38;
const HINT = textCells(['PRESS ANY BUTTON', 'TO RESTART'], 3, 2);
const HINT_OUTLINE = outlineCells(HINT.set);

// 물 잔물결
const RIPPLES = 5;

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.eng = new Engine(canvas);
    this.w = 0; this.h = 0;
    this.sky = null;
    this.spin = 0;
    this.time = 0;                    // 물결 등 흐르는 연출용 시간
    this.goRise = 0;                  // 게임오버 글자가 떠오르는 정도
    this.goPos = { x: 0, y: 0, z: 0 }; // 글자 좌표 계산용 스크래치
    this.goCv = null;                 // 미리 구워 둔 게임오버 글자
    this.hintCv = null;
  }

  resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const r = this.cv.getBoundingClientRect();
    const w = Math.max(240, Math.round(r.width));
    const h = Math.max(320, Math.round(r.height));
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.eng.resize(w, h);
    this.goCv = null;   // 크기가 바뀌면 글자도 다시 굽는다
    this.hintCv = null;
    // 지면이 끊기는 높이 언저리는 하늘색을 단색으로 둔다. 그래야 그 위를
    // 같은 색 안개로 덮었을 때 경계가 보이지 않는다.
    this.sky = this.c.createLinearGradient(0, 0, 0, h);
    this.sky.addColorStop(0, PAL.sky0);
    this.sky.addColorStop(0.46, PAL.sky0);
    this.sky.addColorStop(1, PAL.sky1);
  }

  render(game, dt) {
    this.spin = (this.spin + dt * 2.4) % (Math.PI * 2);
    this.time = (this.time + dt) % 3600;
    // 결과 화면에 들어오면 글자가 아래에서 살짝 떠오른다.
    this.goRise = game.state === 'over'
      ? this.goRise + (0 - this.goRise) * Math.min(1, dt * 7)
      : -1.1;
    const c = this.c;
    const eng = this.eng;

    c.fillStyle = this.sky;
    c.fillRect(0, 0, this.w, this.h);

    // 깔렸을 때의 화면 흔들림
    let shakeX = 0; let shakeY = 0;
    if (game.shake > 0) {
      const k = game.shake * 5;
      shakeX = (Math.random() - 0.5) * k;
      shakeY = (Math.random() - 0.5) * k;
    }
    c.save();
    if (shakeX || shakeY) c.translate(shakeX, shakeY);

    eng.begin();
    eng.setFocus(game.camZ);

    const base = Math.floor(game.camZ);
    const detail = base + ROWS_DETAIL;
    // 먼 줄부터 넣는다(정렬이 해주지만 배치 순서도 맞춰 둔다).
    for (let z = base + ROWS_FAR; z >= base - ROWS_FRONT; z -= 1) {
      const lane = game.world.laneAt(z);
      if (lane) this.lane(eng, lane, game, z <= detail);
    }

    this.actors(eng, game);
    eng.flush();

    // 지면이 끊기는 자리부터 아래로 안개를 깔아, 먼 줄이 하늘로 녹아들게 한다.
    // 기준 높이는 가장 높은 지면(풀밭 윗면) — 그래야 마지막 줄의 윗면이
    // 안개 위로 삐져나와 초록 선으로 보이지 않는다.
    eng.project(0, GRASS_TOP, base + ROWS_FAR + 0.5, 0);
    const yCut = eng.sy[0] - 6;
    const fog = c.createLinearGradient(0, yCut, 0, yCut + FOG_FADE);
    fog.addColorStop(0, PAL.sky0);
    fog.addColorStop(1, 'rgba(191,231,251,0)');
    c.fillStyle = fog;
    c.fillRect(0, yCut, this.w, FOG_FADE + 2);
    c.restore();

    if (game.state === 'play' && game.behind() > BEHIND_WARN) this.dangerEdge(c, game);
    if (game.state === 'over') this.gameOver(c, eng, game);
  }

  // ---- 게임오버 (블록으로 찍은 글자) ----

  gameOver(c, eng, game) {
    c.fillStyle = 'rgba(10, 26, 40, .46)';
    c.fillRect(0, 0, this.w, this.h);
    if (!this.goCv || this.goCv.width !== this.cv.width) this.buildOverlay();

    // 글자는 화면에 고정된 위치라 매 프레임 다시 그릴 필요가 없다.
    // 미리 구워 둔 그림을 얹고, 떠오르는 연출만 세로로 밀어 준다.
    const rise = this.goRise * (eng.f / GO_DIST);
    c.drawImage(this.goCv, 0, -rise, this.w, this.h);
    c.globalAlpha = Math.abs(Math.sin(game.overT * 3.0)) > 0.35 ? 1 : 0.45;
    c.drawImage(this.hintCv, 0, 0, this.w, this.h);
    c.globalAlpha = 1;
  }

  // 게임오버 글자를 오프스크린에 한 번만 구워 둔다. 카메라 기준으로 놓은 판이라
  // 시점이 움직여도 화면상 위치가 변하지 않으므로 그대로 재사용할 수 있다.
  buildOverlay() {
    const eng = this.eng;
    const dpr = this.cv.width / this.w;
    const make = () => {
      const cv = document.createElement('canvas');
      cv.width = this.cv.width; cv.height = this.cv.height;
      const cx = cv.getContext('2d');
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [cv, cx];
    };
    const prev = eng.c;
    const [goCv, goCx] = make();
    eng.c = goCx;
    eng.begin();
    this.cells(eng, GO_OUTLINE, GO, GO_CUBE, GO_Y, '#12161f', false); // 검은 테두리 먼저
    this.cells(eng, GO.list, GO, GO_CUBE, GO_Y, '#ffffff', false);    // 그 위에 하얀 글자
    eng.flush();

    const [hintCv, hintCx] = make();
    eng.c = hintCx;
    eng.begin();
    this.cells(eng, HINT_OUTLINE, HINT, HINT_CUBE, HINT_Y, '#12161f', true);
    this.cells(eng, HINT.list, HINT, HINT_CUBE, HINT_Y, '#ffffff', true);
    eng.flush();

    eng.c = prev;
    this.goCv = goCv;
    this.hintCv = hintCv;
  }

  // 글자 칸 목록을 카메라 앞 판 위에 찍는다. plate면 납작하게, 아니면 입체 블록으로.
  cells(eng, list, block, cube, centerV, color, plate) {
    const u0 = (block.cols - 1) / 2;
    const v0 = (block.rows - 1) / 2;
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i][0]; const cc = list[i][1];
      const u = (cc - u0) * cube;
      const v = centerV + (v0 - r) * cube;
      if (plate) {
        eng.plate(u, v, cube, cube, GO_DIST, color);
      } else {
        eng.fromCamera(u, v, GO_DIST, this.goPos);
        eng.box(this.goPos.x, this.goPos.y - cube / 2, this.goPos.z, cube, cube, cube, color);
      }
    }
  }

  // ---- 차선 ----

  lane(eng, lane, game, detail) {
    if (lane.type === LANE.GRASS) this.grass(eng, lane, detail);
    else if (lane.type === LANE.ROAD) this.road(eng, lane, game, detail);
    else if (lane.type === LANE.RIVER) this.river(eng, lane, detail);
    else this.rail(eng, lane, detail);
  }

  grass(eng, lane, detail) {
    const z = lane.z;
    eng.box(0, SLAB_BOTTOM, z, SLAB_W, SLAB_H_GRASS, 1, PAL.grassSide);
    const even = z & 1 ? PAL.grassB : PAL.grassA;
    const odd = z & 1 ? PAL.grassA : PAL.grassB;
    eng.tiles(XS_EVEN, GRASS_TOP, z, 1, 1, even, -0.02);
    eng.tiles(XS_ODD, GRASS_TOP, z, 1, 1, odd, -0.02);
    if (!detail) return;

    const span = eng.halfSpan(z) + 1;
    for (const [x, b] of lane.blocks) {
      if (x < -span || x > span) continue;
      if (b.kind === 'rock') this.model(eng, ROCK, x, GRASS_TOP, z, 0);
      else this.model(eng, treeModel(b.tier), x, GRASS_TOP, z, 0);
    }
    if (lane.deco) {
      for (const f of lane.deco) {
        if (f.x < -span || f.x > span) continue;
        this.model(eng, flowerModel(f.c), f.x, GRASS_TOP, z + f.zo, 0);
      }
    }
    if (lane.coin !== null) {
      this.model(eng, COIN, lane.coin, GRASS_TOP + 0.26 + Math.sin(this.spin * 1.6) * 0.05, z, this.spin);
    }
  }

  road(eng, lane, game, detail) {
    const z = lane.z;
    eng.box(0, SLAB_BOTTOM, z, SLAB_W, SLAB_H_ROAD, 1, z & 1 ? PAL.road : PAL.roadDark);
    // 다음 줄도 도로면 경계에 점선을 긋는다.
    const next = game.world.laneAt(z + 1);
    if (next && next.type === LANE.ROAD) {
      eng.tiles(XS_DASH, ROAD_TOP, z + 0.5, 0.52, 0.1, PAL.mark, -0.02);
    }
    if (!detail) return;
    const span = eng.halfSpan(z);
    for (const car of lane.cars) {
      if (car.x < -span - car.len || car.x > span + car.len) continue;
      this.model(eng, car.model, car.x, ROAD_TOP, z, lane.dir > 0 ? FACE.right : FACE.left);
    }
  }

  // 물은 격자무늬 대신 한 장의 수면 + 물살을 따라 흐르는 잔물결로 그린다.
  river(eng, lane, detail) {
    const z = lane.z;
    eng.box(0, SLAB_BOTTOM, z, SLAB_W, SLAB_H_WATER, 1, PAL.water);
    if (!detail) return;

    const drift = this.time * lane.speed * lane.dir;
    for (let i = 0; i < RIPPLES; i += 1) {
      const seed = i + z * 3.7;
      const len = 0.5 + hash(seed) * 0.9;
      // 물살을 타고 흐르다 반대편으로 감긴다.
      let x = hash(seed + 0.5) * SLAB_W + drift;
      x = ((x % SLAB_W) + SLAB_W) % SLAB_W - SLAB_W / 2;
      const zo = (hash(seed + 1.5) - 0.5) * 0.62;
      const deep = i % 2 === 1;
      eng.quad(x, WATER_TOP + 0.004, z + zo, len, 0.085,
        deep ? PAL.waterDeep : PAL.foam, deep ? 0.5 : 0.42, -0.03);
    }

    const span = eng.halfSpan(z);
    for (const lg of lane.logs) {
      if (lg.x < -span - lg.len || lg.x > span + lg.len) continue;
      this.model(eng, logModel(lg.len), lg.x, WATER_TOP - 0.07, z, lane.dir > 0 ? FACE.right : FACE.left);
    }
  }

  rail(eng, lane, detail) {
    const z = lane.z;
    eng.box(0, SLAB_BOTTOM, z, SLAB_W, SLAB_H_ROAD, 1, PAL.railBed);
    eng.tiles(XS_SLEEPER, ROAD_TOP, z, 0.42, 0.86, PAL.sleeper, -0.02);
    eng.box(0, ROAD_TOP, z - 0.24, SLAB_W, 0.1, 0.1, PAL.rail, 0, -0.05);
    eng.box(0, ROAD_TOP, z + 0.24, SLAB_W, 0.1, 0.1, PAL.rail, 0, -0.05);
    if (!detail) return;

    // 건널목 신호기 — 기차가 오기 전 깜빡인다.
    const warn = lane.phase !== 'idle';
    const on = warn && Math.sin(lane.blink * 12) > 0;
    for (const sx of [-HALF_COLS - 0.6, HALF_COLS + 0.6]) {
      this.model(eng, SIGNAL, sx, ROAD_TOP, z, sx < 0 ? FACE.right : FACE.left);
      // 등은 항상 카메라 쪽(-z)을 향하게 붙인다.
      eng.box(sx, 1.02, z - 0.14, 0.14, 0.16, 0.14, on ? '#ff3b30' : '#5a2a2a');
    }

    if (lane.train) {
      const dir = lane.dir;
      const yaw = dir > 0 ? FACE.right : FACE.left;
      const head = lane.train.x + dir * (lane.trainLen / 2 - 1.75);
      this.model(eng, TRAIN_HEAD, head, ROAD_TOP, z, yaw);
      for (let i = 1; i <= lane.carCount; i += 1) {
        this.model(eng, TRAIN_CAR, head - dir * i * 3.5, ROAD_TOP, z, yaw);
      }
    }
  }

  // ---- 등장인물 ----

  actors(eng, game) {
    const p = game.player;
    const model = CHARS[game.charIndex].model;
    const [sxz, sy] = p.squash();
    const [ox, oz] = p.bumpOffset();
    const lane = game.world.laneAt(p.gz);
    const ground = lane && lane.type === LANE.RIVER ? WATER_TOP - 0.05
      : lane && lane.type === LANE.GRASS ? GRASS_TOP : ROAD_TOP;

    const px = p.x + ox;
    const pz = p.z + oz;
    const py = ground + p.y + p.lifted - p.sink * 1.5;

    // 그림자 — 높이 뛰면 작고 옅어진다.
    if (p.sink < 0.2 && p.lifted < 0.3) {
      const k = 1 - Math.min(1, p.y / 0.7);
      eng.quad(px, ground + 0.012, pz, 0.74 * (0.6 + k * 0.4), 0.66 * (0.6 + k * 0.4),
        '#000', 0.16 + k * 0.12, -0.03);
    }
    if (p.sink < 0.98) this.model(eng, model, px, py, pz, p.yaw, sxz * CHAR_SCALE, sy * CHAR_SCALE);

    // 물보라
    if (game.splash > 0) {
      const k = game.splash;
      for (let i = 0; i < 6; i += 1) {
        const a = i * 1.05 + this.spin;
        const r = (1 - k) * 0.55 + 0.12;
        eng.box(px + Math.cos(a) * r, WATER_TOP + k * 0.5, pz + Math.sin(a) * r,
          0.12, 0.12, 0.12, '#bfe6ff');
      }
    }

    if (game.eagle) this.drawEagle(eng, game.eagle);
  }

  drawEagle(eng, e) {
    const flap = Math.sin(e.t * 34) * 0.14;
    this.model(eng, EAGLE, e.x, e.y, e.z, FACE.fwd);
    const w = EAGLE_WING;
    eng.box(e.x - 0.62, e.y + 0.18 + flap, e.z - 0.02, w.w, w.h, w.d, w.c);
    eng.box(e.x + 0.62, e.y + 0.18 - flap, e.z - 0.02, w.w, w.h, w.d, w.c);
  }

  // 모델(로컬 박스 배열)을 위치·회전·배율을 적용해 등록한다.
  model(eng, boxes, x, y, z, yaw, sxz = 1, sy = 1) {
    const ca = Math.cos(yaw); const sa = Math.sin(yaw);
    for (let i = 0; i < boxes.length; i += 1) {
      const b = boxes[i];
      const bx = b.x * sxz; const bz = b.z * sxz;
      eng.box(
        x + bx * ca - bz * sa,
        y + b.y * sy,
        z + bx * sa + bz * ca,
        b.w * sxz, b.h * sy, b.d * sxz, b.c, yaw,
      );
    }
  }

  // 화면 아래로 밀려나 독수리가 오기 직전이면 가장자리에 붉은 경고.
  dangerEdge(c, game) {
    const b = game.behind();
    const k = Math.min(1, (b - BEHIND_WARN) / (BEHIND_LIMIT - BEHIND_WARN));
    const pulse = 0.35 + Math.abs(Math.sin(this.spin * 3.4)) * 0.45;
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, `rgba(214,48,42,${0.5 * k * pulse})`);
    g.addColorStop(0.35, 'rgba(214,48,42,0)');
    g.addColorStop(1, `rgba(214,48,42,${0.34 * k * pulse})`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }
}

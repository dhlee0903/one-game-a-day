// 게임 상태를 읽어 3D 장면을 조립한다. 상태를 바꾸지 않는다.

import {
  LANE, PAL, EDGE_COLS, HALF_COLS, GRASS_TOP, ROAD_TOP, WATER_TOP, SLAB_BOTTOM,
  IDLE_WARN, IDLE_LIMIT,
} from './config.js';
import { Engine } from './engine.js';
import {
  FACE, CHARS, treeModel, logModel, ROCK, COIN, SIGNAL,
  TRAIN_CAR, TRAIN_HEAD, EAGLE, EAGLE_WING,
} from './models.js';

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

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.eng = new Engine(canvas);
    this.w = 0; this.h = 0;
    this.sky = null;
    this.spin = 0;
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
    // 지면이 끊기는 높이 언저리는 하늘색을 단색으로 둔다. 그래야 그 위를
    // 같은 색 안개로 덮었을 때 경계가 보이지 않는다.
    this.sky = this.c.createLinearGradient(0, 0, 0, h);
    this.sky.addColorStop(0, PAL.sky0);
    this.sky.addColorStop(0.46, PAL.sky0);
    this.sky.addColorStop(1, PAL.sky1);
  }

  render(game, dt) {
    this.spin = (this.spin + dt * 2.4) % (Math.PI * 2);
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

    if (game.state === 'play' && game.idle > IDLE_WARN) this.dangerEdge(c, game);
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

  river(eng, lane, detail) {
    const z = lane.z;
    eng.box(0, SLAB_BOTTOM, z, SLAB_W, SLAB_H_WATER, 1, PAL.waterSide);
    const even = z & 1 ? PAL.waterB : PAL.waterA;
    const odd = z & 1 ? PAL.waterA : PAL.waterB;
    eng.tiles(XS_EVEN, WATER_TOP, z, 1, 1, even, -0.02);
    eng.tiles(XS_ODD, WATER_TOP, z, 1, 1, odd, -0.02);
    if (!detail) return;

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

  // 독수리가 오기 직전 화면 가장자리에 붉은 경고.
  dangerEdge(c, game) {
    const k = Math.min(1, (game.idle - IDLE_WARN) / (IDLE_LIMIT - IDLE_WARN));
    const pulse = 0.35 + Math.abs(Math.sin(game.idle * 7)) * 0.45;
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, `rgba(214,48,42,${0.5 * k * pulse})`);
    g.addColorStop(0.35, 'rgba(214,48,42,0)');
    g.addColorStop(1, `rgba(214,48,42,${0.34 * k * pulse})`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }
}

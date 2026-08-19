// 차선 생성과 차량·통나무·기차 시뮬레이션.
// 렌더러는 여기 상태를 읽기만 한다.

import {
  LANE, CARS, HALF_COLS, ROWS_AHEAD, difficulty,
  COIN_CHANCE, PLAIN_CHANCE, PLAIN_COIN_CHANCE,
} from './config.js';
import { carModel, FLOWER_COLORS } from './models.js';

const SPAWN_X = 14;    // 이 바깥에서 생겨나고 사라진다
const TRAIN_X = 24;

const rand = Math.random;
const pick = (a) => a[(rand() * a.length) | 0];
const range = (a, b) => a + rand() * (b - a);

export class World {
  constructor() {
    this.lanes = new Map();   // z → lane
    this.top = -1;            // 지금까지 만든 가장 먼 z
    this.groupLeft = 0;       // 현재 그룹에 남은 줄 수
    this.groupType = LANE.GRASS;
    this.dangerRun = 0;       // 연속으로 놓인 위험 그룹 수
    this.groupPlain = false;  // 현재 그룹이 넓은 평야인지
  }

  reset() {
    this.lanes.clear();
    this.top = -1;
    this.groupLeft = 0;
    this.dangerRun = 0;
    // 출발 지점은 항상 안전한 풀밭 4줄.
    for (let z = -3; z <= 3; z += 1) this.lanes.set(z, this.makeGrass(z, true));
    this.top = 3;
    this.ensure(ROWS_AHEAD);
  }

  laneAt(z) { return this.lanes.get(z) || null; }

  // z까지 차선을 만들어 둔다.
  ensure(z) {
    while (this.top < z) {
      this.top += 1;
      this.lanes.set(this.top, this.makeLane(this.top));
    }
  }

  // 카메라 뒤로 멀어진 줄은 버린다.
  prune(minZ) {
    for (const z of this.lanes.keys()) if (z < minZ) this.lanes.delete(z);
  }

  // ---- 생성 ----

  makeLane(z) {
    if (this.groupLeft <= 0) this.planGroup(z);
    this.groupLeft -= 1;
    const d = difficulty(z);
    if (this.groupType === LANE.ROAD) return this.makeRoad(z, d);
    if (this.groupType === LANE.RIVER) return this.makeRiver(z, d);
    if (this.groupType === LANE.RAIL) return this.makeRail(z, d);
    return this.makeGrass(z, false, this.groupPlain);
  }

  planGroup(z) {
    const d = difficulty(z);
    const r = rand();
    this.groupPlain = false;
    // 가끔 탁 트인 평야가 나온다 — 나무가 거의 없고 꽃과 코인이 흩뿌려진 넓은 구간.
    if (rand() < PLAIN_CHANCE) {
      this.groupType = LANE.GRASS;
      this.groupPlain = true;
      this.groupLeft = 4 + ((rand() * 4) | 0);
      this.dangerRun = 0;
      return;
    }
    // 위험 지대가 너무 길게 이어지면 풀밭을 끼워 숨을 돌리게 한다.
    if (this.dangerRun >= 2 || (this.groupType !== LANE.GRASS && r < 0.34)) {
      this.groupType = LANE.GRASS;
      this.groupLeft = 1 + ((rand() * (d > 0.5 ? 2 : 3)) | 0);
      this.dangerRun = 0;
      return;
    }
    const t = rand();
    if (t < 0.44) { this.groupType = LANE.ROAD; this.groupLeft = 1 + ((rand() * (2 + d * 2.4)) | 0); }
    else if (t < 0.74) { this.groupType = LANE.RIVER; this.groupLeft = 1 + ((rand() * (2 + d * 1.6)) | 0); }
    else if (t < 0.86) { this.groupType = LANE.RAIL; this.groupLeft = 1 + ((rand() * 1.9) | 0); }
    else { this.groupType = LANE.GRASS; this.groupLeft = 1 + ((rand() * 2) | 0); }
    if (this.groupType !== LANE.GRASS) this.dangerRun += 1;
  }

  makeGrass(z, safe, plain = false) {
    const d = difficulty(z);
    const lane = { type: LANE.GRASS, z, plain, blocks: new Map(), coin: null, deco: null };
    if (!safe) {
      // 평야는 시야가 탁 트이도록 장애물을 거의 두지 않는다.
      const density = plain ? 0.03 : 0.16 + d * 0.16;
      const free = [];
      for (let x = -HALF_COLS; x <= HALF_COLS; x += 1) {
        if (rand() < density) {
          lane.blocks.set(x, rand() < 0.22
            ? { kind: 'rock' }
            : { kind: 'tree', tier: 1 + ((rand() * 3) | 0) });
        } else free.push(x);
      }
      // 한 줄이 완전히 막히는 일은 없게 한다.
      while (free.length < 6) {
        const x = -HALF_COLS + ((rand() * (HALF_COLS * 2 + 1)) | 0);
        if (lane.blocks.delete(x)) free.push(x);
      }
      if (rand() < (plain ? PLAIN_COIN_CHANCE : COIN_CHANCE)) lane.coin = pick(free);
      if (plain) {
        // 막지 않는 꽃 장식 — 평야를 한눈에 알아보게 한다.
        lane.deco = [];
        const n = 2 + ((rand() * 4) | 0);
        for (let i = 0; i < n; i += 1) {
          lane.deco.push({
            x: -HALF_COLS + rand() * (HALF_COLS * 2),
            zo: (rand() - 0.5) * 0.6,
            c: pick(FLOWER_COLORS),
          });
        }
      }
    } else if (z <= -2) {
      // 시작 지점 뒤는 나무로 막아 되돌아가지 못하게 한다. z = -1은 비워 둔다 —
      // 키 큰 나무가 바로 앞줄에 서면 시작할 때 플레이어를 가린다.
      for (let x = -HALF_COLS; x <= HALF_COLS; x += 1) {
        lane.blocks.set(x, { kind: 'tree', tier: 1 + ((rand() * 2) | 0) });
      }
    }
    return lane;
  }

  makeRoad(z, d) {
    const dir = rand() < 0.5 ? 1 : -1;
    const lane = {
      type: LANE.ROAD, z, dir,
      speed: range(1.7, 3.1) * (1 + d * 0.75),
      minGap: Math.max(1.5, range(2.6, 4.4) - d * 1.1),
      maxGap: Math.max(3.2, range(5.2, 8.4) - d * 2.0),
      cars: [],
    };
    this.fillRoad(lane);
    return lane;
  }

  // 차선이 만들어지는 순간부터 차가 흐르고 있도록 미리 채운다.
  fillRoad(lane) {
    let x = -SPAWN_X;
    while (x < SPAWN_X) {
      const spec = rand() < 0.24 ? CARS[1] : CARS[0];
      const color = pick(spec.colors);
      lane.cars.push({ x: x + spec.len / 2, len: spec.len, kind: spec.kind, model: carModel(spec.kind, color) });
      x += spec.len + range(lane.minGap, lane.maxGap);
    }
  }

  makeRiver(z, d) {
    const dir = rand() < 0.5 ? 1 : -1;
    const lane = {
      type: LANE.RIVER, z, dir,
      speed: range(0.9, 1.9) * (1 + d * 0.55),
      logs: [],
    };
    let x = -SPAWN_X;
    while (x < SPAWN_X) {
      const len = 2 + ((rand() * 3) | 0);
      lane.logs.push({ x: x + len / 2, len });
      // 건널 수 없는 강이 나오지 않도록 간격을 조인다.
      x += len + range(1.6, Math.max(2.1, 3.8 - d * 1.0));
    }
    return lane;
  }

  makeRail(z, d) {
    const carCount = 2 + ((rand() * 2) | 0);
    return {
      type: LANE.RAIL, z,
      dir: rand() < 0.5 ? 1 : -1,
      phase: 'idle',          // idle → warn(경보등) → pass(통과)
      timer: range(1.4, 4.5),
      blink: 0,
      speed: 17 + d * 7,
      train: null,
      whooshed: false,   // 이번 기차의 통과음을 냈는지
      carCount,
      trainLen: 3.5 * (carCount + 1),
    };
  }

  // ---- 시뮬레이션 ----

  update(dt, minZ, maxZ) {
    for (let z = minZ; z <= maxZ; z += 1) {
      const lane = this.lanes.get(z);
      if (!lane) continue;
      if (lane.type === LANE.ROAD) this.stepRoad(lane, dt);
      else if (lane.type === LANE.RIVER) this.stepRiver(lane, dt);
      else if (lane.type === LANE.RAIL) this.stepRail(lane, dt);
    }
  }

  // 진행 방향으로 잰 좌표 u = x·dir 를 쓰면 좌우 방향을 따로 다루지 않아도 된다.
  // 들어오는 쪽 끝(u = -SPAWN_X)이 빌 때마다 새로 채워 흐름이 끊기지 않게 한다.
  stepRoad(lane, dt) {
    const dir = lane.dir;
    const cars = lane.cars;
    let uMin = Infinity;
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      car.x += lane.speed * dir * dt;
      const u = car.x * dir;
      if (u - car.len / 2 > SPAWN_X) { cars.splice(i, 1); continue; }
      if (u - car.len / 2 < uMin) uMin = u - car.len / 2;
    }
    let guard = 0;
    while (uMin > -SPAWN_X && guard < 24) {
      guard += 1;
      const spec = rand() < 0.24 ? CARS[1] : CARS[0];
      const gap = range(lane.minGap, lane.maxGap);
      const u = uMin - gap - spec.len / 2;
      cars.push({
        x: u * dir, len: spec.len, kind: spec.kind,
        model: carModel(spec.kind, pick(spec.colors)),
      });
      uMin = u - spec.len / 2;
    }
  }

  stepRiver(lane, dt) {
    const dir = lane.dir;
    const logs = lane.logs;
    let uMin = Infinity;
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const lg = logs[i];
      lg.x += lane.speed * dir * dt;
      const u = lg.x * dir;
      if (u - lg.len / 2 > SPAWN_X) { logs.splice(i, 1); continue; }
      if (u - lg.len / 2 < uMin) uMin = u - lg.len / 2;
    }
    let guard = 0;
    while (uMin > -SPAWN_X && guard < 24) {
      guard += 1;
      const len = 2 + ((rand() * 3) | 0);
      const gap = range(1.6, 3.4);
      const u = uMin - gap - len / 2;
      logs.push({ x: u * dir, len });
      uMin = u - len / 2;
    }
  }

  stepRail(lane, dt) {
    lane.timer -= dt;
    if (lane.phase === 'idle') {
      if (lane.timer <= 0) { lane.phase = 'warn'; lane.timer = 1.5; }
    } else if (lane.phase === 'warn') {
      lane.blink += dt;
      if (lane.timer <= 0) {
        lane.phase = 'pass';
        lane.dir = rand() < 0.5 ? 1 : -1;
        lane.train = { x: -lane.dir * TRAIN_X };
        lane.timer = 6;
      }
    } else {
      lane.blink += dt;
      lane.train.x += lane.speed * lane.dir * dt;
      if (lane.train.x * lane.dir > TRAIN_X) {
        lane.train = null;
        lane.whooshed = false;   // 다음 기차 때 통과음을 다시 낸다
        lane.phase = 'idle';
        lane.timer = range(2.4, 6.5);
        lane.blink = 0;
      }
    }
  }

  // ---- 조회 ----

  blocked(x, z) {
    if (x < -HALF_COLS || x > HALF_COLS) return true;
    const lane = this.lanes.get(z);
    if (!lane) return false;
    return lane.type === LANE.GRASS && lane.blocks.has(x);
  }

  // 강 위 그 자리에 통나무가 있으면 돌려준다.
  logUnder(x, z) {
    const lane = this.lanes.get(z);
    if (!lane || lane.type !== LANE.RIVER) return null;
    for (const lg of lane.logs) {
      if (Math.abs(x - lg.x) <= lg.len / 2 - 0.04) return lg;
    }
    return null;
  }

  // 차·기차에 깔렸는지. 깔렸으면 원인을 돌려준다.
  hazardAt(x, z, halfW) {
    const lane = this.lanes.get(z);
    if (!lane) return null;
    if (lane.type === LANE.ROAD) {
      for (const car of lane.cars) {
        if (Math.abs(x - car.x) < car.len / 2 + halfW) return 'car';
      }
    } else if (lane.type === LANE.RAIL && lane.train) {
      if (Math.abs(x - lane.train.x) < lane.trainLen / 2 + halfW) return 'train';
    }
    return null;
  }

  takeCoin(x, z) {
    const lane = this.lanes.get(z);
    if (lane && lane.type === LANE.GRASS && lane.coin === x) { lane.coin = null; return true; }
    return false;
  }
}

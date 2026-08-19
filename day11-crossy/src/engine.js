// 의존성 없는 초소형 3D 엔진.
// 원근 투영 + 페인터 알고리즘으로 축정렬 박스(복셀)를 그린다.
// 카메라 yaw는 0으로 고정 — 차선이 화면과 수평이고, 화면 좌우 끝의
// 블록만 원근 때문에 옆면이 드러난다(원작의 시점).

import { CAM, SHADE, VIEW_W } from './config.js';

// ---- 색 음영 캐시 ----
// 같은 색 × 같은 밝기는 프레임마다 다시 계산하지 않는다.
const shadeCache = new Map();

export function shade(hex, k) {
  const key = hex + (k * 100 | 0);
  let out = shadeCache.get(key);
  if (out) return out;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16 & 255) * k + 0.5 | 0);
  const g = Math.min(255, (n >> 8 & 255) * k + 0.5 | 0);
  const b = Math.min(255, (n & 255) * k + 0.5 | 0);
  out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}

// 그릴 것들을 담는 풀. 프레임마다 새로 만들지 않고 재사용한다.
function newItem() {
  return { kind: 0, depth: 0, x: 0, y: 0, z: 0, w: 0, h: 0, d: 0, yaw: 0, color: '#fff', alpha: 1, xs: null };
}

const BOX = 0; const QUAD = 1; const TILES = 2;

export class Engine {
  constructor(canvas) {
    this.cv = canvas;
    this.c = canvas.getContext('2d');
    this.pool = [];
    this.n = 0;
    this.w = 0; this.h = 0;

    this.cam = { x: 0, y: 0, z: 0 };
    this.sb = 0; this.cb = 1;   // 시선 피치의 sin/cos
    this.f = CAM.focal;
    this.ox = 0; this.oy = 0;

    // 투영 스크래치 (박스 하나의 8개 꼭짓점)
    this.sx = new Float32Array(8);
    this.sy = new Float32Array(8);
    this.bx = new Float32Array(4);
    this.bz = new Float32Array(4);
    this.quadIdx = new Int32Array(4);
    this.list = [];
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.ox = w / 2;
    this.oy = h / 2;
    // 화면이 좁아도 보이는 칸 수는 그대로가 되도록 초점거리를 비례해 줄인다.
    this.f = CAM.focal * (w / VIEW_W);
  }

  // 초점(플레이어가 있는 줄)을 기준으로 카메라를 놓는다.
  setFocus(z) {
    this.cam.x = 0;
    this.cam.y = CAM.height;
    this.cam.z = z - CAM.back;
    // 시선: 카메라 → (0, lookY, z + ahead)
    const dy = CAM.lookY - CAM.height;
    const dz = CAM.back + CAM.ahead;
    const len = Math.hypot(dy, dz);
    this.sb = -dy / len;  // sin(피치), 아래를 보므로 양수
    this.cb = dz / len;   // cos(피치)
    // 시선이 화면 중앙보다 살짝 위를 지나가게 해서 앞쪽을 더 보여준다.
    this.oy = this.h * 0.60;
  }

  // 월드 → 화면. 깊이(카메라 공간 z)를 돌려준다.
  project(x, y, z, i) {
    const dx = x - this.cam.x;
    const dy = y - this.cam.y;
    const dz = z - this.cam.z;
    const cy = dy * this.cb + dz * this.sb;
    const cz = -dy * this.sb + dz * this.cb;
    const pz = cz < 0.25 ? 0.25 : cz;
    const s = this.f / pz;
    this.sx[i] = this.ox + dx * s;
    this.sy[i] = this.oy - cy * s;
    return cz;
  }

  // z줄에서 화면에 들어오는 x 반경. 화면 밖 물체를 건너뛰는 데 쓴다.
  halfSpan(z) {
    const dy = -this.cam.y;
    const dz = z - this.cam.z;
    const pz = Math.max(1, -dy * this.sb + dz * this.cb);
    return (this.w * 0.5 + 70) * pz / this.f;
  }

  // 카메라 기준 좌표(오른쪽 u, 위 v, 앞 d)를 월드 좌표로. 화면에 평행한 판을
  // 놓을 때 쓴다 — 게임오버 글자처럼 원근으로 일그러지면 안 되는 것들.
  fromCamera(u, v, d, out) {
    out.x = this.cam.x + u;
    out.y = this.cam.y + v * this.cb - d * this.sb;
    out.z = this.cam.z + v * this.sb + d * this.cb;
    return out;
  }

  depthOf(x, y, z) {
    const dy = y - this.cam.y;
    const dz = z - this.cam.z;
    return -dy * this.sb + dz * this.cb;
  }

  // ---- 등록 ----

  _next() {
    if (this.n === this.pool.length) this.pool.push(newItem());
    return this.pool[this.n++];
  }

  // 바닥이 (x, y, z) 중심이고 위로 h만큼 솟은 박스.
  box(x, y, z, w, h, d, color, yaw = 0, bias = 0) {
    const it = this._next();
    it.kind = BOX;
    it.x = x; it.y = y; it.z = z;
    it.w = w; it.h = h; it.d = d;
    it.yaw = yaw; it.color = color; it.alpha = 1;
    it.depth = this.depthOf(x, y + h * 0.5, z) + bias;
    return it;
  }

  // 수평 사각형(도로 표시, 그림자 등).
  quad(x, y, z, w, d, color, alpha = 1, bias = 0) {
    const it = this._next();
    it.kind = QUAD;
    it.x = x; it.y = y; it.z = z;
    it.w = w; it.d = d;
    it.color = color; it.alpha = alpha;
    it.depth = this.depthOf(x, y, z) + bias;
    return it;
  }

  // 한 줄에 늘어선 같은 색 사각형들을 한 번의 fill로 그린다(체크무늬·차선 표시).
  tiles(xs, y, z, w, d, color, bias = 0) {
    const it = this._next();
    it.kind = TILES;
    it.xs = xs; it.y = y; it.z = z; it.w = w; it.d = d;
    it.color = color; it.alpha = 1;
    it.depth = this.depthOf(0, y, z) + bias;
    return it;
  }

  // ---- 그리기 ----

  begin() { this.n = 0; }

  flush() {
    const n = this.n;
    // 먼 것부터. 얹힌 물체는 중심이 더 높아 깊이가 작아지므로 자연히 나중에 그려진다.
    const list = this.list;
    list.length = n;
    for (let i = 0; i < n; i += 1) list[i] = this.pool[i];
    list.sort((a, b) => b.depth - a.depth);
    const c = this.c;
    for (let i = 0; i < n; i += 1) {
      const it = list[i];
      if (it.kind === BOX) this._box(c, it);
      else if (it.kind === QUAD) this._quad(c, it);
      else this._tiles(c, it);
    }
  }

  // 맞닿은 면 사이로 배경이 비치는 실금(안티에일리어싱 틈)을 막는다.
  // 면마다 stroke를 얹는 것보다 싸다 — 무게중심 기준으로 0.7px 부풀린다.
  _poly(c, a, b, d, e) {
    const sx = this.sx; const sy = this.sy;
    const cx = (sx[a] + sx[b] + sx[d] + sx[e]) * 0.25;
    const cy = (sy[a] + sy[b] + sy[d] + sy[e]) * 0.25;
    const idx = this.quadIdx;
    idx[0] = a; idx[1] = b; idx[2] = d; idx[3] = e;
    for (let i = 0; i < 4; i += 1) {
      const j = idx[i];
      const vx = sx[j] - cx; const vy = sy[j] - cy;
      const len = Math.sqrt(vx * vx + vy * vy) || 1;
      const s = (len + 0.7) / len;
      const px = cx + vx * s; const py = cy + vy * s;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  _box(c, it) {
    const { x, y, z, w, h, d, yaw } = it;
    const hw = w * 0.5; const hd = d * 0.5;
    let n0x = 0; let n0z = -1; let n1x = 1; let n1z = 0;
    let c0x; let c0z; let c1x; let c1z; let c2x; let c2z; let c3x; let c3z;
    if (yaw) {
      const ca = Math.cos(yaw); const sa = Math.sin(yaw);
      c0x = -hw * ca + hd * sa; c0z = -hw * sa - hd * ca;
      c1x = hw * ca + hd * sa; c1z = hw * sa - hd * ca;
      c2x = hw * ca - hd * sa; c2z = hw * sa + hd * ca;
      c3x = -hw * ca - hd * sa; c3z = -hw * sa + hd * ca;
      n0x = sa; n0z = -ca;      // -z면의 회전된 법선
      n1x = ca; n1z = sa;       // +x면의 회전된 법선
    } else {
      c0x = -hw; c0z = -hd; c1x = hw; c1z = -hd;
      c2x = hw; c2z = hd; c3x = -hw; c3z = hd;
    }
    const bx = this.bx; const bz = this.bz;
    bx[0] = c0x; bx[1] = c1x; bx[2] = c2x; bx[3] = c3x;
    bz[0] = c0z; bz[1] = c1z; bz[2] = c2z; bz[3] = c3z;
    const top = y + h;
    // 0~3 아랫면, 4~7 윗면
    for (let i = 0; i < 4; i += 1) {
      this.project(x + bx[i], y, z + bz[i], i);
      this.project(x + bx[i], top, z + bz[i], i + 4);
    }

    const camX = this.cam.x; const camY = this.cam.y; const camZ = this.cam.z;

    // 윗면 (법선 (0,1,0)) — 카메라가 위에 있으니 거의 항상 보인다.
    if (top - camY < 0) {
      c.fillStyle = shade(it.color, SHADE.top);
      c.beginPath();
      this._poly(c, 4, 5, 6, 7);
      c.fill();
    }

    // 옆면 4개: 바깥 법선이 카메라를 향할 때만.
    for (let i = 0; i < 4; i += 1) {
      let nx; let nz;
      if (i === 0) { nx = n0x; nz = n0z; } else if (i === 1) { nx = n1x; nz = n1z; } else if (i === 2) { nx = -n0x; nz = -n0z; } else { nx = -n1x; nz = -n1z; }
      const j = (i + 1) & 3;
      const fx = x + (bx[i] + bx[j]) * 0.5;
      const fz = z + (bz[i] + bz[j]) * 0.5;
      if (nx * (fx - camX) + nz * (fz - camZ) >= 0) continue;
      const k = Math.abs(nx) * (nx < 0 ? SHADE.left : SHADE.right)
              + Math.abs(nz) * (nz < 0 ? SHADE.near : SHADE.far);
      c.fillStyle = shade(it.color, k);
      c.beginPath();
      this._poly(c, i, j, j + 4, i + 4);
      c.fill();
    }
  }

  _quad(c, it) {
    const hw = it.w * 0.5; const hd = it.d * 0.5;
    this.project(it.x - hw, it.y, it.z - hd, 0);
    this.project(it.x + hw, it.y, it.z - hd, 1);
    this.project(it.x + hw, it.y, it.z + hd, 2);
    this.project(it.x - hw, it.y, it.z + hd, 3);
    if (it.alpha !== 1) c.globalAlpha = it.alpha;
    c.fillStyle = it.color;
    c.beginPath();
    this._poly(c, 0, 1, 2, 3);
    c.fill();
    if (it.alpha !== 1) c.globalAlpha = 1;
  }

  _tiles(c, it) {
    const hw = it.w * 0.5; const hd = it.d * 0.5;
    c.fillStyle = it.color;
    c.beginPath();
    for (let i = 0; i < it.xs.length; i += 1) {
      const x = it.xs[i];
      this.project(x - hw, it.y, it.z - hd, 0);
      this.project(x + hw, it.y, it.z - hd, 1);
      this.project(x + hw, it.y, it.z + hd, 2);
      this.project(x - hw, it.y, it.z + hd, 3);
      this._poly(c, 0, 1, 2, 3);
    }
    c.fill();
  }
}

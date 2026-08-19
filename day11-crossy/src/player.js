// 플레이어의 위치와 점프 애니메이션만 담당한다.
// "갈 수 있는가 / 죽었는가" 같은 판정은 game.js가 한다.

import { HOP_TIME, HOP_HEIGHT, LAND_TIME, BUMP_TIME, TURN_SPEED } from './config.js';

// 시작과 끝이 부드러운 보간 — 딱딱하게 튀지 않게 한다.
const smooth = (t) => t * t * (3 - 2 * t);

export class Player {
  constructor() { this.reset(); }

  reset() {
    this.x = 0; this.z = 0; this.y = 0;
    this.fromX = 0; this.fromZ = 0;
    this.toX = 0; this.toZ = 0;
    this.gz = 0;              // 착지 기준 줄
    this.t = 0;
    this.hopping = false;
    this.yaw = 0;
    this.yawTo = 0;
    this.idleT = 0;           // 제자리 들썩임용 시간
    this.land = 0;            // 착지 직후 눌림(1 → 0)
    this.bump = 0;            // 막혔을 때 살짝 부딪히는 모션(0..1)
    this.bumpDir = 0;
    this.ride = null;         // 올라탄 통나무
    this.rideLane = null;
    this.rideOffset = 0;      // 통나무 중심에서 벗어난 정도
    this.sink = 0;            // 물에 빠졌을 때 가라앉는 정도
    this.flat = 0;            // 깔렸을 때 납작해지는 정도
    this.lifted = 0;          // 독수리에게 들려 올라간 높이
    this.alive = true;
  }

  // 목표 칸으로 점프 시작.
  hopTo(x, z, yaw) {
    this.fromX = this.x; this.fromZ = this.z;
    this.toX = x; this.toZ = z;
    this.t = 0;
    this.hopping = true;
    this.yawTo = yaw;
    this.ride = null;
    this.rideLane = null;
  }

  // 막혔을 때: 이동은 없고 그 방향으로 살짝 들이받는다.
  bumpTo(yaw) {
    this.bump = 1;
    this.bumpDir = yaw;
    this.yawTo = yaw;
  }

  update(dt) {
    if (this.hopping) {
      this.t += dt / HOP_TIME;
      if (this.t >= 1) {
        this.t = 1;
        this.hopping = false;
        this.x = this.toX; this.z = this.toZ;
        this.gz = Math.round(this.toZ);
        this.y = 0;
        this.land = 1;        // 착지 눌림 시작
      } else {
        // 수평 이동은 부드럽게, 높이는 사인 아치 — 둘 다 끊기는 지점이 없다.
        const k = smooth(this.t);
        this.x = this.fromX + (this.toX - this.fromX) * k;
        this.z = this.fromZ + (this.toZ - this.fromZ) * k;
        this.y = Math.sin(this.t * Math.PI) * HOP_HEIGHT;
      }
    } else {
      if (this.bump > 0) this.bump = Math.max(0, this.bump - dt / BUMP_TIME);
      if (this.land > 0) this.land = Math.max(0, this.land - dt / LAND_TIME);
      // 가만히 서 있을 때도 살짝 들썩인다 — 완전히 멈춰 있으면 인형처럼 보인다.
      this.idleT += dt;
      this.y = Math.abs(Math.sin(this.idleT * 3.1)) * 0.022;
    }

    // 바라보는 방향은 최단 회전으로 부드럽게 돌린다.
    let d = this.yawTo - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = TURN_SPEED * dt;
    this.yaw += Math.abs(d) < step ? d : Math.sign(d) * step;
  }

  // 몸이 늘어나고 눌리는 정도 → [가로, 세로] 배율.
  // 구간을 나눠 꺾지 않고 사인 하나로 이어 붙여 모션이 매끄럽게 흐르게 한다.
  squash() {
    if (this.flat > 0) return [1 + this.flat * 0.55, Math.max(0.12, 1 - this.flat * 0.88)];
    if (this.hopping) {
      const k = Math.sin(this.t * Math.PI);      // 공중에서 최대로 늘어남
      return [1 - k * 0.11, 1 + k * 0.17];
    }
    if (this.land > 0) {
      const k = Math.sin(this.land * Math.PI);   // 착지 순간 눌렸다 되돌아옴
      return [1 + k * 0.15, 1 - k * 0.19];
    }
    if (this.bump > 0) {
      const k = Math.sin(this.bump * Math.PI);
      return [1 + k * 0.12, 1 - k * 0.12];
    }
    return [1, 1];
  }

  // 막힌 방향으로 밀리는 시각적 오프셋.
  bumpOffset() {
    if (this.bump <= 0) return [0, 0];
    const k = Math.sin(this.bump * Math.PI) * 0.16;
    return [-Math.sin(this.bumpDir) * k, Math.cos(this.bumpDir) * k];
  }
}

// Player model: which lane it's in, the smooth horizontal ease between lanes,
// and the jump / slide action state. Reads input, mutates only its own fields.

import {
  LANES, JUMP_FRAMES, JUMP_HEIGHT, SLIDE_FRAMES, LANE_LERP, INVULN_FRAMES,
} from './config.js';

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.lane = 1;          // index into LANES (0..2); 1 = center
    this.laneX = LANES[1];  // eased world-x, follows the target lane
    this.jumpT = 0;         // frames left in a jump (0 = grounded)
    this.slideT = 0;        // frames left in a slide
    this.invuln = 0;        // i-frames after a hit
    this.runT = 0;          // running animation clock
  }

  get jumping() { return this.jumpT > 0; }

  get sliding() { return this.slideT > 0; }

  // Screen-height fraction the player is lifted (0 grounded, up to 1 at apex).
  get lift() {
    if (this.jumpT <= 0) return 0;
    const p = 1 - this.jumpT / JUMP_FRAMES; // 0..1 through the jump
    return Math.sin(p * Math.PI);           // smooth up-and-down arc
  }

  moveLeft() { if (this.lane > 0) this.lane -= 1; }

  moveRight() { if (this.lane < LANES.length - 1) this.lane += 1; }

  jump() {
    if (this.jumpT > 0 || this.slideT > 0) return;
    this.jumpT = JUMP_FRAMES;
  }

  slide() {
    if (this.jumpT > 0 || this.slideT > 0) return;
    this.slideT = SLIDE_FRAMES;
  }

  hurt() { this.invuln = INVULN_FRAMES; }

  update() {
    const target = LANES[this.lane];
    this.laneX += (target - this.laneX) * LANE_LERP;
    if (Math.abs(this.laneX - target) < 0.001) this.laneX = target;
    if (this.jumpT > 0) this.jumpT -= 1;
    if (this.slideT > 0) this.slideT -= 1;
    if (this.invuln > 0) this.invuln -= 1;
    this.runT += 1;
  }
}

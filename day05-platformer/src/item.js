// A power-up mushroom: emerges from a block, then walks and falls like an
// enemy, turning at walls. Touching it grows the player.

import { CELL, GRAVITY, MAX_FALL, MUSHROOM_SPEED } from './config.js';
import { moveEntity } from './physics.js';

export class Item {
  constructor(x, y) {
    this.w = 26;
    this.h = 26;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;
    this.emerge = CELL; // rise this many px out of the block first
    this.dead = false;
  }

  update(level) {
    if (this.emerge > 0) {
      const d = Math.min(1.4, this.emerge);
      this.y -= d;
      this.emerge -= d;
      return;
    }
    this.vx = this.dir * MUSHROOM_SPEED;
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    moveEntity(this, level);
    if (this.hitWall) this.dir *= -1;
  }
}

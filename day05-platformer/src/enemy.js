// A goomba-like enemy: walks, turns at walls and ledges, can be stomped.

import { CELL, GRAVITY, MAX_FALL, ENEMY_SPEED } from './config.js';
import { moveEntity, isSolid } from './physics.js';

export class Enemy {
  constructor(spawn) {
    this.w = 26;
    this.h = 24;
    this.x = spawn.x + 3;
    this.y = spawn.y + (CELL - this.h); // sit on the ground
    this.vx = -ENEMY_SPEED;
    this.vy = 0;
    this.dir = -1;
    this.onGround = false;
    this.dead = false;
    this.deadTimer = 0;
  }

  update(level) {
    if (this.dead) { this.deadTimer -= 1; return; }

    this.vx = this.dir * ENEMY_SPEED;
    this.vy += GRAVITY;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    moveEntity(this, level);

    if (this.hitWall) this.dir *= -1;

    // turn around at a ledge so it doesn't walk off platforms
    if (this.onGround) {
      const ahead = Math.floor((this.dir > 0 ? this.x + this.w + 1 : this.x - 1) / CELL);
      const below = Math.floor((this.y + this.h + 2) / CELL);
      if (!isSolid(level, ahead, below)) this.dir *= -1;
    }
  }
}

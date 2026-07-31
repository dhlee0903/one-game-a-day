// The player: run acceleration + friction, gravity, and an edge-triggered jump
// with a variable height (release early to hop lower).

import {
  GRAVITY, MAX_FALL, MOVE_ACCEL, MAX_RUN, FRICTION, JUMP_V,
  PLAYER_SMALL_H, PLAYER_BIG_H, INVULN_FRAMES,
} from './config.js';
import { moveEntity } from './physics.js';

export class Player {
  constructor(spawn) {
    this.w = 24;
    this.reset(spawn);
  }

  reset(spawn, keepPower = false) {
    this.x = spawn.x + 4;
    this.big = keepPower ? this.big : false;
    this.h = this.big ? PLAYER_BIG_H : PLAYER_SMALL_H;
    this.y = spawn.y - (this.big ? PLAYER_BIG_H - PLAYER_SMALL_H : 0);
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.wasJump = false;
    this.invuln = 0;
  }

  grow() {
    if (this.big) return;
    this.big = true;
    this.y -= (PLAYER_BIG_H - PLAYER_SMALL_H);
    this.h = PLAYER_BIG_H;
  }

  // returns true if this hit is survivable (shrink), false if fatal (was small)
  shrink() {
    if (!this.big) return false;
    this.big = false;
    this.y += (PLAYER_BIG_H - PLAYER_SMALL_H);
    this.h = PLAYER_SMALL_H;
    this.invuln = INVULN_FRAMES;
    return true;
  }

  update(input, level) {
    if (this.invuln > 0) this.invuln -= 1;
    if (input.left) { this.vx -= MOVE_ACCEL; this.facing = -1; }
    if (input.right) { this.vx += MOVE_ACCEL; this.facing = 1; }
    if (!input.left && !input.right) this.vx *= FRICTION;
    this.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, this.vx));

    if (input.jump && this.onGround && !this.wasJump) this.vy = -JUMP_V;
    this.wasJump = input.jump;

    // extra gravity while rising without holding jump → shorter hop
    const g = (this.vy < 0 && !input.jump) ? GRAVITY * 2.4 : GRAVITY;
    this.vy += g;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;

    moveEntity(this, level);
  }
}

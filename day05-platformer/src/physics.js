// AABB vs solid-tile collision. Move on each axis then push out of any solid
// tile the entity's box overlaps. Entity speeds stay below one tile, so a
// single-tile check per edge is enough.

import { CELL } from './config.js';

export function isSolid(level, tx, ty) {
  if (tx < 0) return true;                 // left wall
  if (ty < 0) return false;                // open sky
  if (tx >= level.cols || ty >= level.rows) return false; // right / below open (fall)
  return level.solid[ty][tx];
}

export function moveEntity(e, level) {
  e.hitWall = false;

  e.x += e.vx;
  _resolveX(e, level);

  e.y += e.vy;
  e.onGround = false;
  _resolveY(e, level);
}

function _resolveX(e, level) {
  if (e.vx === 0) return;
  const y0 = Math.floor(e.y / CELL);
  const y1 = Math.floor((e.y + e.h - 1) / CELL);
  if (e.vx > 0) {
    const tx = Math.floor((e.x + e.w - 1) / CELL);
    for (let ty = y0; ty <= y1; ty += 1) {
      if (isSolid(level, tx, ty)) { e.x = tx * CELL - e.w; e.vx = 0; e.hitWall = true; return; }
    }
  } else {
    const tx = Math.floor(e.x / CELL);
    for (let ty = y0; ty <= y1; ty += 1) {
      if (isSolid(level, tx, ty)) { e.x = (tx + 1) * CELL; e.vx = 0; e.hitWall = true; return; }
    }
  }
}

function _resolveY(e, level) {
  const x0 = Math.floor(e.x / CELL);
  const x1 = Math.floor((e.x + e.w - 1) / CELL);
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h - 1) / CELL);
    for (let tx = x0; tx <= x1; tx += 1) {
      if (isSolid(level, tx, ty)) { e.y = ty * CELL - e.h; e.vy = 0; e.onGround = true; return; }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / CELL);
    for (let tx = x0; tx <= x1; tx += 1) {
      if (isSolid(level, tx, ty)) { e.y = (ty + 1) * CELL; e.vy = 0; return; }
    }
  }
}

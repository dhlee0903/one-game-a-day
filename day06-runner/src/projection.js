// Pure pseudo-3D projection helpers. Turns a (lane, distance) world point into
// screen-space (x, y) plus a scale factor. No state — used by the renderer.

import {
  VIEW_W, HORIZON_Y, GROUND_Y, CAM_DEPTH, ROAD_HALF, LANE_SPREAD,
} from './config.js';

const CENTER_X = VIEW_W / 2;

// Perspective factor for a distance d (>= 0): 1 at the camera, → 0 at horizon.
export function depthScale(d) {
  return CAM_DEPTH / (CAM_DEPTH + Math.max(0, d));
}

// Project a point given a continuous lane offset (may be fractional mid-switch)
// and a distance d. Returns screen x, y (ground contact) and scale.
export function project(laneX, d) {
  const t = depthScale(d);
  const y = HORIZON_Y + (GROUND_Y - HORIZON_Y) * t;
  const x = CENTER_X + laneX * LANE_SPREAD * ROAD_HALF * t;
  return { x, y, t };
}

export { CENTER_X };

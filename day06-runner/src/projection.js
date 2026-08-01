// Pure pseudo-3D projection helpers. Turns a (lane, distance) world point into
// screen-space (x, y) plus a scale factor. No state — used by the renderer.
// Handles small negative distances too, so objects can slide past the camera
// and off the bottom of the screen instead of vanishing at the edge.

import {
  VIEW_W, HORIZON_Y, GROUND_Y, CAM_DEPTH, ROAD_HALF, LANE_SPREAD,
} from './config.js';

const CENTER_X = VIEW_W / 2;

// Perspective factor for a distance d: 1 at the camera plane, → 0 at horizon,
// > 1 (object rushing past underneath) for d < 0. Denominator is clamped so it
// never blows up for the small negative range we draw.
export function depthScale(d) {
  return CAM_DEPTH / Math.max(1.4, CAM_DEPTH + d);
}

// Project a point given a continuous lane offset (may be fractional mid-switch)
// and a distance d. Returns screen x, y (ground contact) and scale t.
export function project(laneX, d) {
  const t = depthScale(d);
  const y = HORIZON_Y + (GROUND_Y - HORIZON_Y) * t;
  const x = CENTER_X + laneX * LANE_SPREAD * ROAD_HALF * t;
  return { x, y, t };
}

export { CENTER_X };

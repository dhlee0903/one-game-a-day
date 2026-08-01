// Runner constants — single source of truth. Tuning lives here.

export const VIEW_W = 480;
export const VIEW_H = 720;

// Pseudo-3D road projection.
export const HORIZON_Y = 220;   // where the road converges (sky/ground split)
export const GROUND_Y = 656;    // screen-y of the nearest point (d = 0)
export const CAM_DEPTH = 6;     // perspective focal depth
export const DRAW_DIST = 32;    // furthest distance an object is drawn at
export const PASS_D = -3.4;     // objects keep sliding past the camera until here
export const ROAD_HALF = 226;   // half road-width in px at the near edge
export const LANE_SPREAD = 0.6; // lane center as fraction of road half-width

// Lanes: left / center / right (world-x offsets).
export const LANES = [-1, 0, 1];

// Motion (per 1/60s step). Distance is in the same unit as DRAW_DIST.
export const START_SPEED = 0.185;
export const MAX_SPEED = 0.42;
export const SPEED_RAMP = 0.0000135; // speed gained per distance unit travelled

// Player action timing (frames). Both are kept BELOW ROW_FRAMES_MIN so an action
// always finishes before the next row arrives — you can never be stuck airborne
// when the next obstacle needs a slide, and vice-versa.
export const JUMP_FRAMES = 30;
export const JUMP_HEIGHT = 150;   // peak screen-px the player rises
export const SLIDE_FRAMES = 28;
export const LANE_LERP = 0.42;    // horizontal ease toward the target lane (snappy)

// Collision: an object hits when it is within HIT_DEPTH of the camera plane AND
// the player's *visual* lane position overlaps it by more than LANE_HIT.
export const HIT_DEPTH = 0.85;
// lane-units of centre-to-centre overlap that counts as a hit. Tuned to match
// the drawn obstacle half-width (~0.38) plus the player half-width (~0.17), so
// a hit registers right as the two visually touch — no phantom or missed hits.
export const LANE_HIT = 0.55;

// Spawning: rows are spaced by TIME (frames), not raw distance, so the gap in
// front of the player stays reactable no matter how fast the world scrolls.
export const ROW_FRAMES_START = 56;   // frames between rows early (~0.93s)
export const ROW_FRAMES_MIN = 40;     // tightest spacing (~0.67s) — still reactable
export const ROW_FRAMES_RAMP = 0.0015; // frames shaved per distance travelled

export const START_LIVES = 3;
export const INVULN_FRAMES = 72;
export const COIN_SCORE = 25;
export const DIST_SCORE = 2.2;    // score per distance unit

// Obstacle kinds.
export const OB = { BLOCK: 'block', LOW: 'low', HIGH: 'high', COIN: 'coin' };

export const BEST_KEY = 'day06-runner-best';

export const COLORS = {
  sky0: '#0a1330',
  sky1: '#1b2b57',
  sky2: '#5a4a86',
  sky3: '#e8794f',
  sky4: '#ffd0a0',
  hill: '#241a3a',
  hillFar: '#2f2350',
  ground: '#141d33',
  roadA: '#2b3550',
  roadB: '#323d5c',
  roadEdge: '#6a7bb0',
  roadEdgeGlow: '#9db0ff',
  laneLine: '#e9d38a',
  rail: '#3a4868',
  player: '#3fe0cf',
  playerDark: '#1f9f92',
  playerLight: '#8ff5ec',
  playerSkin: '#f4cda4',
  block: '#e0574f',
  blockDark: '#a23129',
  blockLight: '#ff8a7f',
  low: '#f4c430',
  lowDark: '#a67a12',
  high: '#9a7bf0',
  highDark: '#5f45b8',
  highLight: '#c4b0ff',
  coin: '#ffd23f',
  coinEdge: '#c98f00',
  coinShine: '#fff2b0',
  shadow: 'rgba(0,0,0,.32)',
  hud: '#eaf2ff',
  hudDim: '#9fb0cf',
  heart: '#ff5a6a',
};

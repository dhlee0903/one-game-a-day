// Runner constants — single source of truth. Tuning lives here.

export const VIEW_W = 480;
export const VIEW_H = 640;

// Pseudo-3D road projection.
export const HORIZON_Y = 172;   // where the road converges (sky/ground split)
export const GROUND_Y = 560;    // screen-y of the nearest point (d = 0)
export const CAM_DEPTH = 6;     // perspective focal depth
export const DRAW_DIST = 30;    // furthest distance an object is drawn at
export const ROAD_HALF = 210;   // half road-width in px at the near edge
export const LANE_SPREAD = 0.62; // lane center as fraction of road half-width

// Lanes: left / center / right.
export const LANES = [-1, 0, 1];

// Motion (per 1/60s step). Distance is in the same unit as DRAW_DIST.
export const START_SPEED = 0.185;
export const MAX_SPEED = 0.42;
export const SPEED_RAMP = 0.0000135; // speed gained per distance unit travelled

// Player action timing (frames).
export const JUMP_FRAMES = 40;
export const JUMP_HEIGHT = 118;   // peak screen-px the player rises
export const SLIDE_FRAMES = 36;
export const LANE_LERP = 0.28;    // horizontal ease toward the target lane

// The depth window (around d = 0) where an object collides with the player.
export const HIT_DEPTH = 0.9;

// Spawning: rows are spaced by TIME (frames), not raw distance, so the gap in
// front of the player stays reactable no matter how fast the world scrolls.
export const ROW_FRAMES_START = 52;   // frames between rows early (~0.87s)
export const ROW_FRAMES_MIN = 34;     // tightest spacing (~0.57s) — still reactable
export const ROW_FRAMES_RAMP = 0.0016; // frames shaved per distance travelled

export const START_LIVES = 3;
export const INVULN_FRAMES = 78;
export const COIN_SCORE = 25;
export const DIST_SCORE = 2.2;    // score per distance unit

// Obstacle kinds.
export const OB = { BLOCK: 'block', LOW: 'low', HIGH: 'high', COIN: 'coin' };

export const BEST_KEY = 'day06-runner-best';

export const COLORS = {
  sky1: '#12203a',
  sky2: '#2b4a7a',
  sky3: '#e88a5c',
  road: '#2a3346',
  roadEdge: '#3f4d6b',
  roadLine: '#f2c14e',
  rail: '#4a5a78',
  player: '#4ad0c0',
  playerDark: '#2a9f92',
  playerSkin: '#f2c9a0',
  block: '#e0574f',
  blockDark: '#a93a34',
  low: '#f2c14e',
  lowDark: '#b8892a',
  high: '#8a6fe0',
  highDark: '#5e46b0',
  coin: '#ffd23f',
  coinEdge: '#e0a800',
  shadow: 'rgba(0,0,0,.35)',
};

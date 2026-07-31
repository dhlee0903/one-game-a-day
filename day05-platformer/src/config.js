// Platformer constants — tuning lives here.

export const CELL = 32;
export const VIEW_W = 640; // 20 tiles
export const VIEW_H = 480; // 15 tiles

// Physics (per 1/60s step).
export const GRAVITY = 0.7;
export const MAX_FALL = 13;
export const MOVE_ACCEL = 0.65;
export const MAX_RUN = 4.6;
export const FRICTION = 0.8;
export const JUMP_V = 12.6;
export const JUMP_CUT = 0.45;   // released-jump short hop
export const STOMP_BOUNCE = 8.5;
export const ENEMY_SPEED = 1.1;

export const START_LIVES = 3;

export const COLORS = {
  sky1: '#8ed0ff',
  sky2: '#cdeeff',
  grass: '#5bbf4a',
  dirt: '#8a5a34',
  dirtDark: '#6f4527',
  brick: '#c1662f',
  brickLine: '#8f4a20',
  coin: '#ffd23f',
  coinEdge: '#e0a800',
  player: '#e8433f',
  playerDark: '#b52f2c',
  enemy: '#7a4a2a',
  enemyFoot: '#4d2f1a',
  flag: '#2fb344',
  pole: '#d8d8d8',
  eye: '#1a2230',
};

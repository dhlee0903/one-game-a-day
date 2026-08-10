// 입력 — 조작은 이동뿐이다(공격은 자동).
//   PC   : 방향키 / WASD, Esc·P 일시정지
//   모바일: 화면 아무 데나 눌러 끌면 그 자리에 가상 스틱이 생긴다

import { W, H } from './config.js';

const KEYS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};

const STICK_R = 30;      // 이 거리에서 최대 속도
const DEAD = 4;          // 손떨림 무시

export class InputController {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.held = new Set();
    this.pointerId = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        game.setPaused(!game.paused);
        e.preventDefault();
        return;
      }
      if (!KEYS[e.code]) return;
      this.held.add(e.code);
      this.sync();
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (!KEYS[e.code]) return;
      this.held.delete(e.code);
      this.sync();
    });
    window.addEventListener('blur', () => { this.held.clear(); this.sync(); });

    canvas.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const p = this.local(e);
      this.origin = p;
      game.stick = { x: p.x, y: p.y, dx: 0, dy: 0, on: true };
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      const p = this.local(e);
      let dx = p.x - this.origin.x;
      let dy = p.y - this.origin.y;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        // 스틱 밖으로 끌면 원점을 따라 옮긴다 — 손가락이 멀리 가도 방향이 살아 있게
        this.origin = { x: p.x - (dx / d) * STICK_R, y: p.y - (dy / d) * STICK_R };
        dx = (dx / d) * STICK_R;
        dy = (dy / d) * STICK_R;
      }
      game.stick = { x: this.origin.x, y: this.origin.y, dx, dy, on: true };
      this.sync();
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      game.stick = null;
      this.sync();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // CSS 크기와 무관하게 논리 해상도(W×H) 좌표로 바꾼다 — 스틱도 그 좌표계에 그린다
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }

  sync() {
    let dx = 0;
    let dy = 0;
    for (const code of this.held) {
      dx += KEYS[code][0];
      dy += KEYS[code][1];
    }
    const s = this.game.stick;
    if (s && s.on) {
      const d = Math.hypot(s.dx, s.dy);
      if (d > DEAD) {
        dx += (s.dx / STICK_R);
        dy += (s.dy / STICK_R);
      }
    }
    this.game.setMove(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
  }
}

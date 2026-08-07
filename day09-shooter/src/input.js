// 입력: 모바일은 화면 드래그(상대 이동, 손가락이 기체를 가리지 않는다) + 자동 발사,
// PC는 방향키/WASD. 폭탄은 하단 버튼 또는 Space/X.

import { W, H } from './config.js';

export class InputController {
  constructor(canvas, game, bombBtn) {
    this.game = game;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    // 캔버스 CSS 크기 → 논리 좌표 배율
    const scale = () => {
      const r = canvas.getBoundingClientRect();
      return { sx: W / r.width, sy: H / r.height };
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      game.resetDrag();   // 이전 플릭의 잔량을 버리고 새로 잡는다
      if (!game.paused) { game.start(); game.arm(); }  // 시작 화면에서 탭하면 바로 시작
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const { sx, sy } = scale();
      game.movePlayerBy((e.clientX - lastX) * sx, (e.clientY - lastY) * sy);
      lastX = e.clientX; lastY = e.clientY;
    });

    const end = (e) => {
      dragging = false;
      if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    if (bombBtn) {
      bombBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); game.useBomb(); });
    }

    const MAP = {
      ArrowLeft: 'l', a: 'l', A: 'l',
      ArrowRight: 'r', d: 'r', D: 'r',
      ArrowUp: 'u', w: 'u', W: 'u',
      ArrowDown: 'd', s: 'd', S: 'd',
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { game.togglePause(); e.preventDefault(); return; }
      if (e.key === ' ' || e.key === 'x' || e.key === 'X') { game.useBomb(); e.preventDefault(); return; }
      if (e.key === 'Enter') { game.start(); e.preventDefault(); return; }
      const k = MAP[e.key];
      if (k) { game.setKey(k, true); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = MAP[e.key];
      if (k) { game.setKey(k, false); e.preventDefault(); }
    });
  }
}

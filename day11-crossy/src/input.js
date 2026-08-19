// 키보드 + 터치. 탭은 앞으로, 스와이프는 그 방향으로.

const SWIPE = 22;      // 이만큼 끌면 스와이프로 본다(px)
const TAP_TIME = 400;  // 이 안에 떼면 탭

export class Input {
  constructor(el, game, onFirst, onStart) {
    this.el = el;
    this.game = game;
    this.onFirst = onFirst || (() => {});
    this.onStart = onStart || (() => {});
    this.sx = 0; this.sy = 0; this.st = 0; this.down = false; this.fired = false;

    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    window.addEventListener('keydown', this.onKey);
  }

  send(dir) {
    this.onFirst();
    this.game.move(dir);
  }

  onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    this.onFirst();
    // 결과 화면에서는 아무 버튼이나 누르면 다시 시작한다.
    if (this.game.state === 'over') { e.preventDefault(); this.game.anyKey(); return; }
    if (this.game.state === 'title') {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); this.onStart(); }
      return;
    }
    let dir = null;
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') dir = 'fwd';
    else if (k === 'ArrowDown' || k === 's' || k === 'S') dir = 'back';
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') dir = 'left';
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') dir = 'right';
    if (!dir) return;
    e.preventDefault();
    this.send(dir);
  };

  onDown = (e) => {
    e.preventDefault();
    this.down = true; this.fired = false;
    this.sx = e.clientX; this.sy = e.clientY; this.st = performance.now();
    this.el.setPointerCapture?.(e.pointerId);
  };

  onMove = (e) => {
    if (!this.down || this.fired) return;
    const dx = e.clientX - this.sx;
    const dy = e.clientY - this.sy;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
    this.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) this.send(dx > 0 ? 'right' : 'left');
    else this.send(dy > 0 ? 'back' : 'fwd');
  };

  onUp = (e) => {
    if (!this.down) return;
    this.down = false;
    if (this.fired) return;
    if (performance.now() - this.st < TAP_TIME) this.send('fwd');
    this.el.releasePointerCapture?.(e.pointerId);
  };
}

// Keyboard (arrows / WASD) plus swipe gestures on the play surface. On touch
// devices swiping is the only control — and it never scrolls the page, because
// every touch on the surface is preventDefault-ed.

export class InputController {
  constructor(state, { onStartKey } = {}) {
    this.state = state;

    const set = (key, down) => {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') state.left = down;
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') state.right = down;
      else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') state.up = down;
      else if (key === 'ArrowDown' || key === 's' || key === 'S') state.down = down;
    };

    window.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && onStartKey) onStartKey();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      set(e.key, true);
    });
    window.addEventListener('keyup', (e) => set(e.key, false));
  }

  // Swipe on the surface → one directional tap. Taps (no movement) start/restart.
  bindSwipe(surface, { onStartKey } = {}) {
    let sx = 0; let sy = 0; let active = false;
    const TH = 24; // min px for a swipe

    const fire = (prop) => {
      this.state[prop] = true;
      // released next frame; the game edge-detects the rising edge as one tap
      setTimeout(() => { this.state[prop] = false; }, 70);
    };

    const start = (x, y) => { sx = x; sy = y; active = true; };
    const end = (x, y) => {
      if (!active) return;
      active = false;
      const dx = x - sx; const dy = y - sy;
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) { if (onStartKey) onStartKey(); return; }
      if (Math.abs(dx) > Math.abs(dy)) fire(dx > 0 ? 'right' : 'left');
      else fire(dy > 0 ? 'down' : 'up');
    };

    // Touch: swallow every touch event so the page never scrolls or bounces.
    surface.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; start(t.clientX, t.clientY);
    }, { passive: false });
    surface.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    surface.addEventListener('touchend', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0]; end(t.clientX, t.clientY);
    }, { passive: false });
    surface.addEventListener('touchcancel', () => { active = false; });

    // Mouse: drag to swipe (desktop convenience / testing).
    surface.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
    surface.addEventListener('mouseup', (e) => end(e.clientX, e.clientY));
  }
}

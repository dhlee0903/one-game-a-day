// Keyboard (arrows / WASD), on-screen buttons, and swipe gestures → the shared
// input state the game samples each step (edge-detected there for taps).

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

  bindTouch(els) {
    const tap = (el, prop) => {
      const on = (e) => { e.preventDefault(); this.state[prop] = true; };
      const off = (e) => { e.preventDefault(); this.state[prop] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    if (els.left) tap(els.left, 'left');
    if (els.right) tap(els.right, 'right');
    if (els.up) tap(els.up, 'up');
    if (els.down) tap(els.down, 'down');
  }

  // Swipe on the play surface: flick direction maps to one tap.
  bindSwipe(surface, { onStartKey } = {}) {
    let sx = 0; let sy = 0; let active = false;
    const TH = 26; // min px for a swipe

    const fire = (prop) => {
      this.state[prop] = true;
      setTimeout(() => { this.state[prop] = false; }, 60);
    };

    const start = (x, y) => { sx = x; sy = y; active = true; };
    const end = (x, y) => {
      if (!active) return;
      active = false;
      const dx = x - sx; const dy = y - sy;
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) {
        if (onStartKey) onStartKey();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) fire(dx > 0 ? 'right' : 'left');
      else fire(dy > 0 ? 'down' : 'up');
    };

    surface.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; start(t.clientX, t.clientY);
    }, { passive: true });
    surface.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]; end(t.clientX, t.clientY);
    });
    surface.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
    surface.addEventListener('mouseup', (e) => end(e.clientX, e.clientY));
  }
}

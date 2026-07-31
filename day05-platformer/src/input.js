// Keyboard (arrows / WASD / space) and touch buttons → a shared input state
// object the game reads each step.

export class InputController {
  constructor(state, { onStartKey } = {}) {
    this.state = state;

    const set = (key, down) => {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') state.left = down;
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') state.right = down;
      else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') state.jump = down;
    };

    window.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && onStartKey) onStartKey();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
      set(e.key, true);
    });
    window.addEventListener('keyup', (e) => set(e.key, false));
  }

  bindTouch(els) {
    const hold = (el, prop) => {
      const on = (e) => { e.preventDefault(); this.state[prop] = true; };
      const off = (e) => { e.preventDefault(); this.state[prop] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    if (els.left) hold(els.left, 'left');
    if (els.right) hold(els.right, 'right');
    if (els.jump) hold(els.jump, 'jump');
  }
}

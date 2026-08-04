// 입력 처리: 키패드 탭(포인터)과 물리 키보드를 게임 동작으로 옮긴다.

export class InputController {
  constructor(game, { keypad, ok, del, clear, hint }) {
    this.game = game;

    // 키패드 — 포인터로 통일(모바일 탭 지연·중복 방지)
    keypad.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button[data-digit]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      game.pressDigit(btn.dataset.digit);
    });

    const tap = (el, fn) => el && el.addEventListener('pointerdown', (e) => {
      if (el.disabled) return;
      e.preventDefault();
      fn();
    });
    tap(ok, () => game.submit());
    tap(del, () => game.backspace());
    tap(clear, () => game.clearInput());
    tap(hint, () => game.useHint());

    // 키보드 — 숫자/백스페이스/엔터/ESC
    this._onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') { game.pressDigit(e.key); e.preventDefault(); return; }
      if (e.key === 'Backspace') { game.backspace(); e.preventDefault(); return; }
      if (e.key === 'Enter') { game.submit(); e.preventDefault(); return; }
      if (e.key === 'Escape') { game.clearInput(); e.preventDefault(); }
    };
    window.addEventListener('keydown', this._onKey);
  }
}

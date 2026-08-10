// 애니메이션 제어 — 스프라이트시트의 프레임 이름을 순서대로 넘겨준다.
// 로직이 초당 60스텝으로 고정돼 있으므로 클립은 "프레임당 몇 스텝"으로 적는다.

// hold: 한 프레임을 몇 스텝 유지할지. loop: 마지막에서 되돌아갈지.
export const CLIPS = {
  'wizard.idle': { frames: ['wizard.idle0', 'wizard.idle1'], hold: 26, loop: true },
  'wizard.walk': { frames: ['wizard.walk0', 'wizard.walk1', 'wizard.walk2', 'wizard.walk3'], hold: 7, loop: true },

  bat: { frames: ['bat.0', 'bat.1'], hold: 5, loop: true },
  slime: { frames: ['slime.0', 'slime.1'], hold: 14, loop: true },
  skeleton: { frames: ['skeleton.0', 'skeleton.1'], hold: 11, loop: true },
  ghost: { frames: ['ghost.0', 'ghost.1'], hold: 18, loop: true },
  golem: { frames: ['golem.0', 'golem.1'], hold: 16, loop: true },
  lich: { frames: ['lich.0', 'lich.1'], hold: 20, loop: true },

  bolt: { frames: ['bolt.0', 'bolt.1'], hold: 4, loop: true },
  rune: { frames: ['rune.0', 'rune.1'], hold: 6, loop: true },
  zap: { frames: ['zap.0', 'zap.1'], hold: 3, loop: true },
  flame: { frames: ['flame.0', 'flame.1', 'flame.2'], hold: 6, loop: true },
};

export class Animator {
  constructor(clip, offset = 0) {
    this.set(clip, offset);
  }

  // 같은 클립을 다시 넣어도 처음부터 돌지 않는다(걷다 서다 반복할 때 튀지 않게)
  set(clip, offset = 0) {
    if (this.name === clip) return;
    this.name = clip;
    this.t = offset;
    this.done = false;
  }

  step(n = 1) {
    this.t += n;
    const c = CLIPS[this.name];
    if (!c.loop && this.t >= c.hold * c.frames.length) this.done = true;
  }

  frame() {
    const c = CLIPS[this.name];
    const i = Math.floor(this.t / c.hold);
    if (c.loop) return c.frames[i % c.frames.length];
    return c.frames[Math.min(i, c.frames.length - 1)];
  }
}

// 개체마다 Animator를 만들지 않아도 되는 경우(적 수백 마리) 쓰는 순수 함수.
// 개체는 자기 나이(프레임 수)만 갖고 있으면 된다.
export function frameAt(clip, t) {
  const c = CLIPS[clip];
  return c.frames[Math.floor(t / c.hold) % c.frames.length];
}

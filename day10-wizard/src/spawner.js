// 소환 — 시간이 곧 난이도다. 화면 바깥 테두리에서 밀려 들어온다.
//
// PHASES: 시간대별 적 구성과 소환 간격. 지난 구간 중 가장 마지막 것이 적용된다.
// EVENTS: 정해진 시각에 한 번만 터지는 사건(포위 · 엘리트 · 보스).

import { W, H, MAX_ENEMIES } from './config.js';

const S = (sec) => sec * 60;   // 초 → 스텝

export const PHASES = [
  { at: S(0), kinds: [['bat', 1]], every: 46, burst: 1 },
  { at: S(40), kinds: [['bat', 4], ['slime', 1]], every: 36, burst: 1 },
  { at: S(90), kinds: [['bat', 3], ['slime', 3]], every: 30, burst: 2 },
  { at: S(150), kinds: [['bat', 3], ['slime', 3], ['skeleton', 2]], every: 26, burst: 2 },
  { at: S(230), kinds: [['bat', 2], ['slime', 3], ['skeleton', 4]], every: 24, burst: 2 },
  { at: S(330), kinds: [['bat', 2], ['slime', 2], ['skeleton', 4], ['ghost', 2]], every: 22, burst: 3 },
  { at: S(430), kinds: [['slime', 2], ['skeleton', 4], ['ghost', 4]], every: 20, burst: 3 },
  { at: S(540), kinds: [['bat', 3], ['skeleton', 3], ['ghost', 5]], every: 18, burst: 3 },
  { at: S(660), kinds: [['bat', 4], ['skeleton', 4], ['ghost', 5]], every: 16, burst: 4 },
  { at: S(780), kinds: [['bat', 5], ['skeleton', 4], ['ghost', 6]], every: 14, burst: 4 },
];

export const EVENTS = [
  { at: S(75), type: 'ring', kind: 'bat', n: 18 },
  { at: S(140), type: 'line', kind: 'slime', n: 14 },
  { at: S(200), type: 'elite', kind: 'golem', n: 1 },
  { at: S(260), type: 'ring', kind: 'skeleton', n: 22 },
  { at: S(300), type: 'boss', kind: 'lich' },
  { at: S(380), type: 'elite', kind: 'golem', n: 2 },
  { at: S(440), type: 'line', kind: 'ghost', n: 16 },
  { at: S(500), type: 'ring', kind: 'skeleton', n: 26 },
  { at: S(560), type: 'elite', kind: 'golem', n: 2 },
  { at: S(600), type: 'boss', kind: 'lich' },
  { at: S(680), type: 'ring', kind: 'ghost', n: 24 },
  { at: S(740), type: 'elite', kind: 'golem', n: 3 },
  { at: S(800), type: 'line', kind: 'skeleton', n: 24 },
  { at: S(860), type: 'boss', kind: 'lich' },
];

export class Spawner {
  constructor() {
    this.reset();
  }

  reset() {
    this.cd = 30;
    this.nextEvent = 0;
    this.phase = PHASES[0];
  }

  update(g) {
    // 현재 구간 갱신
    for (let i = PHASES.length - 1; i >= 0; i -= 1) {
      if (g.t >= PHASES[i].at) { this.phase = PHASES[i]; break; }
    }

    while (this.nextEvent < EVENTS.length && g.t >= EVENTS[this.nextEvent].at) {
      this.runEvent(g, EVENTS[this.nextEvent]);
      this.nextEvent += 1;
    }

    if (g.enemies.length >= MAX_ENEMIES) return;
    this.cd -= 1;
    if (this.cd > 0) return;
    this.cd = this.phase.every;
    for (let i = 0; i < this.phase.burst; i += 1) {
      g.spawn(this.pick(g), this.edgePoint(g));
    }
  }

  pick(g) {
    const kinds = this.phase.kinds;
    let total = 0;
    for (const [, wgt] of kinds) total += wgt;
    let r = g.rnd() * total;
    for (const [kind, wgt] of kinds) {
      r -= wgt;
      if (r <= 0) return kind;
    }
    return kinds[0][0];
  }

  // 화면 밖 테두리 한 점 — 어느 변에서 들어올지는 둘레 길이에 비례해 고른다.
  // 다만 **가는 쪽에 더 많이** 세운다. 그러지 않으면 한 방향으로 계속 달아나는 것만으로
  // 무한히 안전해진다(적이 뒤로 늘어서기만 한다).
  edgePoint(g) {
    const m = 26;
    const halfW = W / 2 + m;
    const halfH = H / 2 + m;
    const per = (halfW + halfH) * 2;
    let r = g.rnd() * per;
    let dx;
    let dy;
    if (r < halfW * 2) { dx = r - halfW; dy = g.rnd() < 0.5 ? -halfH : halfH; } else {
      r -= halfW * 2;
      dy = r - halfH;
      dx = g.rnd() < 0.5 ? -halfW : halfW;
    }
    const mx = g.inx || 0;
    const my = g.iny || 0;
    if ((mx || my) && g.rnd() < 0.6) {
      // 진행 방향과 반대쪽에 걸렸으면 그 축을 뒤집어 앞쪽으로 옮긴다
      if (mx && Math.sign(dx) !== Math.sign(mx) && Math.abs(dx) > halfW * 0.4) dx = -dx;
      if (my && Math.sign(dy) !== Math.sign(my) && Math.abs(dy) > halfH * 0.4) dy = -dy;
    }
    return { x: g.px + dx, y: g.py + dy };
  }

  runEvent(g, ev) {
    if (ev.type === 'boss') {
      const p = this.edgePoint(g);
      g.spawn(ev.kind, p);
      g.banner('보스 등장', 150);
      g.shake = Math.max(g.shake, 8);
      return;
    }
    if (ev.type === 'elite') {
      for (let i = 0; i < ev.n; i += 1) g.spawn(ev.kind, this.edgePoint(g));
      g.banner('엘리트 출현', 100);
      return;
    }
    if (ev.type === 'ring') {
      const rad = Math.max(W, H) * 0.62;
      for (let i = 0; i < ev.n; i += 1) {
        const a = (i / ev.n) * Math.PI * 2;
        g.spawn(ev.kind, { x: g.px + Math.cos(a) * rad, y: g.py + Math.sin(a) * rad });
      }
      g.banner('포위', 90);
      return;
    }
    if (ev.type === 'line') {
      // 한 변에서 줄지어 밀려온다
      const side = g.rnd() < 0.5 ? -1 : 1;
      const vertical = g.rnd() < 0.5;
      for (let i = 0; i < ev.n; i += 1) {
        const off = (i - ev.n / 2) * 16;
        const p = vertical
          ? { x: g.px + off, y: g.py + side * (H / 2 + 30 + (i % 3) * 14) }
          : { x: g.px + side * (W / 2 + 30 + (i % 3) * 14), y: g.py + off };
        g.spawn(ev.kind, p);
      }
      g.banner('무리', 90);
    }
  }
}

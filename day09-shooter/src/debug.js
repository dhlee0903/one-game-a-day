// PC 전용 디버그 콘솔 — 백틱(`)으로 열고 닫는다.
// 마우스가 있는 환경에서만 DOM을 만든다. 모바일에서는 아예 붙지 않으므로
// 화면을 가리거나 터치를 가로챌 일이 없다.
//
// 게임 상태를 읽어 보여주고, 디버그용으로 몇 가지를 직접 건드린다.
// (게임 쪽에 남긴 훅은 game.debugInvul / renderer.showHitbox / clock.scale 셋뿐)

import { STAGES } from './waves.js';
import { MAX_POWER } from './config.js';

const isDesktop = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/**
 * @param game     Game 인스턴스
 * @param renderer Renderer 인스턴스(히트박스 표시 토글용)
 * @param clock    { scale, fps, ms } — main.js의 루프가 채우고 읽는다
 * @returns { update() } 또는 null(모바일)
 */
export function attachDebug({ game, renderer, clock }) {
  if (!isDesktop()) return null;

  const root = el('div', 'dbg');
  root.hidden = true;

  const head = el('div', 'dbg-head');
  head.append(el('span', null, 'DEBUG'), el('span', 'dbg-key', '` 로 닫기'));
  root.append(head);

  const stats = el('pre', 'dbg-stats');
  root.append(stats);

  // ---- 토글 ----
  const toggles = el('div', 'dbg-row');
  const state = { invul: false, hitbox: false, slow: false, freeze: false };
  const mkToggle = (label, key, apply) => {
    const b = el('button', 'dbg-btn', label);
    b.addEventListener('click', () => {
      state[key] = !state[key];
      b.classList.toggle('on', state[key]);
      apply(state[key]);
      b.blur();                      // 포커스가 남으면 Space가 폭탄 대신 이 버튼을 누른다
    });
    toggles.append(b);
  };
  mkToggle('무적', 'invul', (v) => { game.debugInvul = v; });
  mkToggle('히트박스', 'hitbox', (v) => { renderer.showHitbox = v; });
  mkToggle('슬로우', 'slow', (v) => { clock.scale = v ? 0.25 : 1; });
  mkToggle('정지', 'freeze', (v) => { clock.scale = v ? 0 : (state.slow ? 0.25 : 1); });
  root.append(toggles);

  // ---- 동작 ----
  const mkRow = (...pairs) => {
    const row = el('div', 'dbg-row');
    for (const [label, fn] of pairs) {
      const b = el('button', 'dbg-btn', label);
      b.addEventListener('click', () => { fn(); b.blur(); });
      row.append(b);
    }
    root.append(row);
  };

  const jump = (i) => {
    if (game.phase !== 'playing') game.start();
    game.stageIdx = i;
    game._enterStage(i);
  };
  mkRow(...STAGES.map((s, i) => [`ST${i + 1}`, () => jump(i)]));
  mkRow(
    ['보스', () => { game.arm(); if (!game.boss) game._spawnBoss(); }],
    ['전멸', () => { for (const e of game.enemies) game._hurt(e, 9999); }],
    ['탄 지움', () => { game.eb.length = 0; }],
  );
  mkRow(
    ['PWR MAX', () => { game.power = MAX_POWER; game.options = 2; game._emit(); }],
    ['BOMB+', () => { game.bombs += 1; game._emit(); }],
    ['LIFE+', () => { game.lives += 1; game._emit(); }],
  );
  mkRow(
    ['죽어보기', () => game._die()],
    ['새 판', () => { game.reset(); game.start(); }],
  );

  document.body.append(root);

  window.addEventListener('keydown', (e) => {
    if (e.key !== '`' && e.code !== 'Backquote') return;
    root.hidden = !root.hidden;
    e.preventDefault();
  });

  const pct = (a, b) => `${Math.round((a / b) * 100)}%`;

  function update() {
    if (root.hidden) return;
    const p = game.player;
    const b = game.boss;
    stats.textContent = [
      `FPS   ${clock.fps.toString().padStart(3)}   ${clock.ms.toFixed(1)}ms  x${clock.scale}`,
      `STAGE ${game.stageIdx + 1} ${game.stage.name}`,
      `t ${String(game.t).padStart(5)}  gen ${game.stageGen}  wave ${game.waveIdx}/${game.stage.timeline.length}`,
      `${game.phase}${game.armed ? '' : ' · 대기'}${game.paused ? ' · 일시정지' : ''}`,
      '',
      `적 ${game.enemies.length}  내탄 ${game.pb.length}  적탄 ${game.eb.length}`,
      `아이템 ${game.pickups.length}  폭발 ${game.fx.length}`,
      '',
      `좌표 ${Math.round(p.x)}, ${Math.round(p.y)}   기울기 ${p.bank.toFixed(1)}`,
      `PWR ${game.power}+${game.options}  목숨 ${game.lives}  폭탄 ${game.bombs}`,
      `무적 ${p.invul}  격추 ${p.dead}  진입 ${p.enter}`,
      `점수 ${game.score}  최고 ${game.best}`,
      '',
      b ? `보스 ${Math.ceil(b.hp)}/${b.maxHp} (${pct(b.hp, b.maxHp)}) ${b.state} 패턴${b.pattern}` : '보스 —',
    ].join('\n');
  }

  return { update };
}

// 최고 기록·코인·고른 캐릭터를 localStorage에 담아 둔다.

const BEST = 'og-hs-day11';   // 홈 화면이 읽는 키
const COINS = 'day11-coins';
const CHAR = 'day11-char';
const OPTS = 'day11-opts';

const num = (k) => {
  try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; }
};
const put = (k, v) => {
  try { localStorage.setItem(k, String(v)); } catch { /* 저장 못 해도 게임은 돈다 */ }
};

export const store = {
  best: () => num(BEST),
  saveBest(score) {
    const b = Math.max(num(BEST), score || 0);
    put(BEST, b);
    return b;
  },
  coins: () => num(COINS),
  addCoins(n) {
    const t = num(COINS) + (n || 0);
    put(COINS, t);
    return t;
  },
  spend(n) {
    const t = num(COINS);
    if (t < n) return false;
    put(COINS, t - n);
    return true;
  },
  char: () => num(CHAR),
  saveChar(i) { put(CHAR, i); },
  owned() {
    try { return JSON.parse(localStorage.getItem('day11-owned') || '[0]'); } catch { return [0]; }
  },
  addOwned(i) {
    const o = store.owned();
    if (!o.includes(i)) o.push(i);
    try { localStorage.setItem('day11-owned', JSON.stringify(o)); } catch { /* ignore */ }
    return o;
  },
  opts() {
    try { return { sfx: true, ...JSON.parse(localStorage.getItem(OPTS) || '{}') }; } catch { return { sfx: true }; }
  },
  saveOpts(o) {
    try { localStorage.setItem(OPTS, JSON.stringify(o)); } catch { /* ignore */ }
  },
};

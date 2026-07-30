// Chip balance persistence via localStorage. Fails soft.

import { START_CHIPS } from './config.js';

const KEY = 'cards-chips';

export function getChips() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? START_CHIPS : Number(raw);
  } catch {
    return START_CHIPS;
  }
}

export function setChips(n) {
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
}

// Persistent stats via localStorage: the best total ever reached and the
// win/loss/tie record against the bot. Fails soft if storage is unavailable.

const KEY = 'yacht-dice-stats';

const defaults = () => ({ best: 0, bot: { w: 0, l: 0, t: 0 } });

export function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) return defaults();
    return { best: raw.best || 0, bot: { w: 0, l: 0, t: 0, ...raw.bot } };
  } catch {
    return defaults();
  }
}

// Fold a finished game into the stats. Returns { isNewBest, stats }.
export function recordGame(result) {
  const stats = getStats();
  const topTotal = Math.max(...result.players.map((p) => p.total));
  const isNewBest = topTotal > stats.best;
  if (isNewBest) stats.best = topTotal;

  // vs-bot record is tracked from the human's point of view.
  if (result.players.some((p) => p.isBot)) {
    if (result.winner === 'tie') stats.bot.t += 1;
    else if (result.players[result.winner].isBot) stats.bot.l += 1; // bot won → human lost
    else stats.bot.w += 1;
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch { /* storage full or blocked — keep the in-memory value */ }

  return { isNewBest, stats };
}

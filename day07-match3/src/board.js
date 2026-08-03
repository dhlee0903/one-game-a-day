// Board model: the gem grid plus all match-3 logic — match detection (lines of
// 3+, 2x2 squares), the shape→special mapping, gravity and refill, and a
// has-moves / reshuffle guard. Pure logic; it never draws. Gems carry render
// fields (x, y, tx, ty) that the game tweens and the renderer reads.

import { COLS, ROWS, NUM_COLORS, SP, COLOR_GEM } from './config.js';

let GID = 0;

export class Board {
  constructor() {
    this.grid = [];
    this.colorCount = NUM_COLORS; // active monster types (raised per stage)
    this.reset();
  }

  key(r, c) { return r * COLS + c; }

  inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  at(r, c) { return this.inBounds(r, c) ? this.grid[r][c] : null; }

  randColor() { return Math.floor(Math.random() * this.colorCount); }

  // Find one adjacent swap that would make a match (for the idle hint). null if
  // none (the caller reshuffles).
  findMove() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const nr = r + dr; const nc = c + dc;
          if (!this.inBounds(nr, nc)) continue;
          this.swap({ r, c }, { r: nr, c: nc });
          const has = this.detect(null).matched.size > 0;
          this.swap({ r, c }, { r: nr, c: nc });
          if (has) return { a: { r, c }, b: { r: nr, c: nc } };
        }
      }
    }
    return null;
  }

  makeGem(color, special = SP.NONE) {
    return {
      id: (GID += 1), color, special, x: null, y: null, tx: 0, ty: 0, isNew: false,
    };
  }

  reset() {
    do { this._fill(); } while (!this.hasMoves());
  }

  // Fill with no pre-existing line-of-3 so play starts from a settled board.
  _fill() {
    this.grid = [];
    for (let r = 0; r < ROWS; r += 1) {
      const row = [];
      for (let c = 0; c < COLS; c += 1) {
        let color;
        do {
          color = this.randColor();
        } while (
          (c >= 2 && row[c - 1].color === color && row[c - 2].color === color)
          || (r >= 2 && this.grid[r - 1][c].color === color && this.grid[r - 2][c].color === color)
        );
        row.push(this.makeGem(color));
      }
      this.grid.push(row);
    }
  }

  swap(a, b) {
    const t = this.grid[a.r][a.c];
    this.grid[a.r][a.c] = this.grid[b.r][b.c];
    this.grid[b.r][b.c] = t;
  }

  // ---- match detection ----

  // Returns { matched:Set(cellKey), specials:Map(cellKey→{type,color}) }.
  // lastSwap (array of {r,c}) biases where a created special is anchored.
  detect(lastSwap) {
    const matched = new Set();
    const runs = [];

    // horizontal runs
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      while (c < COLS) {
        const g = this.grid[r][c];
        if (!g) { c += 1; continue; }
        let e = c;
        while (e + 1 < COLS && this.grid[r][e + 1] && this.grid[r][e + 1].color === g.color) e += 1;
        const len = e - c + 1;
        if (len >= 3) runs.push({ dir: 'h', r, c, len });
        c = e + 1;
      }
    }
    // vertical runs
    for (let c = 0; c < COLS; c += 1) {
      let r = 0;
      while (r < ROWS) {
        const g = this.grid[r][c];
        if (!g) { r += 1; continue; }
        let e = r;
        while (e + 1 < ROWS && this.grid[e + 1][c] && this.grid[e + 1][c].color === g.color) e += 1;
        const len = e - r + 1;
        if (len >= 3) runs.push({ dir: 'v', r, c, len });
        r = e + 1;
      }
    }

    const runCells = (run) => {
      const cells = [];
      for (let i = 0; i < run.len; i += 1) {
        cells.push(run.dir === 'h' ? { r: run.r, c: run.c + i } : { r: run.r + i, c: run.c });
      }
      return cells;
    };

    // 2x2 squares (a valid match on their own in this game)
    const squares = [];
    for (let r = 0; r < ROWS - 1; r += 1) {
      for (let c = 0; c < COLS - 1; c += 1) {
        const g = this.grid[r][c];
        if (!g) continue;
        const col = g.color;
        if (this.grid[r][c + 1] && this.grid[r][c + 1].color === col
          && this.grid[r + 1][c] && this.grid[r + 1][c].color === col
          && this.grid[r + 1][c + 1] && this.grid[r + 1][c + 1].color === col) {
          squares.push({ r, c, color: col });
        }
      }
    }

    // track which cells belong to horizontal vs vertical runs, to find the
    // ㄱ자(L/T) intersections where an h-run meets a v-run
    const hset = new Set(); const vset = new Set();
    for (const run of runs) {
      for (const cell of runCells(run)) {
        const k = this.key(cell.r, cell.c);
        matched.add(k);
        (run.dir === 'h' ? hset : vset).add(k);
      }
    }
    for (const sq of squares) {
      matched.add(this.key(sq.r, sq.c)); matched.add(this.key(sq.r, sq.c + 1));
      matched.add(this.key(sq.r + 1, sq.c)); matched.add(this.key(sq.r + 1, sq.c + 1));
    }

    // decide specials (higher priority wins on a shared anchor cell)
    const specials = new Map();
    const consider = (r, c, type, color, pri) => {
      const k = this.key(r, c);
      const cur = specials.get(k);
      if (!cur || cur.pri < pri) specials.set(k, { type, color, pri });
    };
    const isSwap = (r, c) => lastSwap && lastSwap.some((s) => s.r === r && s.c === c);
    const anchor = (cells) => cells.find((p) => isSwap(p.r, p.c)) || cells[Math.floor(cells.length / 2)];

    for (const run of runs) {
      const cells = runCells(run);
      if (run.len >= 5) { const a = anchor(cells); consider(a.r, a.c, SP.COLOR, COLOR_GEM, 4); } else if (run.len === 4) {
        const a = anchor(cells);
        consider(a.r, a.c, run.dir === 'h' ? SP.ROW : SP.COL, this.grid[a.r][a.c].color, 2);
      }
    }
    for (const sq of squares) {
      const cells = [
        { r: sq.r, c: sq.c }, { r: sq.r, c: sq.c + 1 },
        { r: sq.r + 1, c: sq.c }, { r: sq.r + 1, c: sq.c + 1 },
      ];
      const a = anchor(cells);
      consider(a.r, a.c, SP.BOMB, sq.color, 3);
    }

    // ㄱ자(L/T): a cell in both an h-run and a v-run → bomb at the corner
    for (const k of hset) {
      if (!vset.has(k)) continue;
      const r = Math.floor(k / COLS); const c = k % COLS;
      const g = this.grid[r][c];
      consider(r, c, SP.BOMB, g ? g.color : 0, 3);
    }

    return { matched, specials };
  }

  // Cells a special clears when it detonates (does not recurse; the game chains).
  effectCells(r, c, gem) {
    const out = [];
    if (gem.special === SP.ROW) { for (let cc = 0; cc < COLS; cc += 1) out.push({ r, c: cc }); } else if (gem.special === SP.COL) { for (let rr = 0; rr < ROWS; rr += 1) out.push({ r: rr, c }); } else if (gem.special === SP.BOMB) {
      for (let rr = r - 1; rr <= r + 1; rr += 1) for (let cc = c - 1; cc <= c + 1; cc += 1) if (this.inBounds(rr, cc)) out.push({ r: rr, c: cc });
    } else if (gem.special === SP.COLOR) {
      const color = this._commonColor();
      for (let rr = 0; rr < ROWS; rr += 1) for (let cc = 0; cc < COLS; cc += 1) {
        const g = this.grid[rr][cc]; if (g && g.color === color) out.push({ r: rr, c: cc });
      }
    }
    return out;
  }

  // All cells of a given colour (used when a COLOR block is swapped with a gem).
  cellsOfColor(color) {
    const out = [];
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.grid[r][c]; if (g && g.color === color) out.push({ r, c });
    }
    return out;
  }

  _commonColor() {
    const count = new Array(NUM_COLORS).fill(0);
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.grid[r][c]; if (g && g.color >= 0) count[g.color] += 1;
    }
    let best = 0;
    for (let i = 1; i < NUM_COLORS; i += 1) if (count[i] > count[best]) best = i;
    return best;
  }

  // ---- gravity / refill ----

  // Collapse each column downward, then create new gems (isNew) at the top.
  applyGravity() {
    for (let c = 0; c < COLS; c += 1) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r -= 1) {
        if (this.grid[r][c]) {
          this.grid[write][c] = this.grid[r][c];
          if (write !== r) this.grid[r][c] = null;
          write -= 1;
        }
      }
      for (let r = write; r >= 0; r -= 1) {
        const gem = this.makeGem(this.randColor());
        gem.isNew = true;
        this.grid[r][c] = gem;
      }
    }
  }

  // ---- move guard ----

  hasMoves() {
    // any adjacent swap that yields a match, or any COLOR block present
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
      const g = this.grid[r][c];
      if (g && g.special === SP.COLOR) return true;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr; const nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        this.swap({ r, c }, { r: nr, c: nc });
        const has = this.detect(null).matched.size > 0;
        this.swap({ r, c }, { r: nr, c: nc });
        if (has) return true;
      }
    }
    return false;
  }

  reshuffle() {
    do {
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
        const g = this.grid[r][c];
        if (g && g.special === SP.NONE) g.color = this.randColor();
      }
    } while (this.detect(null).matched.size > 0 || !this.hasMoves());
  }
}

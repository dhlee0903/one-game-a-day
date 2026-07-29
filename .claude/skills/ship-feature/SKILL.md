---
name: ship-feature
description: >
  Implement one game feature end-to-end in the "하루에 게임 1개씩" repo — code it in
  the vanilla ES-module pattern, verify it in a real browser, update the DEVLOG, commit
  it feature-scoped, and deploy to GitHub Pages. Use this whenever the user wants to
  build/add/finish a feature for any dayNN game (e.g. "홀드 기능 만들어", "add a high-score
  board", "SRS 월킥 구현하고 배포까지"), or asks to ship/deploy a game change. Covers the
  whole implement → test → deploy loop, not just the coding.
---

# Ship a game feature

This repo builds one small web game per day (`dayNN-<name>/`), pure vanilla JS, and
deploys via GitHub Pages. This skill captures the proven loop for taking a single feature
from idea to live site. Read `CLAUDE.md` at the repo root first — it holds the commit and
architecture conventions this skill assumes.

The point of the loop is confidence: every feature is **verified in a real browser** and
**confirmed live** before you call it done. Don't skip the verification steps — a feature
that "looks implemented" but throws on load is the common failure, and the browser catches
what reading code doesn't.

## The loop

### 1. Pick the feature and read the ground truth

- Open the target game's `DEVLOG.md`. Features live under `개발 예정 (Planned)`.
- If the user named a feature not in the list, that's fine — just implement it and log it
  in step 4 anyway.
- Skim the game's `src/` to see where the change lands. The modules follow a one-way
  dependency chain (`config ← {tetromino,board,renderer,input} ← game ← main`); keep it
  that way and don't introduce cycles.

### 2. Implement in the module pattern

- Put logic where it belongs by responsibility, not convenience: state/rules in the model
  and board modules, drawing in the renderer (which **reads** state, never mutates it),
  event→command mapping in input, orchestration in game, DOM wiring in main.
- Match the surrounding code's style and comment density.
- **Watch for field/method name collisions.** An instance field and a method with the same
  name shadow each other in JS — e.g. `this.hold = null` silently overrides a `hold()`
  method, so `game.hold()` becomes "not a function". Name the field distinctly
  (`heldPiece`) when a same-named command exists. This exact bug already bit the hold
  feature; it costs an hour if the browser doesn't catch it.

### 3. Verify in a real browser (do not skip)

ES modules don't load over `file://`, so serve the game and test over HTTP:

```bash
cd dayNN-<name> && python -m http.server 8125
```

Then, using the browser tools:

- Navigate to `http://localhost:8125/index.html` and check **console errors = 0**. A
  clean load is the single strongest signal the module graph is wired correctly.
- Functionally confirm the feature actually did something. Prefer an **objective check**
  over a screenshot, because the browser pane sometimes won't composite for screenshots.
  Drive the game by dispatching real key events and read canvas/DOM state back:

  ```js
  // Count painted pixels on a preview canvas — proves something rendered.
  const px = (id) => { const c=document.getElementById(id);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let n=0; for(let i=0;i<d.length;i+=4){ if(d[i]||d[i+1]||d[i+2]) n++; } return n; };
  const fire = (k) => window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  document.getElementById('overlayBtn').click();   // start the game
  const before = px('hold'); fire('c'); const after = px('hold');
  // assert: before === 0 && after > 0  → the feature rendered
  ```

  Also verify the *rules*, not just that it drew once — e.g. a once-per-drop action should
  be a no-op the second time until the state resets. `game` is module-scoped and not on
  `window`, so test through real inputs and observable output, which is what a player
  experiences anyway.
- If a screenshot fails with "Browser pane is not displayed", fall back to the
  pixel/DOM checks above — they're more reliable here than the visual.
- Stop the server when done.

### 4. Update the docs

- In the game's `DEVLOG.md`, move the shipped item out of `개발 예정` and add a dated entry
  under `개발 적용 (Changelog)` (today's date). Note any notable bug fixed along the way —
  future-you learns from it.
- Update the game's `README.md` if controls or the feature list changed.
- Update the root `index.html` gallery card tags if the feature is headline-worthy.

### 5. Commit feature-scoped

Follow `CLAUDE.md`: Conventional Commits, one logical change per commit, and **no
`Co-Authored-By` trailer**. Typically two commits — the feature, then the docs:

```bash
git add <feature files>
git commit -m "feat(dayNN): <what and why, one or two lines>"
git add <dayNN>/DEVLOG.md <dayNN>/README.md
git commit -m "docs(dayNN): log <feature> in DEVLOG and README"
git push origin main
```

### 6. Confirm it's live

Pushing triggers a GitHub Pages rebuild. Don't assume — confirm the new code is actually
served:

```bash
# Poll the live file for a token unique to your change (cache-bust with ?cb=).
curl -s "https://dhlee0903.github.io/one-game-a-day/dayNN-<name>/src/<file>.js?cb=$RANDOM" | grep -c "<new-symbol>"
```

- A rebuild usually lands within ~1–2 min. If it's stuck `building` for many minutes,
  confirm `.nojekyll` exists at the repo root — without it Pages runs Jekyll on the static
  site, which can stall or mangle files. It's already committed; keep it.
- For final assurance, load the live URL in the browser and rerun the step-3 objective
  check against the deployed origin.

Report back with the live URL and a one-line summary of what was verified (console clean,
feature behaves, live confirmed).

## Scope

One feature per run. If the user lists several, do them as separate passes through the loop
so each gets its own verified commit — that keeps history bisectable and each deploy small.

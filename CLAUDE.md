# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript (ES6+), HTML5 Canvas, CSS. No dependencies, no build tools, no `package.json`. Three files total: `index.html`, `style.css`, `game.js`.

README (`README.md`) is in Spanish and documents the game in more detail than below.

## Running

No build/install step. Either:

```bash
start index.html       # Windows: open directly in browser
npx serve .             # or any static server, then open http://localhost:8000
```

No lint, test, or build commands exist in this repo — there is nothing to run beyond opening the page.

## Architecture (`game.js`)

Single file, no modules, everything runs at global scope and wires up via `document.addEventListener` at the bottom.

- **Board model**: `board` is a `ROWS × COLS` (20×10) matrix; each cell is `0` (empty) or `1–7` (color index of the locked piece).
- **Pieces**: `PIECES` are square matrices (index 0 unused, 1–7 = I,O,T,S,Z,J,L). Current/next piece is `{ type, shape, x, y }`. Rotation is `rotateCW` (transpose + reverse rows), not a lookup table of pre-rotated states.
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for both movement and rotation validity — checks board bounds and overlap with locked cells.
- **Wall kicks**: `tryRotate()` rotates then retries at x offsets `[0, -1, 1, -2, 2]` via `collide` until one fits, else the rotation is discarded.
- **Game loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates `dropAccum` and drops the piece one row (or calls `lockPiece()`) once `dropAccum >= dropInterval`. `dropInterval` shrinks as level increases: `max(100, 1000 - (level-1)*90)` ms.
- **Locking/clearing**: `lockPiece()` → `merge()` writes the piece into `board`, then `clearLines()` scans bottom-up, splices full rows out and unshifts empty rows in, updates `score`/`lines`/`level`/`dropInterval`.
- **Scoring**: `LINE_SCORES = [0,100,300,500,800]` × `level` for line clears; hard drop = 2 pts/row dropped, soft drop = 1 pt/row.
- **Ghost piece**: `ghostY()` projects the current piece straight down via repeated `collide` checks; drawn at `globalAlpha = 0.2`.
- **Rendering**: `draw()` clears and redraws grid + board + ghost + current piece every frame onto `#board` canvas; `drawNext()` renders the preview piece onto the separate `#next-canvas`.
- **Input**: single `keydown` listener — Arrow keys move/soft-drop, ArrowUp/X rotates, Space hard-drops (with `preventDefault`), P toggles pause. Ignored while `paused` or `gameOver`.
- **State transitions**: `init()` resets all game state and starts the loop; `spawn()` promotes `next` to `current` and generates a new `next`, calling `endGame()` if the freshly spawned piece already collides.

## Tuning knobs

All in `game.js` near the top: `COLS`, `ROWS`, `BLOCK` (px per cell), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, also update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).

'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (centro vacío)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

// ---- menú de pausa ----
let startLevel = 1;     // elegido en el menú; se aplica en la próxima init()
let gameStartLevel = 1; // nivel inicial de la partida en curso
let pauseSwallowCode = null; // tecla que cerró el menú: se ignora hasta soltarla
// ---- fin menú de pausa ----

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.max(gameStartLevel, Math.floor(lines / 10) + 1);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- skins ----
function skinRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// colors[] alineado con PIECES (0 = null, 8 = Tuerca). bg/grid null = usar el tema.
const SKINS = {
  retro: {
    colors: COLORS,
    bg: null,
    grid: null,
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, s - 2, s - 2);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#fff700', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100', '#e0e0ff'],
    bg: '#000000',
    grid: '#14142a',
    draw(c, px, py, s, color) {
      c.shadowColor = color;
      c.shadowBlur = 10;
      c.fillStyle = 'rgba(0,0,0,0.85)';
      c.fillRect(px + 3, py + 3, s - 6, s - 6);
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(px + 3, py + 3, s - 6, s - 6);
      c.shadowBlur = 0;
      c.fillStyle = color;
      c.globalAlpha *= 0.35;
      c.fillRect(px + 7, py + 7, s - 14, s - 14);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff1a8', '#d9b8f0', '#b9eac3', '#f8b9b9', '#b8d4f5', '#fcd3a1', '#d5dde0'],
    bg: null,
    grid: null,
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      skinRoundRect(c, px + 1.5, py + 1.5, s - 3, s - 3, 7);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      skinRoundRect(c, px + 5, py + 4, s - 10, 5, 2.5);
      c.fill();
    },
  },
  pixel: {
    colors: [null, '#29b6d6', '#f2c200', '#9c4dcc', '#4caf50', '#d84343', '#4a7fd1', '#ef8a17', '#8d9ba3'],
    bg: null,
    grid: null,
    draw(c, px, py, s, color) {
      const n = 6, u = (s - 2) / n;
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, s - 2, s - 2);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if ((i + j) % 2 === 0) continue;
          c.fillStyle = (i * 3 + j) % 4 === 1 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)';
          c.fillRect(px + 1 + i * u, py + 1 + j * u, u, u);
        }
      }
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 2;
      c.strokeRect(px + 2, py + 2, s - 4, s - 4);
    },
  },
};
let currentSkin = 'retro';

function skinBackground(context, w, h) {
  const bg = SKINS[currentSkin].bg;
  if (!bg) return;
  context.fillStyle = bg;
  context.fillRect(0, 0, w, h);
}
// ---- /skins ----

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, skin.colors[colorIndex]);
  context.restore();
  context.shadowBlur = 0;
  context.shadowColor = 'rgba(0,0,0,0)';
  context.globalAlpha = 1;
}

let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  const isLight = theme === 'light';
  themeToggle.setAttribute('aria-checked', String(isLight));
  themeToggle.setAttribute('aria-label', 'Modo claro');
  try { localStorage.setItem('theme', theme); } catch (e) {}
  if (board && current) { draw(); drawNext(); }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  skinBackground(ctx, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  skinBackground(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlay.classList.remove('is-pause');
  overlayTitle.textContent = 'GAME OVER';  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    pauseMenuOnResume();
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    overlay.classList.add('is-pause');
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
    pauseMenuOnOpen();
  }
}

function loop(ts) {
  if (paused || gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  overlay.classList.remove('is-pause');
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (pauseMenuKey(e)) return;
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  restartBtn.blur();
  init();
});

// ---- menú de pausa ----
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const pauseLevelValue = document.getElementById('pause-level-value');
const pauseLevelDown = document.getElementById('pause-level-down');
const pauseLevelUp = document.getElementById('pause-level-up');
const PAUSE_BLOCKED = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

function pauseMenuOnOpen() {
  pauseControlsList.hidden = true;
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
  pauseLevelValue.textContent = startLevel;
  pauseResumeBtn.focus();
}

function pauseMenuOnResume() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// Devuelve true si la tecla ya fue gestionada (el handler global debe salir).
function pauseMenuKey(e) {
  if (e.code === pauseSwallowCode) return true;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.repeat) return true;
    const wasPaused = paused;
    togglePause();
    if (wasPaused && !paused) pauseSwallowCode = e.code;
    return true;
  }
  if (paused && PAUSE_BLOCKED.includes(e.code)) {
    e.preventDefault();
    return true;
  }
  return false;
}

document.addEventListener('keyup', e => {
  if (e.code === pauseSwallowCode) pauseSwallowCode = null;
});

window.addEventListener('blur', () => { pauseSwallowCode = null; });

function setStartLevel(n) {
  startLevel = Math.min(10, Math.max(1, n));
  pauseLevelValue.textContent = startLevel;
}

pauseResumeBtn.addEventListener('click', () => {
  pauseResumeBtn.blur();
  if (paused) togglePause();
});
pauseRestartBtn.addEventListener('click', () => {
  pauseRestartBtn.blur();
  init();
});
pauseControlsBtn.addEventListener('click', () => {
  pauseControlsList.hidden = !pauseControlsList.hidden;
  pauseControlsBtn.setAttribute('aria-expanded', String(!pauseControlsList.hidden));
  pauseControlsBtn.blur();
});
pauseLevelDown.addEventListener('click', () => { setStartLevel(startLevel - 1); pauseLevelDown.blur(); });
pauseLevelUp.addEventListener('click', () => { setStartLevel(startLevel + 1); pauseLevelUp.blur(); });
// ---- fin menú de pausa ----

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Espacio (caída) active el botón
});
let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
applyTheme(savedTheme);

// ---- skins ----
const skinSelect = document.getElementById('skin-select');
function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  skinSelect.value = name;
  try { localStorage.setItem('skin', name); } catch (e) {}
  if (board && current) { draw(); drawNext(); }
}
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que Espacio (caída) active el control
});
// Si el select conserva el foco (abrir y cerrar sin cambiar), las teclas de juego no deben cambiar la skin.
document.addEventListener('keydown', e => {
  if (e.target === skinSelect && /^(Arrow|Space)/.test(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
}, true);
let savedSkin = 'retro';
try { savedSkin = localStorage.getItem('skin') || 'retro'; } catch (e) {}
applySkin(savedSkin);
// ---- /skins ----

init();

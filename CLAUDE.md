# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin tests, sin linter. UI y textos en español.

## Ejecutar

Abrir `index.html` directo en el navegador, o servir estático:

```bash
python -m http.server 8000   # luego http://localhost:8000
```

No hay suite de pruebas: verificar cambios jugando en el navegador.

## Arquitectura

Tres archivos: `index.html` (DOM, dos `<canvas>`, overlay), `style.css` (tema oscuro), `game.js` (toda la lógica, script clásico con `'use strict'`, sin módulos; todo el estado son variables globales de módulo reinicializadas en `init()`).

Puntos clave de `game.js`:

- **Tablero**: matriz `ROWS × COLS`; cada celda es `0` o un índice de color 1–7. El valor dentro de cada matriz de `PIECES` es el mismo índice de color, así que `merge()` copia el valor de la celda tal cual. `COLORS[i]` y `PIECES[i]` deben quedar alineados por índice (posición 0 = `null`).
- **Rotación**: `rotateCW` (transpuesta + reverso) y `tryRotate` con kicks horizontales `[0, -1, 1, -2, 2]`. No es SRS; no hay rotación antihoraria.
- **Colisión**: `collide(shape, ox, oy)` es la única fuente de verdad para movimiento, rotación, ghost (`ghostY`) y detección de game over en `spawn()`. Celdas con `y < 0` se permiten.
- **Bucle**: `loop(ts)` con `requestAnimationFrame`; acumula `dropAccum` y baja una fila al superar `dropInterval`. Pausa/game over cancelan con `cancelAnimationFrame(animId)`.
- **Ciclo de pieza**: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `clearLines()` también recalcula `level` (cada 10 líneas) y `dropInterval = max(100, 1000 − (level−1)·90)`.
- **Puntuación**: `LINE_SCORES[n] × level`; soft drop +1 por fila, hard drop +2 por celda.
- **HUD**: `updateHUD()` escribe en los `#score/#lines/#level`; el overlay (`#overlay`) se reutiliza para PAUSA y GAME OVER, y su botón llama a `init()`.

## Restricciones al cambiar dimensiones

`#board` en `index.html` tiene `width="300" height="600"` fijos = `COLS × BLOCK` × `ROWS × BLOCK`. Si cambia `COLS`, `ROWS` o `BLOCK`, ajustar el canvas. `drawNext()` asume un canvas de 4×4 celdas de 30 px (`#next-canvas` 120×120).

## Bugs conocidos (detectados al leer el código)

- `endGame()` se llama desde dentro de `loop()` (vía `lockPiece` → `spawn`); su `cancelAnimationFrame` no afecta el frame en curso y `loop` vuelve a programarse al final, así que la caída automática sigue tras el GAME OVER.
- `togglePause()` al reanudar no vuelve a ocultar el overlay (falta `overlay.classList.add('hidden')`), y llama `loop()` directamente además de reprogramarlo.

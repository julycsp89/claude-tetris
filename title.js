// Título "TETRIS" dibujado con bloques estilo cubo metálico de arcade (matriz 5x5 por letra)
(function () {
  const GLYPHS = {
    T: ['11111', '00100', '00100', '00100', '00100'],
    E: ['11111', '10000', '11110', '10000', '11111'],
    R: ['11110', '10001', '11110', '10100', '10011'],
    I: ['11111', '00100', '00100', '00100', '11111'],
    S: ['01111', '10000', '01110', '00001', '11110'],
  };
  const COLORS = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#f0a000'];

  const title = document.getElementById('title');
  if (!title) return;

  // Todas las letras comparten la misma animación (en .title): se encienden y apagan juntas
  'TETRIS'.split('').forEach((ch, i) => {
    const letter = document.createElement('span');
    letter.className = 'title-letter';
    letter.setAttribute('aria-hidden', 'true');
    letter.style.setProperty('--c', COLORS[i % COLORS.length]);

    GLYPHS[ch].forEach((row) => {
      row.split('').forEach((cell) => {
        const b = document.createElement('i');
        if (cell === '1') b.className = 'on';
        letter.appendChild(b);
      });
    });
    title.appendChild(letter);
  });
})();

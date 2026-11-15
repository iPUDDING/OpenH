import { describe, expect, it } from 'vitest';
import { BASE_WORDS_PER_MINUTE, escapeHtml, estimateSeconds, extractWordRanges, findMatches, findSentenceRange, findWordAt, normalizeSearchText, pauseAllowanceSeconds, splitParagraphs } from './text';
import { formatClock, safeFileName } from './utils';

describe('utilidades de texto', () => {
  it('extrae palabras Unicode con posiciones exactas', () => {
    const words = extractWordRanges('¡Acción útil y código!');
    expect(words.map(({ text }) => text)).toEqual(['Acción', 'útil', 'y', 'código']);
    expect(words[0]).toMatchObject({ start: 1, end: 7 });
    expect(findWordAt(words, 2)?.text).toBe('Acción');
  });

  it('localiza la frase que contiene la palabra leída', () => {
    const text = 'Primera frase. Segunda frase con voz! Tercera.';
    const words = extractWordRanges(text);
    const word = words.find(({ text }) => text === 'voz')!;
    expect(text.slice(...Object.values(findSentenceRange(text, word)) as [number, number])).toBe('Segunda frase con voz! ');
  });

  it('busca sin distinguir mayúsculas ni diacríticos', () => {
    expect(normalizeSearchText('Árbol')).toBe('arbol');
    expect(findMatches('Árbol y arbolito', 'árbol')).toHaveLength(2);
  });

  it('conserva los rangos originales cuando Unicode se descompone', () => {
    expect(findMatches('한글 테스트', '한')).toEqual([{ index: 0, length: 1 }]);
    expect(findMatches('α한글', '한')).toEqual([{ index: 1, length: 1 }]);
    expect(findMatches('Cafe\u0301 y té', 'café')).toEqual([{ index: 0, length: 5 }]);
    expect(findMatches('😀 árbol', 'árbol')).toEqual([{ index: 3, length: 5 }]);
  });

  it('divide párrafos y descarta vacíos', () => {
    expect(splitParagraphs('Uno\n\nDos\nTres')).toEqual([
      { id: 'paragraph-0', text: 'Uno' },
      { id: 'paragraph-1', text: 'Dos' },
      { id: 'paragraph-2', text: 'Tres' },
    ]);
  });

  it('escapa HTML para exportaciones seguras', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  });

  it('estima la duración con la velocidad base y las pausas de puntuación', () => {
    const baseWords = Array.from({ length: BASE_WORDS_PER_MINUTE }, () => 'palabra').join(' ');
    expect(estimateSeconds('', 1)).toBe(0);
    expect(estimateSeconds(baseWords, 1)).toBeCloseTo(60, 5);
    expect(estimateSeconds(baseWords, 2)).toBeCloseTo(30, 5);
    expect(estimateSeconds('Hola mundo', 1)).toBeCloseTo((2 / BASE_WORDS_PER_MINUTE) * 60, 5);
    expect(estimateSeconds('Hola mundo.', 1)).toBeCloseTo((2 / BASE_WORDS_PER_MINUTE) * 60 + 0.35, 5);
  });

  it('suma pausas por fin de frase, coma y salto de párrafo', () => {
    expect(pauseAllowanceSeconds('')).toBe(0);
    expect(pauseAllowanceSeconds('Uno. Dos, tres\n\nCuatro')).toBeCloseTo(0.35 + 0.12 + 0.5, 5);
    expect(pauseAllowanceSeconds('Sin puntuación')).toBe(0);
  });

  it('formatea relojes y nombres de archivo', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(safeFileName('mi: mapa?')).toBe('mi- mapa-');
    expect(safeFileName('CON')).toBe('_CON');
    expect(safeFileName('COM1.md')).toBe('_COM1.md');
    expect(safeFileName('mapa final.')).toBe('mapa final');
    expect(safeFileName('   ')).toBe('openhub');
  });
});

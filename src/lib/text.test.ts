import { describe, expect, it } from 'vitest';
import { escapeHtml, extractWordRanges, findMatches, findSentenceRange, findWordAt, normalizeSearchText, splitParagraphs } from './text';
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

  it('formatea relojes y nombres de archivo', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(safeFileName('mi: mapa?')).toBe('mi- mapa-');
  });
});

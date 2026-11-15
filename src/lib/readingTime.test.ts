import { describe, expect, it } from 'vitest';
import {
  BASE_WORDS_PER_MINUTE,
  blendWpm,
  clampObservedWpm,
  countRemainingWords,
  estimateRemainingSeconds,
  estimateSegmentsSeconds,
  formatRemainingTime,
  nominalWpm,
  remainingTextFromPosition,
} from './readingTime';
import type { SpeechSegment } from '@/types';

const segments: SpeechSegment[] = [
  { id: 'a', text: 'Uno dos tres' },
  { id: 'b', text: 'Cuatro cinco' },
];

describe('tiempo de lectura', () => {
  it('calcula la velocidad nominal desde la velocidad elegida', () => {
    expect(nominalWpm(1)).toBe(BASE_WORDS_PER_MINUTE);
    expect(nominalWpm(2)).toBe(BASE_WORDS_PER_MINUTE * 2);
    expect(nominalWpm(0.1)).toBe(BASE_WORDS_PER_MINUTE * 0.5);
    expect(nominalWpm(10)).toBe(BASE_WORDS_PER_MINUTE * 2.5);
  });

  it('cuenta las palabras restantes desde la palabra actual, no solo desde el párrafo', () => {
    expect(countRemainingWords(segments, null)).toBe(5);
    expect(countRemainingWords(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 0, end: 3, text: 'Uno' } })).toBe(5);
    expect(countRemainingWords(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 4, end: 7, text: 'dos' } })).toBe(4);
    expect(countRemainingWords(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 8, end: 12, text: 'tres' } })).toBe(3);
    expect(countRemainingWords(segments, { segmentId: 'b', segmentIndex: 1, word: { start: 0, end: 6, text: 'Cuatro' } })).toBe(2);
    expect(countRemainingWords([], null)).toBe(0);
  });

  it('extrae el texto que falta desde la posición actual', () => {
    expect(remainingTextFromPosition(segments, null)).toBe('Uno dos tres\n\nCuatro cinco');
    expect(remainingTextFromPosition(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 4, end: 7, text: 'dos' } })).toBe('dos tres\n\nCuatro cinco');
    expect(remainingTextFromPosition([], null)).toBe('');
  });

  it('el tiempo restante baja a medida que avanza la lectura', () => {
    const start = estimateRemainingSeconds(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 0, end: 3, text: 'Uno' } }, BASE_WORDS_PER_MINUTE);
    const middle = estimateRemainingSeconds(segments, { segmentId: 'a', segmentIndex: 0, word: { start: 8, end: 12, text: 'tres' } }, BASE_WORDS_PER_MINUTE);
    const end = estimateRemainingSeconds(segments, { segmentId: 'b', segmentIndex: 1, word: { start: 7, end: 12, text: 'cinco' } }, BASE_WORDS_PER_MINUTE);
    expect(start).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(end);
    expect(end).toBeGreaterThan(0);
    expect(estimateRemainingSeconds([], null, BASE_WORDS_PER_MINUTE)).toBe(0);
  });

  it('respeta una velocidad efectiva distinta de la nominal (voz calibrada)', () => {
    const slow = estimateRemainingSeconds(segments, null, 100);
    const fast = estimateRemainingSeconds(segments, null, 200);
    expect(slow).toBeGreaterThan(fast);
  });

  it('estima la duración total de los segmentos', () => {
    expect(estimateSegmentsSeconds([], 1)).toBe(0);
    expect(estimateSegmentsSeconds([{ id: 'a', text: 'Uno dos' }], 1)).toBeCloseTo((2 / BASE_WORDS_PER_MINUTE) * 60, 5);
    expect(estimateSegmentsSeconds([{ id: 'a', text: 'Uno dos' }], 2)).toBeCloseTo((2 / (BASE_WORDS_PER_MINUTE * 2)) * 60, 5);
  });

  it('limita y suaviza la velocidad observada', () => {
    expect(clampObservedWpm(165, 165)).toBe(165);
    expect(clampObservedWpm(500, 165)).toBe(165 * 1.8);
    expect(clampObservedWpm(10, 165)).toBe(165 * 0.6);
    expect(clampObservedWpm(Number.NaN, 165)).toBe(165);
    expect(blendWpm(100, 200, 0.5)).toBe(150);
    expect(blendWpm(100, 200, 0)).toBe(100);
    expect(blendWpm(100, 200, 1)).toBe(200);
  });

  it('formatea la cuenta regresiva en mm:ss y h:mm:ss', () => {
    expect(formatRemainingTime(0)).toBe('00:00');
    expect(formatRemainingTime(-5)).toBe('00:00');
    expect(formatRemainingTime(Number.NaN)).toBe('00:00');
    expect(formatRemainingTime(59)).toBe('00:59');
    expect(formatRemainingTime(60)).toBe('01:00');
    expect(formatRemainingTime(61)).toBe('01:01');
    expect(formatRemainingTime(30.2)).toBe('00:31');
    expect(formatRemainingTime(3600)).toBe('1:00:00');
    expect(formatRemainingTime(3661)).toBe('1:01:01');
  });
});

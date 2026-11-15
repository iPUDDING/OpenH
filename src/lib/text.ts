import type { SpeechSegment, WordRange } from '@/types';

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function extractWordRanges(text: string): WordRange[] {
  return Array.from(text.matchAll(WORD_PATTERN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }));
}

export function splitParagraphs(text: string): SpeechSegment[] {
  return text
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({ id: `paragraph-${index}`, text: paragraph }));
}

export function countWords(text: string): number {
  return extractWordRanges(text).length;
}

/** Velocidad media realista de lectura en voz alta en español (palabras/min a velocidad 1×). */
export const BASE_WORDS_PER_MINUTE = 165;

/** Pausas naturales que la voz hace en puntuación y saltos de párrafo (segundos). */
export function pauseAllowanceSeconds(text: string): number {
  if (!text) return 0;
  const sentenceEnds = text.match(/[.!?…]+/g)?.length ?? 0;
  const clausePauses = text.match(/[,;:]/g)?.length ?? 0;
  const paragraphBreaks = text.match(/\n\s*\n/g)?.length ?? 0;
  return sentenceEnds * 0.35 + clausePauses * 0.12 + paragraphBreaks * 0.5;
}

/**
 * Estima la duración de lectura de un texto: palabras a la velocidad nominal
 * más las pausas por puntuación. La velocidad se limita al rango de la interfaz (0,5×–2,5×).
 */
export function estimateSeconds(text: string, rate = 1): number {
  const words = countWords(text);
  if (!words) return 0;
  const safeRate = Math.min(2.5, Math.max(0.5, Number.isFinite(rate) ? rate : 1));
  const speechSeconds = (words / (BASE_WORDS_PER_MINUTE * safeRate)) * 60;
  return speechSeconds + pauseAllowanceSeconds(text);
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export interface TextMatch {
  index: number;
  length: number;
}

export function findMatches(text: string, query: string): TextMatch[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return [];
  let haystack = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let offset = 0; offset < text.length;) {
    const character = String.fromCodePoint(text.codePointAt(offset)!);
    const normalized = normalizeSearchText(character);
    if (!normalized && ends.length && /\p{M}/u.test(character)) {
      // Una marca combinante pertenece al carácter anterior aunque desaparezca al normalizar.
      ends[ends.length - 1] = offset + character.length;
    }
    for (let partIndex = 0; partIndex < normalized.length; partIndex += 1) {
      haystack += normalized[partIndex];
      starts.push(offset);
      ends.push(offset + character.length);
    }
    offset += character.length;
  }
  const matches: TextMatch[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    const start = starts[index];
    const end = ends[index + needle.length - 1];
    if (start !== undefined && end !== undefined) matches.push({ index: start, length: end - start });
    from = index + Math.max(1, needle.length);
  }
  return matches;
}

export function findSentenceRange(text: string, word: WordRange): { start: number; end: number } {
  let start = 0;
  const before = text.slice(0, word.start);
  for (const match of before.matchAll(/[.!?…]+["'”’)\]]*\s+|[\r\n]+/g)) {
    start = match.index + match[0].length;
  }
  const after = text.slice(word.end);
  const ending = /[.!?…]+["'”’)\]]*(?:\s+|$)|[\r\n]+/.exec(after);
  const end = ending ? word.end + ending.index + ending[0].length : text.length;
  return { start, end };
}

export function findWordAt(words: WordRange[], charIndex: number): WordRange | null {
  if (!words.length) return null;
  const containing = words.find((word) => charIndex >= word.start && charIndex < word.end);
  if (containing) return containing;
  return words.find((word) => word.start >= charIndex) ?? words.at(-1) ?? null;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return entities[character];
  });
}

export function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

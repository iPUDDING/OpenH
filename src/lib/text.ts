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

export function estimateSeconds(text: string, rate = 1): number {
  return (countWords(text) / Math.max(0.5, 180 * rate)) * 60;
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
  const haystack = normalizeSearchText(text);
  const matches: TextMatch[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    matches.push({ index, length: needle.length });
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

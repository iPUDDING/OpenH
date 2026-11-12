import type { PronunciationRule, SpeechSegment, WordRange } from '@/types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PronouncedText {
  text: string;
  sourceText?: string;
  offsetMap?: number[];
  pronunciationRanges?: Array<{ spokenStart: number; spokenEnd: number; sourceStart: number; sourceEnd: number }>;
}

/**
 * Sustituye términos completos y conserva las fronteras de cada carácter hablado.
 * De ese modo, los eventos de voz pueden volver al texto visible original.
 */
export function applyPronunciationRules(text: string, rules: PronunciationRule[]): PronouncedText {
  const active = rules.filter((rule) => rule.enabled && rule.from.trim() && rule.to.trim());
  if (!text || !active.length) return { text };
  const sorted = [...active].sort((a, b) => b.from.length - a.from.length);
  const alternatives = sorted.map((rule) => escapeRegExp(rule.from.trim())).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${alternatives})(?![\\p{L}\\p{N}_])`, 'giu');
  const matches = Array.from(text.matchAll(pattern));
  if (!matches.length) return { text };

  let output = '';
  let cursor = 0;
  const offsetMap: number[] = [];
  const pronunciationRanges: NonNullable<PronouncedText['pronunciationRanges']> = [];
  const appendOriginal = (from: number, to: number) => {
    for (let index = from; index < to; index += 1) {
      output += text[index];
      offsetMap.push(index);
    }
  };

  for (const match of matches) {
    const start = match.index;
    const original = match[0];
    const rule = sorted.find((candidate) => candidate.from.trim().toLocaleLowerCase() === original.toLocaleLowerCase());
    if (!rule) continue;
    appendOriginal(cursor, start);
    const spokenStart = output.length;
    const replacement = rule.to.trim();
    for (let index = 0; index < replacement.length; index += 1) {
      output += replacement[index];
      const relative = Math.min(original.length, Math.floor((index / replacement.length) * original.length));
      offsetMap.push(start + relative);
    }
    cursor = start + original.length;
    pronunciationRanges.push({ spokenStart, spokenEnd: output.length, sourceStart: start, sourceEnd: cursor });
  }
  appendOriginal(cursor, text.length);
  offsetMap.push(text.length);
  return { text: output, sourceText: text, offsetMap, pronunciationRanges };
}

export function prepareSpeechSegments(segments: SpeechSegment[], rules: PronunciationRule[]): SpeechSegment[] {
  if (!rules.some((rule) => rule.enabled)) return segments;
  return segments.map((segment) => ({ ...segment, ...applyPronunciationRules(segment.text, rules) }));
}

export function mapSpokenWordToSource(segment: SpeechSegment, word: WordRange | null): WordRange | null {
  if (!word || !segment.offsetMap || !segment.sourceText) return word;
  const overlapping = segment.pronunciationRanges?.filter((range) => word.start < range.spokenEnd && word.end > range.spokenStart) ?? [];
  const start = overlapping.length ? Math.min(...overlapping.map((range) => range.sourceStart)) : segment.offsetMap[word.start] ?? word.start;
  const end = overlapping.length ? Math.max(...overlapping.map((range) => range.sourceEnd)) : segment.offsetMap[word.end] ?? word.end;
  return { start, end, text: segment.sourceText.slice(start, end) };
}

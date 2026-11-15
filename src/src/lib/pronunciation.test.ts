import { describe, expect, it } from 'vitest';
import { applyPronunciationRules, mapSpokenWordToSource, prepareSpeechSegments } from './pronunciation';
import { extractWordRanges } from './text';
import type { PronunciationRule } from '@/types';

const rules: PronunciationRule[] = [{ id: '1', from: 'Kubernetes', to: 'ku ber ne tes', enabled: true }];

describe('pronunciación TTS', () => {
  it('sustituye términos completos sin alterar coincidencias parciales', () => {
    expect(applyPronunciationRules('Kubernetes y KubernetesCluster', rules).text).toBe('ku ber ne tes y KubernetesCluster');
  });

  it('mapea las palabras habladas al texto visible original', () => {
    const [segment] = prepareSpeechSegments([{ id: 'p', text: 'Usa Kubernetes hoy' }], rules);
    const spokenWord = extractWordRanges(segment.text).find(({ text }) => text === 'ber')!;
    const visible = mapSpokenWordToSource(segment, spokenWord)!;
    expect(segment.sourceText?.slice(visible.start, visible.end)).toBe('Kubernetes');
    expect(segment.offsetMap).toHaveLength(segment.text.length + 1);
  });

  it('respeta reglas desactivadas', () => {
    expect(applyPronunciationRules('Kubernetes', [{ ...rules[0], enabled: false }])).toEqual({ text: 'Kubernetes' });
  });
});

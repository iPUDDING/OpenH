import { describe, expect, it } from 'vitest';
import { applyDashSpeech, dashTextToSpeech } from './dashSpeech';
import { applyMathSpeech } from './mathSpeech';
import { mapSpokenWordToSource } from './pronunciation';
import { extractWordRanges } from './text';
import type { SpeechSegment } from '@/types';

describe('lectura de guiones en español', () => {
  it('lee la raya larga como pausa en lugar de saltarla', () => {
    expect(dashTextToSpeech('La técnica —que es nueva— funciona')?.text).toBe('La técnica, que es nueva, funciona');
    expect(dashTextToSpeech('fisioterapia - rehabilitación')?.text).toBe('fisioterapia, rehabilitación');
    expect(dashTextToSpeech('palabra–palabra')?.text).toBe('palabra, palabra');
  });

  it('lee rangos numéricos con «a»', () => {
    expect(dashTextToSpeech('páginas 10-15')?.text).toBe('páginas 10 a 15');
    expect(dashTextToSpeech('del 10 - 15 al 20')?.text).toBe('del 10 a 15 al 20');
    expect(dashTextToSpeech('10—15')?.text).toBe('10 a 15');
  });

  it('separa palabras compuestas con guion', () => {
    expect(dashTextToSpeech('teórico-práctico')?.text).toBe('teórico práctico');
    expect(dashTextToSpeech('post-quirúrgico')?.text).toBe('post quirúrgico');
    expect(dashTextToSpeech('tipo-2')?.text).toBe('tipo 2');
  });

  it('omite el marcador de lista y conserva el signo menos', () => {
    expect(dashTextToSpeech('- Primer elemento')?.text).toBe('Primer elemento');
    expect(dashTextToSpeech('-5 grados')).toBeNull();
    expect(dashTextToSpeech('temperatura −5')?.text).toBe('temperatura menos 5');
  });

  it('une palabras cortadas por guion suave de línea', () => {
    expect(dashTextToSpeech('fisiote-\nrapia')?.text).toBe('fisioterapia');
  });

  it('no cambia textos sin guiones', () => {
    expect(dashTextToSpeech('Texto normal sin guiones.')).toBeNull();
    expect(dashTextToSpeech('')).toBeNull();
  });

  it('conserva el mapa de offsets hacia el texto original', () => {
    const original = 'rango 10-15 final';
    const converted = dashTextToSpeech(original)!;
    expect(converted.text).toBe('rango 10 a 15 final');
    expect(converted.offsetMap).toHaveLength(converted.text.length + 1);
    const words = extractWordRanges(converted.text);
    const quince = words.find(({ text }) => text === '15')!;
    const sourceRange = mapSpokenWordToSource(
      { id: 's', text: converted.text, sourceText: original, offsetMap: converted.offsetMap },
      quince,
    );
    expect(original.slice(sourceRange!.start, sourceRange!.end)).toBe('15');
  });

  it('compone fórmulas y guiones hacia el texto visible original', () => {
    const segment: SpeechSegment = {
      id: 'p',
      text: '≥90% - 100%',
      mathRanges: [{ start: 0, end: 4, tex: '\\ge 90\\,\\%', spoken: 'mayor o igual que 90 por ciento' }],
    };
    const [mathSpoken] = applyMathSpeech([segment]);
    const [final] = applyDashSpeech([mathSpoken]);
    expect(final.text).toBe('mayor o igual que 90 por ciento, 100%');
    expect(final.sourceText).toBe('≥90% - 100%');
    const words = extractWordRanges(final.text);
    const mayor = words.find(({ text }) => text === 'mayor')!;
    const sourceRange = mapSpokenWordToSource(final, mayor);
    expect(sourceRange!.start).toBeGreaterThanOrEqual(0);
    expect(sourceRange!.end).toBeLessThanOrEqual(4);
  });

  it('no toca bloques de código', () => {
    const fakePre = { closest: (selector: string) => (selector.includes('pre') ? {} : null) } as unknown as HTMLElement;
    const segment = { id: 'code', text: 'const x = a - b;', element: fakePre } as unknown as SpeechSegment;
    const [result] = applyDashSpeech([segment]);
    expect(result.text).toBe('const x = a - b;');
  });
});

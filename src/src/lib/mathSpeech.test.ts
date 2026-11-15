import { describe, expect, it } from 'vitest';
import { applyMathSpeech, latexTextToSpeech, latexToSpeech } from './mathSpeech';
import { mapSpokenWordToSource, prepareSpeechSegments } from './pronunciation';
import { extractWordRanges } from './text';
import type { SpeechSegment } from '@/types';

describe('lectura de fórmulas LaTeX en español', () => {
  it('lee el ejemplo del usuario sin código fuente literal', () => {
    const spoken = latexToSpeech('\\ge 90\\,\\%');
    expect(spoken).toBe('mayor o igual que 90 por ciento');
    expect(spoken).not.toContain('\\');
    expect(spoken).not.toContain('$');
  });

  it('convierte fracciones, raíces, potencias y subíndices', () => {
    expect(latexToSpeech('\\frac{1}{2}')).toBe('fracción 1 sobre 2');
    expect(latexToSpeech('\\sqrt{2}')).toBe('raíz cuadrada de 2');
    expect(latexToSpeech('x^2')).toBe('x al cuadrado');
    expect(latexToSpeech('x^3')).toBe('x al cubo');
    expect(latexToSpeech('x^{n+1}')).toBe('x elevado a n+1');
    expect(latexToSpeech('x_1')).toBe('x subíndice 1');
    expect(latexToSpeech('\\frac12')).toBe('fracción 1 sobre 2');
  });

  it('lee símbolos, griegas y funciones', () => {
    expect(latexToSpeech('\\alpha + \\beta')).toBe('alfa + beta');
    expect(latexToSpeech('\\sin x')).toBe('seno x');
    expect(latexToSpeech('\\pi \\approx 3.14')).toBe('pi aproximadamente 3.14');
    expect(latexToSpeech('a \\times b')).toBe('a por b');
    expect(latexToSpeech('\\lim_{x \\to 0} f(x)')).toBe('límite subíndice x tiende a 0 f(x)');
    expect(latexToSpeech('n!')).toBe('n factorial');
    expect(latexToSpeech('45\\%')).toBe('45 por ciento');
    expect(latexToSpeech('90°')).toBe('90 grados');
  });

  it('omite comandos desconocidos y de formato sin leerlos', () => {
    expect(latexToSpeech('\\color{red}x')).toBe('x');
    expect(latexToSpeech('\\unknowncmd{valor}')).toBe('valor');
    expect(latexToSpeech('\\displaystyle\\frac{a}{b}')).toBe('fracción a sobre b');
    expect(latexToSpeech('\\text{por ciento}')).toBe('por ciento');
    expect(latexToSpeech('\\begin{cases} a & b \\\\ c & d \\end{cases}')).toBe('a, b; c, d');
  });

  it('convierte fórmulas dentro de texto plano con mapa de offsets', () => {
    const original = 'El rendimiento es $\\ge 90\\,\\%$ en total.';
    const converted = latexTextToSpeech(original);
    expect(converted).not.toBeNull();
    expect(converted!.text).toBe('El rendimiento es mayor o igual que 90 por ciento en total.');
    expect(converted!.offsetMap).toHaveLength(converted!.text.length + 1);
    // La palabra hablada «mayor» vuelve al rango de la fórmula original.
    const words = extractWordRanges(converted!.text);
    const mayor = words.find(({ text }) => text === 'mayor')!;
    const sourceRange = mapSpokenWordToSource(
      { id: 's', text: converted!.text, sourceText: original, offsetMap: converted!.offsetMap },
      mayor,
    );
    expect(sourceRange).not.toBeNull();
    // El rango cae dentro del delimitador de la fórmula original.
    const spanStart = original.indexOf('$');
    const spanEnd = original.lastIndexOf('$') + 1;
    expect(sourceRange!.start).toBeGreaterThanOrEqual(spanStart);
    expect(sourceRange!.end).toBeLessThanOrEqual(spanEnd);
  });

  it('no confunde moneda con fórmulas', () => {
    expect(latexTextToSpeech('Cuesta $100 y $200.')).toBeNull();
    expect(latexTextToSpeech('Texto sin fórmulas.')).toBeNull();
    expect(latexTextToSpeech('')).toBeNull();
  });

  it('aplica la lectura a segmentos del visor con rangos KaTeX', () => {
    const segment: SpeechSegment = {
      id: 'p',
      text: '≥90%',
      mathRanges: [{ start: 0, end: 4, tex: '\\ge 90\\,\\%', spoken: 'mayor o igual que 90 por ciento' }],
    };
    const [spoken] = applyMathSpeech([segment]);
    expect(spoken.text).toBe('mayor o igual que 90 por ciento');
    expect(spoken.sourceText).toBe('≥90%');
    expect(spoken.offsetMap).toHaveLength(spoken.text.length + 1);
    expect(spoken.offsetMap![0]).toBe(0);
    expect(spoken.offsetMap!.at(-1)).toBe(4);
  });

  it('compone fórmulas y pronunciación hacia el texto visible original', () => {
    const segment: SpeechSegment = {
      id: 'p',
      text: '≥90%',
      mathRanges: [{ start: 0, end: 4, tex: '\\ge 90\\,\\%', spoken: 'mayor o igual que 90 por ciento' }],
    };
    const [mathSpoken] = applyMathSpeech([segment]);
    const [final] = prepareSpeechSegments([mathSpoken], [
      { id: 'r1', from: 'por ciento', to: 'por 100', enabled: true },
    ]);
    expect(final.text).toContain('por 100');
    expect(final.sourceText).toBe('≥90%');
    const words = extractWordRanges(final.text);
    const hundred = words.find(({ text }) => text === '100')!;
    const sourceRange = mapSpokenWordToSource(final, hundred);
    // «100» proviene de «por ciento», que vive dentro de la fórmula (0–4).
    expect(sourceRange!.start).toBeGreaterThanOrEqual(0);
    expect(sourceRange!.end).toBeLessThanOrEqual(4);
  });

  it('no toca bloques de código', () => {
    const fakePre = { closest: (selector: string) => (selector.includes('pre') ? {} : null) } as unknown as HTMLElement;
    const segment = { id: 'code', text: 'const x = $\\ge 90\\,\\%$;', element: fakePre } as unknown as SpeechSegment;
    const [result] = applyMathSpeech([segment]);
    expect(result.text).toBe('const x = $\\ge 90\\,\\%$;');
  });
});

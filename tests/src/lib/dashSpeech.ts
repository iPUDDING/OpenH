import type { SpeechSegment } from '@/types';

/**
 * Normalización de guiones para la voz.
 * Sin esto, la voz se salta el guion (`-`, `–`, `—`) y lee las palabras
 * pegadas o se traba. Cada caso se lee como corresponde:
 * - Raya/guion largo entre palabras → pausa (`, `).
 * - Rango `10-15` → `10 a 15`.
 * - Compuesto `teórico-práctico` → `teórico práctico`.
 * - Marcador de lista `- elemento` → se omite.
 * - Signo menos `−5` → se conserva (`menos 5` lo lee la voz).
 * Todo conserva el mapa de offsets para el resaltado visible.
 */

export interface ConvertedText {
  text: string;
  /** Fronteras de caracteres hablados → originales (longitud text.length + 1). */
  offsetMap: number[];
}

function applyPattern(
  text: string,
  pattern: RegExp,
  replacer: (match: string, index: number) => string,
): ConvertedText | null {
  let result = '';
  const offsetMap: number[] = [];
  let cursor = 0;
  let found = false;
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    found = true;
    const plain = text.slice(cursor, match.index);
    result += plain;
    for (let i = 0; i < plain.length; i += 1) offsetMap.push(cursor + i);
    const replacement = replacer(match[0], match.index);
    for (let i = 0; i < replacement.length; i += 1) {
      offsetMap.push(match.index + Math.floor((i * match[0].length) / Math.max(1, replacement.length)));
    }
    result += replacement;
    cursor = match.index + match[0].length;
  }
  if (!found) return null;
  const tail = text.slice(cursor);
  result += tail;
  for (let i = 0; i < tail.length; i += 1) offsetMap.push(cursor + i);
  offsetMap.push(text.length);
  return { text: result, offsetMap };
}

function identityMap(length: number): number[] {
  return Array.from({ length: length + 1 }, (_, index) => index);
}

/**
 * Convierte los guiones de un texto a su lectura natural.
 * Devuelve `null` si no hay guiones (sin cambios).
 */
export function dashTextToSpeech(text: string): ConvertedText | null {
  let current: ConvertedText = { text, offsetMap: identityMap(text.length) };
  let changed = false;
  const pass = (pattern: RegExp, replacer: (match: string, index: number) => string) => {
    const step = applyPattern(current.text, pattern, replacer);
    if (!step) return;
    changed = true;
    current = {
      text: step.text,
      offsetMap: step.offsetMap.map((index) => current.offsetMap[index] ?? index),
    };
  };

  // Variantes Unicode del guion → guion simple.
  pass(/[‐‑‒]/g, () => '-');
  // Guion suave de fin de línea (PDF): «fisiote-\nrapia» → «fisioterapia».
  pass(/(?<=\p{L})-\r?\n(?=\p{L})/gu, () => '');
  // Signo menos tipográfico → palabra (la voz lo lee como «menos»).
  pass(/−/g, () => ' menos ');
  // Rango con raya larga: «10—15» → «10 a 15».
  pass(/(?<=\d)\s*[—–―]\s*(?=\d)/g, () => ' a ');
  // Raya/guion largo entre palabras → pausa.
  pass(/\s*[—–―]\s*/g, () => ', ');
  // Guion doble → pausa.
  pass(/--+/g, () => ', ');
  // Rango con guion: «10-15» y «10 - 15» → «10 a 15».
  pass(/(?<=\d)\s*-\s*(?=\d)/g, () => ' a ');
  // Guion espaciado entre palabras → pausa.
  pass(/\s+-\s+/g, () => ', ');
  // Compuesto: «teórico-práctico» → «teórico práctico».
  pass(/(?<=\p{L})-(?=\p{L})/gu, () => ' ');
  // Mezcla letra/dígito: «tipo-2» → «tipo 2».
  pass(/(?<=\p{L})-(?=\d)|(?<=\d)-(?=\p{L})/gu, () => ' ');
  // Marcador de lista al inicio: «- elemento» → «elemento».
  pass(/^\s*-\s+/g, () => '');
  // Guion final: «palabra -» → «palabra».
  pass(/\s*-+\s*$/g, () => '');
  // Cualquier guion restante (no ante dígito, para no perder el menos) → espacio.
  pass(/-(?!\d)/g, () => ' ');

  if (!changed) return null;

  // Limpieza: espacios simples, coma pegada y sin comas colgantes.
  pass(/\s+/g, () => ' ');
  pass(/\s+,/g, () => ',');
  pass(/^,\s*|,\s*$/g, () => '');
  pass(/^\s+|\s+$/g, () => '');

  return current;
}

/** Elemento del segmento DOM (si lo tiene) para no tocar bloques de código. */
interface SegmentWithElement extends SpeechSegment {
  element?: HTMLElement;
}

/**
 * Aplica la normalización de guiones a los segmentos de TTS componiendo
 * el mapa con el que ya traigan (fórmulas, etc.). Los bloques de código
 * (`pre`/`code`) no se tocan.
 */
export function applyDashSpeech(segments: SpeechSegment[]): SpeechSegment[] {
  return segments.map((segment) => {
    const element = (segment as SegmentWithElement).element;
    if (element?.closest('pre, code')) return segment;
    const converted = dashTextToSpeech(segment.text);
    if (!converted) return segment;
    const priorMap = segment.offsetMap;
    const offsetMap = priorMap
      ? converted.offsetMap.map((index) => priorMap[index] ?? index)
      : converted.offsetMap;
    return { ...segment, text: converted.text, sourceText: segment.sourceText ?? segment.text, offsetMap };
  });
}

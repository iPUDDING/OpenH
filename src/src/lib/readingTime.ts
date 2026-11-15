import type { SpeechPosition, SpeechSegment } from '@/types';
import { BASE_WORDS_PER_MINUTE, countWords, extractWordRanges, pauseAllowanceSeconds } from './text';

/**
 * Tiempo de lectura: estimación, palabras restantes y calibración con la voz real.
 * Todo es puro y testeable; `useTts` orquesta el reloj y la calibración en vivo.
 */

export { BASE_WORDS_PER_MINUTE };

/** Velocidad nominal (palabras/min) para una velocidad de reproducción dada. */
export function nominalWpm(rate: number): number {
  const safeRate = Math.min(2.5, Math.max(0.5, Number.isFinite(rate) ? rate : 1));
  return BASE_WORDS_PER_MINUTE * safeRate;
}

/** Texto que se escuchará: el original visible cuando hay reglas de pronunciación. */
export function segmentSourceText(segment: SpeechSegment): string {
  return segment.sourceText ?? segment.text;
}

export function countSegmentWords(segment: SpeechSegment): number {
  return countWords(segmentSourceText(segment));
}

export function countTotalWords(segments: SpeechSegment[]): number {
  return segments.reduce((total, segment) => total + countSegmentWords(segment), 0);
}

function clampSegmentIndex(segments: SpeechSegment[], index: number): number {
  return Math.min(Math.max(0, index), Math.max(0, segments.length - 1));
}

/**
 * Palabras que faltan por leer, contando desde la palabra actual (inclusive).
 * Sin posición, devuelve el total. Así el tiempo restante baja dentro del párrafo,
 * no solo al cambiar de párrafo.
 */
export function countRemainingWords(segments: SpeechSegment[], position: SpeechPosition | null): number {
  if (!segments.length) return 0;
  if (!position) return countTotalWords(segments);
  const index = clampSegmentIndex(segments, position.segmentIndex);
  const current = segments[index];
  if (!current) return 0;
  const sourceText = segmentSourceText(current);
  const from = position.word?.start ?? 0;
  const wordsInCurrent = extractWordRanges(sourceText).filter((word) => word.end > from).length;
  const wordsAfter = segments.slice(index + 1).reduce((total, segment) => total + countSegmentWords(segment), 0);
  return wordsInCurrent + wordsAfter;
}

/** Texto que falta por leer desde la posición actual (para estimar sus pausas). */
export function remainingTextFromPosition(segments: SpeechSegment[], position: SpeechPosition | null): string {
  if (!segments.length) return '';
  if (!position) return segments.map(segmentSourceText).join('\n\n');
  const index = clampSegmentIndex(segments, position.segmentIndex);
  const current = segments[index];
  if (!current) return '';
  const from = position.word?.start ?? 0;
  const head = segmentSourceText(current).slice(from);
  const tail = segments.slice(index + 1).map(segmentSourceText);
  return [head, ...tail].join('\n\n');
}

/**
 * Segundos restantes estimados con una velocidad efectiva dada (palabras/min).
 * Incluye las pausas por puntuación del texto que falta.
 */
export function estimateRemainingSeconds(segments: SpeechSegment[], position: SpeechPosition | null, effectiveWpm: number): number {
  const words = countRemainingWords(segments, position);
  if (!words) return 0;
  const safeWpm = Number.isFinite(effectiveWpm) && effectiveWpm > 0 ? effectiveWpm : BASE_WORDS_PER_MINUTE;
  const speechSeconds = (words / safeWpm) * 60;
  return speechSeconds + pauseAllowanceSeconds(remainingTextFromPosition(segments, position));
}

/** Duración estimada de los segmentos completos a una velocidad de reproducción. */
export function estimateSegmentsSeconds(segments: SpeechSegment[], rate = 1): number {
  if (!segments.length) return 0;
  const text = segments.map(segmentSourceText).join('\n\n');
  const words = countTotalWords(segments);
  if (!words) return 0;
  return (words / nominalWpm(rate)) * 60 + pauseAllowanceSeconds(text);
}

/** Limita una velocidad observada a un rango plausible respecto de la nominal. */
export function clampObservedWpm(observed: number, nominal: number): number {
  if (!Number.isFinite(observed) || observed <= 0) return nominal;
  const min = Math.max(60, nominal * 0.6);
  const max = Math.min(420, nominal * 1.8);
  return Math.min(max, Math.max(min, observed));
}

/** Suavizado exponencial (EMA) para que la velocidad estimada no salte entre palabras. */
export function blendWpm(current: number, observed: number, weight = 0.3): number {
  const safeWeight = Math.min(1, Math.max(0, weight));
  return current + (observed - current) * safeWeight;
}

/**
 * Formato de cuenta regresiva: `mm:ss` (o `h:mm:ss` si supera la hora).
 * Redondea hacia arriba para no mostrar `00:00` mientras aún se está leyendo.
 */
export function formatRemainingTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00';
  const safe = Math.ceil(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { countWords, extractWordRanges, findWordAt } from '@/lib/text';
import {
  BASE_WORDS_PER_MINUTE,
  blendWpm,
  clampObservedWpm,
  countRemainingWords,
  countTotalWords,
  estimateRemainingSeconds,
  estimateSegmentsSeconds,
  nominalWpm,
} from '@/lib/readingTime';
import { cancelSpeech, createUtterance, loadVoices, speechSupported } from '@/services/ttsService';
import { mapSpokenWordToSource } from '@/lib/pronunciation';
import type { SpeechPosition, SpeechSegment, WordRange } from '@/types';

export type TtsStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'completed' | 'error';

export interface TtsController {
  supported: boolean;
  status: TtsStatus;
  voices: SpeechSynthesisVoice[];
  position: SpeechPosition | null;
  progress: number;
  /** Segundos que faltan (cuenta regresiva en vivo, calibrada con la voz real). */
  remainingSeconds: number;
  /** Segundos ya leídos en la sesión actual (sin contar pausas). */
  elapsedSeconds: number;
  /** Duración estimada total de la sesión actual (transcurrido + restante). */
  totalSeconds: number;
  /** Palabras que faltan por leer desde la palabra actual. */
  remainingWords: number;
  /** Palabras totales de la sesión actual. */
  totalWords: number;
  /** Velocidad efectiva estimada (palabras/min) a la velocidad elegida. */
  effectiveWpm: number;
  error: string | null;
  play: (startIndex?: number, customSegments?: SpeechSegment[]) => void;
  replay: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
}

interface FallbackContext {
  segment: SpeechSegment;
  index: number;
  token: number;
  words: WordRange[];
}

export function useTts(segments: SpeechSegment[]): TtsController {
  const settings = useAppStore((state) => state.tts);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [status, setStatus] = useState<TtsStatus>('idle');
  const [position, setPosition] = useState<SpeechPosition | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Reloj de la cuenta regresiva: se actualiza cada 250 ms mientras se habla.
  const [now, setNow] = useState(() => performance.now());
  const [effectiveWpm, setEffectiveWpm] = useState(() => nominalWpm(1));
  const [wordsRemaining, setWordsRemaining] = useState(0);
  const [sessionTotal, setSessionTotal] = useState<{ words: number; seconds: number } | null>(null);
  const tokenRef = useRef(0);
  const instanceIdRef = useRef(`tts-${Math.random().toString(36).slice(2)}`);
  const activeSegmentsRef = useRef(segments);
  const speakRef = useRef<(index: number, token: number) => void>(() => undefined);
  const fallbackTimerRef = useRef<number | null>(null);
  const fallbackContextRef = useRef<FallbackContext | null>(null);
  const fallbackStartedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedRef = useRef(false);
  const receivedBoundaryRef = useRef(false);
  const positionRef = useRef<SpeechPosition | null>(null);
  // Calibración del tiempo restante con la velocidad real de la voz.
  const baseWpmRef = useRef(BASE_WORDS_PER_MINUTE);
  const anchorRef = useRef<{ at: number; remaining: number; wordsRemaining: number } | null>(null);
  const calibRef = useRef<{ at: number; wordsRemaining: number } | null>(null);
  const playAtRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const completedElapsedRef = useRef(0);
  const supported = speechSupported();

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback((next: SpeechPosition | null) => {
    positionRef.current = next;
    setPosition(next);
  }, []);

  const resetLocal = useCallback(() => {
    tokenRef.current += 1;
    pausedRef.current = false;
    receivedBoundaryRef.current = false;
    clearFallback();
    fallbackContextRef.current = null;
    baseWpmRef.current = BASE_WORDS_PER_MINUTE;
    anchorRef.current = null;
    calibRef.current = null;
    playAtRef.current = 0;
    pausedAccumRef.current = 0;
    completedElapsedRef.current = 0;
    setStatus('idle');
    setProgress(0);
    setError(null);
    setEffectiveWpm(nominalWpm(1));
    setWordsRemaining(0);
    setSessionTotal(null);
    updatePosition(null);
  }, [clearFallback, updatePosition]);

  const stop = useCallback(() => {
    resetLocal();
    cancelSpeech(instanceIdRef.current);
  }, [resetLocal]);

  const runFallback = useCallback(() => {
    clearFallback();
    fallbackTimerRef.current = window.setInterval(() => {
      const context = fallbackContextRef.current;
      if (!context || context.token !== tokenRef.current || receivedBoundaryRef.current || pausedRef.current) return;
      const elapsedSeconds = (performance.now() - fallbackStartedAtRef.current) / 1000;
      const wordIndex = Math.min(context.words.length - 1, Math.floor(elapsedSeconds * nominalWpm(settings.rate) / 60));
      if (wordIndex < 0) return;
      const word = context.words[wordIndex];
      updatePosition({ segmentId: context.segment.id, segmentIndex: context.index, word: mapSpokenWordToSource(context.segment, word) });
      const total = activeSegmentsRef.current.length;
      setProgress((context.index + word.end / Math.max(1, context.segment.text.length)) / total);
    }, 90);
  }, [clearFallback, settings.rate, updatePosition]);

  const play = useCallback((startIndex = 0, customSegments?: SpeechSegment[]) => {
    if (!supported) {
      setError('Web Speech API no está disponible. En Windows, instala voces de Windows y usa la aplicación de escritorio.');
      setStatus('error');
      return;
    }
    const source = customSegments?.length ? customSegments : segments;
    if (!source.length) {
      setError('No hay texto para leer.');
      setStatus('error');
      return;
    }
    tokenRef.current += 1;
    const token = tokenRef.current;
    pausedRef.current = false;
    activeSegmentsRef.current = source;
    clearFallback();
    fallbackContextRef.current = null;
    // Nueva sesión: reinicia la calibración y el reloj. Saltar de párrafo
    // dentro de una sesión activa conserva el transcurrido y la voz calibrada.
    const sessionActive = status === 'speaking' || status === 'paused' || status === 'loading';
    if (!sessionActive) {
      baseWpmRef.current = BASE_WORDS_PER_MINUTE;
      playAtRef.current = performance.now();
      pausedAccumRef.current = 0;
      completedElapsedRef.current = 0;
    }
    anchorRef.current = null;
    calibRef.current = null;
    const safeStart = Math.max(0, Math.min(startIndex, source.length - 1));
    const sessionSegments = source.slice(safeStart);
    setSessionTotal({ words: countTotalWords(sessionSegments), seconds: estimateSegmentsSeconds(sessionSegments, settings.rate) });
    setWordsRemaining(countTotalWords(sessionSegments));
    setEffectiveWpm(baseWpmRef.current * settings.rate);
    updatePosition(null);
    cancelSpeech(instanceIdRef.current);
    setError(null);
    setStatus('loading');
    setProgress(startIndex / source.length);
    window.setTimeout(() => {
      if (token === tokenRef.current) speakRef.current(safeStart, token);
    }, 80);
  }, [clearFallback, segments, settings.rate, status, supported]);

  speakRef.current = (index, token) => {
    const source = activeSegmentsRef.current;
    const segment = source[index];
    if (!segment || token !== tokenRef.current) return;
    clearFallback();
    receivedBoundaryRef.current = false;
    const words = extractWordRanges(segment.text);
    const voice = voices.find(({ voiceURI }) => voiceURI === settings.voiceURI)
      ?? voices.find(({ lang }) => lang.toLocaleLowerCase().startsWith('es'))
      ?? voices[0];
    const utterance = createUtterance(segment.text, settings, voice);

    fallbackContextRef.current = { segment, index, token, words };
    fallbackStartedAtRef.current = performance.now();
    const firstPosition = { segmentId: segment.id, segmentIndex: index, word: mapSpokenWordToSource(segment, words[0] ?? null) };
    updatePosition(firstPosition);
    // Actualiza el contador de palabras en el mismo ciclo que el nuevo párrafo,
    // sin esperar al efecto de calibración del reloj.
    setWordsRemaining(countRemainingWords(source, firstPosition));
    setStatus('speaking');
    setProgress(index / source.length);

    utterance.onboundary = (event) => {
      if (token !== tokenRef.current || pausedRef.current || (event.name && event.name !== 'word')) return;
      if (!receivedBoundaryRef.current) clearFallback();
      receivedBoundaryRef.current = true;
      const charIndex = Math.max(0, Math.min(event.charIndex, segment.text.length));
      updatePosition({ segmentId: segment.id, segmentIndex: index, word: mapSpokenWordToSource(segment, findWordAt(words, charIndex)) });
      const local = segment.text.length ? charIndex / segment.text.length : 0;
      setProgress((index + local) / source.length);
    };
    utterance.onerror = (event) => {
      if (token !== tokenRef.current || event.error === 'canceled' || event.error === 'interrupted') return;
      clearFallback();
      setError(`No se pudo reproducir la voz (${event.error}). Prueba con otra voz del sistema.`);
      setStatus('error');
      updatePosition(null);
    };
    utterance.onend = () => {
      if (token !== tokenRef.current) return;
      clearFallback();
      if (index + 1 < source.length) {
        speakRef.current(index + 1, token);
      } else {
        completedElapsedRef.current = Math.max(0, (performance.now() - playAtRef.current - pausedAccumRef.current) / 1000);
        setProgress(1);
        setStatus('completed');
        updatePosition(null);
      }
    };

    // Algunas voces SAPI no emiten boundary; se usa una estimación solo en ese caso.
    runFallback();
    window.speechSynthesis.speak(utterance);
  };

  const pause = useCallback(() => {
    if (status !== 'speaking' || !supported) return;
    pausedRef.current = true;
    pausedAtRef.current = performance.now();
    window.speechSynthesis.pause();
    clearFallback();
    // Congela la cuenta regresiva en su valor actual (no sigue bajando en pausa).
    const anchor = anchorRef.current;
    if (anchor) {
      const frozen = Math.max(0, anchor.remaining - (pausedAtRef.current - anchor.at) / 1000);
      anchorRef.current = { ...anchor, at: pausedAtRef.current, remaining: frozen };
    }
    setStatus('paused');
  }, [clearFallback, status, supported]);

  const resume = useCallback(() => {
    if (status !== 'paused' || !supported) return;
    // Excluye el tiempo pausado de la estimación sin reiniciar el párrafo.
    const resumedAt = performance.now();
    const pausedFor = resumedAt - pausedAtRef.current;
    fallbackStartedAtRef.current += pausedFor;
    pausedAccumRef.current += pausedFor;
    pausedRef.current = false;
    window.speechSynthesis.resume();
    // Desplaza el ancla y la calibración para que la pausa no cuente como lectura.
    if (anchorRef.current) anchorRef.current = { ...anchorRef.current, at: resumedAt };
    if (calibRef.current) calibRef.current = { ...calibRef.current, at: resumedAt };
    setStatus('speaking');
    if (!receivedBoundaryRef.current) runFallback();
  }, [runFallback, status, supported]);

  const replay = useCallback(() => play(0, activeSegmentsRef.current), [play]);

  const next = useCallback(() => {
    const index = (positionRef.current?.segmentIndex ?? -1) + 1;
    if (index < activeSegmentsRef.current.length) play(index, activeSegmentsRef.current);
  }, [play]);

  const previous = useCallback(() => {
    const index = Math.max(0, (positionRef.current?.segmentIndex ?? 1) - 1);
    play(index, activeSegmentsRef.current);
  }, [play]);

  const segmentSignature = useMemo(() => JSON.stringify(segments.map(({ id, text }) => [id, text])), [segments]);
  const previousSegmentSignatureRef = useRef(segmentSignature);
  useLayoutEffect(() => {
    if (previousSegmentSignatureRef.current === segmentSignature) return;
    previousSegmentSignatureRef.current = segmentSignature;
    activeSegmentsRef.current = segments;
    if (status === 'loading' || status === 'speaking' || status === 'paused') {
      // Evita continuar una versión antigua con resaltados de la versión editada.
      resetLocal();
      cancelSpeech(instanceIdRef.current);
    }
  }, [resetLocal, segmentSignature, segments, status]);

  useEffect(() => {
    let mounted = true;
    loadVoices().then((loaded) => { if (mounted) setVoices(loaded); });
    const onVoices = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    if (supported) window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    return () => {
      mounted = false;
      if (supported) window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
    };
  }, [supported]);

  useEffect(() => {
    const onCancel = (event: Event) => {
      const source = (event as CustomEvent<string | undefined>).detail;
      if (source !== instanceIdRef.current) resetLocal();
    };
    window.addEventListener('openhub:tts-cancel', onCancel);
    return () => window.removeEventListener('openhub:tts-cancel', onCancel);
  }, [resetLocal]);

  useEffect(() => () => {
    tokenRef.current += 1;
    clearFallback();
    cancelSpeech(instanceIdRef.current);
  }, [clearFallback]);

  // Ancla de la cuenta regresiva: cada palabra/párrafo nuevo recalcula el
  // restante desde la palabra actual y calibra la velocidad con la voz real.
  useEffect(() => {
    if (status !== 'speaking') return;
    const source = activeSegmentsRef.current;
    const wordsLeft = countRemainingWords(source, position);
    const at = performance.now();
    const calib = calibRef.current;
    if (!calib || wordsLeft > calib.wordsRemaining) {
      calibRef.current = { at, wordsRemaining: wordsLeft };
    } else if (wordsLeft < calib.wordsRemaining) {
      const elapsed = (at - calib.at) / 1000;
      if (elapsed >= 2) {
        const observedBase = ((calib.wordsRemaining - wordsLeft) / elapsed) * 60 / settings.rate;
        baseWpmRef.current = blendWpm(baseWpmRef.current, clampObservedWpm(observedBase, BASE_WORDS_PER_MINUTE), 0.3);
        setEffectiveWpm(baseWpmRef.current * settings.rate);
        calibRef.current = { at, wordsRemaining: wordsLeft };
      }
    }
    const effective = baseWpmRef.current * settings.rate;
    anchorRef.current = { at, remaining: estimateRemainingSeconds(source, position, effective), wordsRemaining: wordsLeft };
    setWordsRemaining(wordsLeft);
    setNow(at);
  }, [position, settings.rate, status]);

  // Reloj de la cuenta regresiva mientras se habla (interpola entre palabras).
  useEffect(() => {
    if (status !== 'speaking') return;
    setNow(performance.now());
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, [status]);

  const nominalTotalSeconds = useMemo(
    () => estimateSegmentsSeconds(segments, settings.rate),
    [segments, settings.rate],
  );
  const nominalTotalWords = useMemo(() => countTotalWords(segments), [segments]);

  const anchor = anchorRef.current;
  let remainingSeconds: number;
  let elapsedSeconds: number;
  if (status === 'completed') {
    elapsedSeconds = completedElapsedRef.current;
    remainingSeconds = 0;
  } else if (status === 'paused' && anchor) {
    remainingSeconds = anchor.remaining;
    elapsedSeconds = Math.max(0, (pausedAtRef.current - playAtRef.current - pausedAccumRef.current) / 1000);
  } else if ((status === 'speaking' || status === 'loading') && anchor) {
    remainingSeconds = Math.max(0, anchor.remaining - (now - anchor.at) / 1000);
    elapsedSeconds = Math.max(0, (now - playAtRef.current - pausedAccumRef.current) / 1000);
  } else if (status === 'speaking' || status === 'loading' || status === 'paused') {
    // Sesión activa pero aún sin ancla (primeros milisegundos tras pulsar Leer).
    remainingSeconds = sessionTotal?.seconds ?? nominalTotalSeconds;
    const end = status === 'paused' ? pausedAtRef.current : now;
    elapsedSeconds = Math.max(0, (end - playAtRef.current - pausedAccumRef.current) / 1000);
  } else {
    remainingSeconds = nominalTotalSeconds;
    elapsedSeconds = 0;
  }
  const totalSeconds = status === 'completed' ? elapsedSeconds : elapsedSeconds + remainingSeconds;
  const totalWords = sessionTotal?.words ?? nominalTotalWords;
  const remainingWords = status === 'idle' || status === 'error' ? totalWords : wordsRemaining;

  return {
    supported,
    status,
    voices,
    position,
    progress,
    remainingSeconds,
    elapsedSeconds,
    totalSeconds,
    remainingWords,
    totalWords,
    effectiveWpm,
    error,
    play,
    replay,
    pause,
    resume,
    stop,
    next,
    previous,
  };
}

export function useSpeechSpaceShortcut(
  containerRef: RefObject<HTMLElement | null>,
  controller: Pick<TtsController, 'status' | 'pause' | 'resume' | 'stop'>,
) {
  const suppressKeyUpRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code !== 'Space' && event.key !== ' ') || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!containerRef.current?.offsetParent) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (controller.status !== 'speaking' && controller.status !== 'loading' && controller.status !== 'paused') return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, [role="slider"], [role="switch"], [role="option"], [role="listbox"], a[href], summary, [aria-label="Temporizador Pomodoro"]')) {
        return;
      }
      const button = target?.closest('button, [role="button"]');
      if (button && !button.hasAttribute('data-tts-control')) return;

      event.preventDefault();
      suppressKeyUpRef.current = true;
      if (controller.status === 'speaking') controller.pause();
      else if (controller.status === 'paused') controller.resume();
      else controller.stop();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!suppressKeyUpRef.current || (event.code !== 'Space' && event.key !== ' ')) return;
      suppressKeyUpRef.current = false;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, [containerRef, controller.pause, controller.resume, controller.status, controller.stop]);
}

export function ttsWordCount(segments: SpeechSegment[]): number {
  return segments.reduce((total, segment) => total + countWords(segment.text), 0);
}

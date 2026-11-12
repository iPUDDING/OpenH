import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { countWords, estimateSeconds, extractWordRanges, findWordAt } from '@/lib/text';
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
  remainingSeconds: number;
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
    clearFallback();
    setStatus('idle');
    setProgress(0);
    setError(null);
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
      const wordIndex = Math.min(context.words.length - 1, Math.floor(elapsedSeconds * (180 * settings.rate) / 60));
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
    cancelSpeech(instanceIdRef.current);
    setError(null);
    setStatus('loading');
    setProgress(startIndex / source.length);
    window.setTimeout(() => {
      if (token === tokenRef.current) speakRef.current(Math.max(0, Math.min(startIndex, source.length - 1)), token);
    }, 80);
  }, [clearFallback, segments, supported]);

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
    updatePosition({ segmentId: segment.id, segmentIndex: index, word: mapSpokenWordToSource(segment, words[0] ?? null) });
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
    setStatus('paused');
  }, [clearFallback, status, supported]);

  const resume = useCallback(() => {
    if (status !== 'paused' || !supported) return;
    // Excluye el tiempo pausado de la estimación sin reiniciar el párrafo.
    fallbackStartedAtRef.current += performance.now() - pausedAtRef.current;
    pausedRef.current = false;
    window.speechSynthesis.resume();
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

  const segmentSignature = useMemo(() => segments.map(({ id, text }) => `${id}:${text.length}`).join('|'), [segments]);
  useEffect(() => {
    activeSegmentsRef.current = segments;
  }, [segments, segmentSignature]);

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

  const remainingSeconds = useMemo(() => {
    if (status === 'completed') return 0;
    const source = activeSegmentsRef.current;
    const index = position?.segmentIndex ?? 0;
    const remaining = source.slice(index).map(({ text }) => text).join(' ');
    return estimateSeconds(remaining, settings.rate);
  }, [position, settings.rate, segmentSignature, status]);

  return {
    supported,
    status,
    voices,
    position,
    progress,
    remainingSeconds,
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

export function ttsWordCount(segments: SpeechSegment[]): number {
  return segments.reduce((total, segment) => total + countWords(segment.text), 0);
}

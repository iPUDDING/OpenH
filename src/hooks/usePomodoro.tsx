import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '@/store/useAppStore';

export type PomodoroMode = 'work' | 'break';

interface PomodoroContextValue {
  mode: PomodoroMode;
  running: boolean;
  secondsLeft: number;
  totalSeconds: number;
  completedSessions: number;
  progress: number;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  skip: () => void;
  reset: () => void;
  resetStats: () => void;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const settings = useAppStore((state) => state.pomodoro);
  const [mode, setMode] = useState<PomodoroMode>('work');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(settings.workMinutes * 60);
  const [completedSessions, setCompletedSessions] = useState(0);
  const endAtRef = useRef(0);
  const totalSeconds = (mode === 'work' ? settings.workMinutes : settings.breakMinutes) * 60;

  const switchMode = useCallback((current: PomodoroMode, keepRunning: boolean, countCompletion = true) => {
    const next = current === 'work' ? 'break' : 'work';
    if (current === 'work' && countCompletion) setCompletedSessions((count) => count + 1);
    const nextSeconds = (next === 'work' ? settings.workMinutes : settings.breakMinutes) * 60;
    setMode(next);
    setSecondsLeft(nextSeconds);
    setRunning(keepRunning);
    if (keepRunning) endAtRef.current = Date.now() + nextSeconds * 1000;
  }, [settings.breakMinutes, settings.workMinutes]);

  useEffect(() => {
    // Solo un cambio de configuración reinicia la sesión; pausar conserva el tiempo.
    setRunning(false);
    setSecondsLeft((mode === 'work' ? settings.workMinutes : settings.breakMinutes) * 60);
    // mode se lee del render en el que cambia la configuración; switchMode controla sus cambios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.breakMinutes, settings.workMinutes]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) switchMode(mode, true);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [mode, running, switchMode]);

  const start = useCallback(() => {
    endAtRef.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
  }, [secondsLeft]);
  const pause = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [pause, running, start]);
  const skip = useCallback(() => switchMode(mode, false, false), [mode, switchMode]);
  const reset = useCallback(() => {
    setRunning(false);
    setSecondsLeft((mode === 'work' ? settings.workMinutes : settings.breakMinutes) * 60);
  }, [mode, settings.breakMinutes, settings.workMinutes]);
  const resetStats = useCallback(() => setCompletedSessions(0), []);

  const value = useMemo<PomodoroContextValue>(() => ({
    mode,
    running,
    secondsLeft,
    totalSeconds,
    completedSessions,
    progress: totalSeconds ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0,
    start,
    pause,
    toggle,
    skip,
    reset,
    resetStats,
  }), [mode, running, secondsLeft, totalSeconds, completedSessions, start, pause, toggle, skip, reset, resetStats]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): PomodoroContextValue {
  const context = useContext(PomodoroContext);
  if (!context) throw new Error('usePomodoro debe utilizarse dentro de PomodoroProvider.');
  return context;
}

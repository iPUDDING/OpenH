import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coffee, Pause, Play, RotateCcw, SkipForward, Timer, X } from 'lucide-react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Hint } from '@/components/ui/Tooltip';
import { formatClock } from '@/lib/utils';

interface PanelPosition { top: number; left: number }

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const timer = usePomodoro();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isWork = timer.mode === 'work';

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger || !trigger.getClientRects().length) {
        // Las herramientas visitadas se ocultan con display:none; no dejar un portal huérfano.
        setOpen(false);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const width = Math.min(288, window.innerWidth - margin * 2);
      const height = Math.min(panelRef.current?.offsetHeight ?? 224, window.innerHeight - margin * 2);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      const fitsBelow = rect.bottom + gap + height <= window.innerHeight - margin;
      const top = fitsBelow ? rect.bottom + gap : Math.max(margin, rect.top - height - gap);
      setPosition({ top, left });
    };
    updatePosition();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null;
    if (triggerRef.current && observer) observer.observe(triggerRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndFocus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Hint label="Pomodoro">
        <Button
          ref={triggerRef}
          variant={timer.running ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Pomodoro: ${formatClock(timer.secondsLeft)}`}
          className={timer.running ? 'text-primary' : ''}
        >
          {isWork ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
          <span className="font-mono tabular-nums">{formatClock(timer.secondsLeft)}</span>
        </Button>
      </Hint>
      {open && createPortal(
        <section
          ref={panelRef}
          id={panelId}
          className="fixed z-[180] max-h-[calc(100vh-1.5rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground shadow-2xl animate-fade-in"
          style={{ top: position?.top ?? 12, left: position?.left ?? 12, visibility: position ? 'visible' : 'hidden' }}
          aria-label="Temporizador Pomodoro"
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{isWork ? 'Sesión de enfoque' : 'Descanso'}</h3>
              <p className="text-xs text-muted-foreground">{timer.completedSessions} {timer.completedSessions === 1 ? 'sesión completada' : 'sesiones completadas'}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={closeAndFocus} aria-label="Cerrar Pomodoro"><X className="h-4 w-4" /></Button>
          </div>
          <div className="mb-3 text-center font-mono text-4xl font-semibold tabular-nums tracking-tight">{formatClock(timer.secondsLeft)}</div>
          <Progress value={timer.progress} label="Progreso de la sesión" className="mb-4" />
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={timer.toggle}>{timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{timer.running ? 'Pausar' : 'Iniciar'}</Button>
            <Hint label="Reiniciar sesión"><Button variant="outline" size="icon-sm" onClick={timer.reset} aria-label="Reiniciar sesión"><RotateCcw className="h-4 w-4" /></Button></Hint>
            <Hint label="Siguiente sesión"><Button variant="outline" size="icon-sm" onClick={timer.skip} aria-label="Siguiente sesión"><SkipForward className="h-4 w-4" /></Button></Hint>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Sonará una alarma al terminar cada sesión.</p>
          <p className="sr-only" aria-live="polite">{isWork ? 'Comenzó el tiempo de enfoque' : 'Comenzó el tiempo de descanso'}</p>
        </section>,
        document.body,
      )}
    </div>
  );
}

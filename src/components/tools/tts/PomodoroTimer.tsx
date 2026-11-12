import { useState } from 'react';
import { Coffee, Pause, Play, RotateCcw, SkipForward, Timer, X } from 'lucide-react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Hint } from '@/components/ui/Tooltip';
import { formatClock } from '@/lib/utils';

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const timer = usePomodoro();
  const isWork = timer.mode === 'work';

  return (
    <div className="relative">
      <Hint label="Pomodoro">
        <Button
          variant={timer.running ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`Pomodoro: ${formatClock(timer.secondsLeft)}`}
          className={timer.running ? 'text-primary' : ''}
        >
          {isWork ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
          <span className="font-mono tabular-nums">{formatClock(timer.secondsLeft)}</span>
        </Button>
      </Hint>
      {open && (
        <section className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border bg-card p-4 text-card-foreground shadow-soft animate-fade-in" aria-label="Temporizador Pomodoro">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{isWork ? 'Sesión de enfoque' : 'Descanso'}</h3>
              <p className="text-xs text-muted-foreground">{timer.completedSessions} sesiones completadas</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Cerrar Pomodoro"><X className="h-4 w-4" /></Button>
          </div>
          <div className="mb-3 text-center font-mono text-4xl font-semibold tabular-nums tracking-tight">{formatClock(timer.secondsLeft)}</div>
          <Progress value={timer.progress} label="Progreso de la sesión" className="mb-4" />
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={timer.toggle}>{timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{timer.running ? 'Pausar' : 'Iniciar'}</Button>
            <Hint label="Reiniciar sesión"><Button variant="outline" size="icon-sm" onClick={timer.reset} aria-label="Reiniciar sesión"><RotateCcw className="h-4 w-4" /></Button></Hint>
            <Hint label="Siguiente sesión"><Button variant="outline" size="icon-sm" onClick={timer.skip} aria-label="Siguiente sesión"><SkipForward className="h-4 w-4" /></Button></Hint>
          </div>
        </section>
      )}
    </div>
  );
}

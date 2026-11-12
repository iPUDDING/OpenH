import { Pause, Play, RotateCcw, ScanText, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react';
import type { TtsController } from '@/hooks/useTts';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Select';
import { Progress } from '@/components/ui/Progress';
import { Hint } from '@/components/ui/Tooltip';
import { PomodoroTimer } from '@/components/tools/tts/PomodoroTimer';
import { formatDuration } from '@/lib/utils';

interface ReaderToolbarProps {
  controller: TtsController;
  onReadSelection: () => void;
  showPomodoro?: boolean;
  selectionLength?: number;
}

export function ReaderToolbar({ controller, onReadSelection, showPomodoro = false, selectionLength = 0 }: ReaderToolbarProps) {
  const settings = useAppStore((state) => state.tts);
  const setSettings = useAppStore((state) => state.setTtsSettings);
  const active = controller.status === 'speaking' || controller.status === 'paused' || controller.status === 'loading';
  const voiceOptions = [
    { value: 'default', label: 'Voz automática' },
    ...controller.voices.map((voice) => ({ value: voice.voiceURI, label: `${voice.name} · ${voice.lang}` })),
  ];

  return (
    <div className="border-b bg-card/80 px-3 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Volume2 className="h-4 w-4 text-primary" /> Lectura</div>
        {controller.status === 'speaking' ? (
          <Button size="sm" onClick={controller.pause}><Pause className="h-4 w-4" />Pausar</Button>
        ) : controller.status === 'paused' ? (
          <Button size="sm" onClick={controller.resume}><Play className="h-4 w-4" />Reanudar</Button>
        ) : (
          <Button size="sm" onClick={() => controller.play()} disabled={!controller.supported}><Play className="h-4 w-4" />Leer</Button>
        )}
        <Hint label="Párrafo anterior"><Button variant="ghost" size="icon-sm" onClick={controller.previous} disabled={!active} aria-label="Párrafo anterior"><SkipBack className="h-4 w-4" /></Button></Hint>
        <Hint label="Párrafo siguiente"><Button variant="ghost" size="icon-sm" onClick={controller.next} disabled={!active} aria-label="Párrafo siguiente"><SkipForward className="h-4 w-4" /></Button></Hint>
        <Hint label="Detener"><Button variant="ghost" size="icon-sm" onClick={controller.stop} disabled={!active && controller.status !== 'completed'} aria-label="Detener lectura"><Square className="h-4 w-4" /></Button></Hint>
        <Hint label={selectionLength ? `Leer únicamente los ${selectionLength} caracteres seleccionados` : 'Primero selecciona texto en el documento; después pulsa este botón'}>
          <Button variant={selectionLength ? 'secondary' : 'ghost'} size="sm" onMouseDown={(event) => event.preventDefault()} onClick={onReadSelection} disabled={!controller.supported} aria-label="Leer selección"><ScanText className="h-4 w-4" />Leer selección{selectionLength > 0 && <span className="rounded bg-background/70 px-1 text-[10px] tabular-nums">{selectionLength}</span>}</Button>
        </Hint>
        {controller.status === 'completed' && <Button variant="ghost" size="sm" onClick={controller.replay}><RotateCcw className="h-4 w-4" />Repetir</Button>}
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <SelectField
          aria-label="Voz de lectura"
          value={settings.voiceURI || 'default'}
          onValueChange={(voiceURI) => setSettings({ voiceURI: voiceURI === 'default' ? '' : voiceURI })}
          options={voiceOptions}
          className="w-44 max-w-[40vw]"
        />
        <SelectField
          aria-label="Velocidad de lectura"
          value={String(settings.rate)}
          onValueChange={(rate) => setSettings({ rate: Number(rate) })}
          options={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5].map((rate) => ({ value: String(rate), label: `${rate}×` }))}
          className="w-[76px]"
        />
        {active && <span className="ml-1 hidden text-xs text-muted-foreground lg:inline">≈ {formatDuration(controller.remainingSeconds)} restantes</span>}
        <div className="ml-auto">{showPomodoro && <PomodoroTimer />}</div>
      </div>
      {(active || controller.status === 'completed') && <Progress value={controller.progress * 100} className="mt-2" label="Progreso de lectura" />}
      {controller.error && <p role="alert" className="mt-2 text-xs text-destructive">{controller.error}</p>}
    </div>
  );
}

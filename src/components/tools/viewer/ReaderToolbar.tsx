import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Clock, GripVertical, Pause, Play, RotateCcw, ScanText, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react';
import type { TtsController } from '@/hooks/useTts';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Select';
import { Progress } from '@/components/ui/Progress';
import { Hint } from '@/components/ui/Tooltip';
import { PomodoroTimer } from '@/components/tools/tts/PomodoroTimer';
import { formatDuration } from '@/lib/utils';

type ReaderToolbarDock = 'bottom' | 'left' | 'right' | 'free';
interface ReaderToolbarPosition { dock: ReaderToolbarDock; x: number; y: number }
const READER_TOOLBAR_POSITION_KEY = 'openhub:reader-toolbar-position:v1';

function readReaderToolbarPosition(): ReaderToolbarPosition {
  try {
    const value = JSON.parse(window.localStorage.getItem(READER_TOOLBAR_POSITION_KEY) ?? 'null') as Partial<ReaderToolbarPosition> | null;
    if (value && ['bottom', 'left', 'right', 'free'].includes(String(value.dock))) {
      return {
        dock: value.dock as ReaderToolbarDock,
        x: Number.isFinite(value.x) ? Math.max(8, Number(value.x)) : 16,
        y: Number.isFinite(value.y) ? Math.max(8, Number(value.y)) : 16,
      };
    }
  } catch { /* Ignore malformed or inaccessible local preferences. */ }
  return { dock: 'bottom', x: 16, y: 16 };
}

interface ReaderToolbarProps {
  controller: TtsController;
  onReadSelection: () => void;
  showPomodoro?: boolean;
  selectionLength?: number;
}

export function ReaderToolbar({ controller, onReadSelection, showPomodoro = false, selectionLength = 0 }: ReaderToolbarProps) {
  const settings = useAppStore((state) => state.tts);
  const setSettings = useAppStore((state) => state.setTtsSettings);
  const theme = useAppStore((state) => state.theme);
  const appleTheme = theme === 'apple-dark';
  const [position, setPosition] = useState<ReaderToolbarPosition>(readReaderToolbarPosition);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
  const dragOriginRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const active = controller.status === 'speaking' || controller.status === 'paused' || controller.status === 'loading';

  useEffect(() => {
    try { window.localStorage.setItem(READER_TOOLBAR_POSITION_KEY, JSON.stringify(position)); } catch { /* Persistencia opcional; el control sigue moviéndose en memoria. */ }
  }, [position]);

  useEffect(() => {
    const container = toolbarRef.current?.closest<HTMLElement>('[aria-label="Visor de documentos"]');
    if (!container) return;
    const keepOnScreen = () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const bounds = container.getBoundingClientRect();
      const maxX = Math.max(8, bounds.width - toolbar.offsetWidth - 8);
      const maxY = Math.max(8, bounds.height - toolbar.offsetHeight - 8);
      setPosition((previous) => {
        if (previous.dock === 'bottom') return previous;
        const x = previous.dock === 'right' ? Math.min(previous.x, maxX) : Math.max(8, Math.min(maxX, previous.x));
        const y = Math.max(8, Math.min(maxY, previous.y));
        return x === previous.x && y === previous.y ? previous : { ...previous, x, y };
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(keepOnScreen);
    observer?.observe(container);
    window.addEventListener('resize', keepOnScreen);
    keepOnScreen();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', keepOnScreen);
    };
  }, []);

  const getBounds = () => toolbarRef.current?.closest<HTMLElement>('[aria-label="Visor de documentos"]')?.getBoundingClientRect();
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!appleTheme || event.button !== 0 || !toolbarRef.current) return;
    const toolbarRect = toolbarRef.current.getBoundingClientRect();
    const bounds = getBounds();
    if (!bounds) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOriginRef.current = { pointerId: event.pointerId, offsetX: event.clientX - toolbarRect.left, offsetY: event.clientY - toolbarRect.top };
    setDragPreview({ x: toolbarRect.left - bounds.left, y: toolbarRect.top - bounds.top });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragOriginRef.current?.pointerId !== event.pointerId) return;
    const bounds = getBounds();
    const toolbar = toolbarRef.current;
    if (!bounds || !toolbar) return;
    const maxX = Math.max(8, bounds.width - toolbar.offsetWidth - 8);
    const maxY = Math.max(8, bounds.height - toolbar.offsetHeight - 8);
    setDragPreview({
      x: Math.max(8, Math.min(maxX, event.clientX - bounds.left - dragOriginRef.current.offsetX)),
      y: Math.max(8, Math.min(maxY, event.clientY - bounds.top - dragOriginRef.current.offsetY)),
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragOriginRef.current?.pointerId !== event.pointerId || !dragPreview) return;
    const bounds = getBounds();
    const toolbar = toolbarRef.current;
    if (!bounds || !toolbar) return;
    const edge = Math.min(160, bounds.width * 0.16);
    const dock: ReaderToolbarDock = dragPreview.x <= edge
      ? 'left'
      : dragPreview.x + toolbar.offsetWidth >= bounds.width - edge ? 'right' : 'free';
    const maxY = Math.max(8, bounds.height - toolbar.offsetHeight - 8);
    setPosition({ dock, x: dragPreview.x, y: Math.max(8, Math.min(maxY, dragPreview.y)) });
    dragOriginRef.current = null;
    setDragPreview(null);
  };
  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const docks: Record<string, ReaderToolbarDock | undefined> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'bottom', ArrowUp: 'free' };
    const dock = docks[event.key];
    if (!dock || !appleTheme) return;
    event.preventDefault();
    const bounds = getBounds();
    setPosition((previous) => ({
      ...previous,
      dock,
      x: dock === 'left' ? 12 : dock === 'right' ? Math.max(12, (bounds?.width ?? window.innerWidth) - 220) : previous.x,
      y: dock === 'bottom' ? previous.y : Math.min(previous.y, Math.max(12, (bounds?.height ?? window.innerHeight) - 180)),
    }));
  };
  const renderedDock = dragPreview ? 'free' : position.dock;
  const placementStyle = dragPreview
    ? { left: `${dragPreview.x}px`, top: `${dragPreview.y}px` }
    : position.dock === 'left'
      ? { left: '0.75rem', top: `${position.y}px` }
      : position.dock === 'right'
        ? { right: '0.75rem', top: `${position.y}px` }
        : position.dock === 'free'
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : undefined;
  const voiceOptions = [
    { value: 'default', label: 'Voz automática' },
    ...controller.voices.map((voice) => ({ value: voice.voiceURI, label: `${voice.name} · ${voice.lang}` })),
  ];

  return (
    <div
      ref={toolbarRef}
      className={`reader-toolbar border-b bg-card/80 px-3 py-2 backdrop-blur${appleTheme ? ' reader-toolbar-interactive' : ''}`}
      data-draggable={appleTheme ? 'true' : undefined}
      data-dock={appleTheme ? renderedDock : undefined}
      data-dragging={dragPreview ? 'true' : undefined}
      data-orientation={appleTheme && (renderedDock === 'left' || renderedDock === 'right') ? 'vertical' : 'horizontal'}
      style={appleTheme ? placementStyle : undefined}
    >
      <div className="reader-toolbar-controls">
      {appleTheme && <button
        type="button"
        className="reader-toolbar-drag-handle"
        aria-label="Mover barra de lectura"
        title="Arrastra para mover · suelta en un lateral para ponerla vertical"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={moveWithKeyboard}
      ><GripVertical className="h-4 w-4" aria-hidden="true" /></button>}
      <div className="reader-toolbar-content flex flex-wrap items-center gap-1.5">
        <div className="reader-toolbar-label mr-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Volume2 className="h-4 w-4 text-primary" /> Lectura</div>
        {controller.status === 'speaking' ? (
          <Button size="sm" data-tts-control="true" onClick={controller.pause} title="Pausar lectura · Espacio"><Pause className="h-4 w-4" />Pausar</Button>
        ) : controller.status === 'paused' ? (
          <Button size="sm" data-tts-control="true" onClick={controller.resume} title="Reanudar lectura · Espacio"><Play className="h-4 w-4" />Reanudar</Button>
        ) : (
          <Button size="sm" data-tts-control="true" onClick={() => controller.play()} disabled={!controller.supported}><Play className="h-4 w-4" />Leer</Button>
        )}
        <Hint label="Párrafo anterior"><Button variant="ghost" size="icon-sm" onClick={controller.previous} disabled={!active} aria-label="Párrafo anterior"><SkipBack className="h-4 w-4" /></Button></Hint>
        <Hint label="Párrafo siguiente"><Button variant="ghost" size="icon-sm" onClick={controller.next} disabled={!active} aria-label="Párrafo siguiente"><SkipForward className="h-4 w-4" /></Button></Hint>
        <Hint label="Detener"><Button variant="ghost" size="icon-sm" onClick={controller.stop} disabled={!active && controller.status !== 'completed'} aria-label="Detener lectura"><Square className="h-4 w-4" /></Button></Hint>
        <Hint label={selectionLength ? `Leer únicamente los ${selectionLength} caracteres seleccionados` : 'Primero selecciona texto en el documento; después pulsa este botón'}>
          <Button variant={selectionLength ? 'secondary' : 'ghost'} size="sm" data-tts-control="true" onMouseDown={(event) => event.preventDefault()} onClick={onReadSelection} disabled={!controller.supported} aria-label="Leer selección"><ScanText className="h-4 w-4" />Leer selección{selectionLength > 0 && <span className="rounded bg-background/70 px-1 text-[10px] tabular-nums">{selectionLength}</span>}</Button>
        </Hint>
        {controller.status === 'completed' && <Button variant="ghost" size="sm" data-tts-control="true" onClick={controller.replay}><RotateCcw className="h-4 w-4" />Repetir</Button>}
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
        <span
          className="reader-toolbar-time ml-1 flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
          title={`Tiempo estimado según la velocidad real de la voz (${Math.round(controller.effectiveWpm)} palabras/min). Se ajusta mientras lees.`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {controller.status === 'completed' ? (
            <>Lectura completada · {formatDuration(controller.totalSeconds)}</>
          ) : controller.status === 'paused' ? (
            <>En pausa · quedan {formatDuration(controller.remainingSeconds)}</>
          ) : active ? (
            <>Quedan {formatDuration(controller.remainingSeconds)}<span className="hidden sm:inline"> · {controller.remainingWords} palabras</span></>
          ) : (
            <>≈ {formatDuration(controller.totalSeconds)} en total</>
          )}
        </span>
        <div className="ml-auto">{showPomodoro && <PomodoroTimer />}</div>
      </div>
      </div>
      {(active || controller.status === 'completed') && <Progress value={controller.progress * 100} className="mt-2" label="Progreso de lectura" />}
      {controller.error && <p role="alert" className="mt-2 text-xs text-destructive">{controller.error}</p>}
    </div>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { AudioLines, Pause, Play, SkipBack, SkipForward, Square, Trash2, Volume2 } from 'lucide-react';
import { useSpeechSpaceShortcut, useTts } from '@/hooks/useTts';
import { useAppStore } from '@/store/useAppStore';
import { countWords, extractWordRanges, splitParagraphs } from '@/lib/text';
import { formatDuration } from '@/lib/utils';
import { prepareSpeechSegments } from '@/lib/pronunciation';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Progress } from '@/components/ui/Progress';
import { PomodoroTimer } from './PomodoroTimer';

export default function TtsStudio() {
  const text = useAppStore((state) => state.ttsText);
  const setText = useAppStore((state) => state.setTtsText);
  const settings = useAppStore((state) => state.tts);
  const setSettings = useAppStore((state) => state.setTtsSettings);
  const autoScroll = useAppStore((state) => state.autoScroll);
  const pronunciationRules = useAppStore((state) => state.pronunciationRules);
  const readerFontSize = useAppStore((state) => state.readerFontSize);
  const readerLineHeight = useAppStore((state) => state.readerLineHeight);
  const sourceSegments = useMemo(() => splitParagraphs(text), [text]);
  const segments = useMemo(() => prepareSpeechSegments(sourceSegments, pronunciationRules), [sourceSegments, pronunciationRules]);
  const controller = useTts(segments);
  const sectionRef = useRef<HTMLElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  useSpeechSpaceShortcut(sectionRef, controller);
  const active = controller.status === 'speaking' || controller.status === 'paused' || controller.status === 'loading';

  useEffect(() => {
    if (!autoScroll || !controller.position?.word) return;
    readingRef.current?.querySelector('[data-active-word="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoScroll, controller.position]);

  const voiceOptions = [
    { value: 'default', label: 'Voz automática del sistema' },
    ...controller.voices.map((voice) => ({ value: voice.voiceURI, label: `${voice.name} · ${voice.lang}` })),
  ];

  return (
    <section ref={sectionRef} className="flex h-full min-h-0 flex-col" aria-label="Estudio de texto a voz">
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <div className="rounded-lg bg-violet-500/10 p-2 text-violet-500"><AudioLines className="h-5 w-5" /></div>
        <div>
          <h1 className="text-sm font-semibold">Estudio TTS</h1>
          <p className="text-xs text-muted-foreground">{countWords(text)} palabras · {segments.length} párrafos · guardado automático</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => controller.play(0, [{ id: 'voice-test', text: 'Esta es una prueba de la voz seleccionada en OpenHub.' }])} disabled={!controller.supported}><Volume2 className="h-4 w-4" />Probar voz</Button>
          <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('¿Vaciar el texto del estudio?')) { controller.stop(); setText(''); } }} disabled={!text}><Trash2 className="h-4 w-4" />Limpiar</Button>
          <PomodoroTimer />
        </div>
      </header>

      <div className="border-b bg-card/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {controller.status === 'speaking' ? (
            <Button data-tts-control="true" onClick={controller.pause}><Pause className="h-4 w-4" />Pausar</Button>
          ) : controller.status === 'paused' ? (
            <Button data-tts-control="true" onClick={controller.resume}><Play className="h-4 w-4" />Reanudar</Button>
          ) : (
            <Button data-tts-control="true" onClick={() => controller.play()} disabled={!segments.length || !controller.supported}><Play className="h-4 w-4" />Reproducir</Button>
          )}
          <Button variant="outline" size="icon" onClick={controller.previous} disabled={!active} aria-label="Párrafo anterior"><SkipBack className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={controller.next} disabled={!active} aria-label="Párrafo siguiente"><SkipForward className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={controller.stop} disabled={!active && controller.status !== 'completed'} aria-label="Detener"><Square className="h-4 w-4" /></Button>
          <span className="ml-2 text-xs text-muted-foreground">{active || controller.status === 'completed' ? `≈ ${formatDuration(controller.remainingSeconds)} restantes` : 'Haz clic en un párrafo para empezar desde él'}</span>
        </div>
        <Progress value={controller.progress * 100} className="mt-3" label="Progreso del estudio TTS" />
        {!controller.supported && <p role="alert" className="mt-2 text-xs text-destructive">Web Speech API no está disponible en este entorno.</p>}
        {controller.error && <p role="alert" className="mt-2 text-xs text-destructive">{controller.error}</p>}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.2fr)]">
        <div className="hidden min-h-0 flex-col border-r xl:flex">
          <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">TEXTO FUENTE</div>
          <Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-0 flex-1 rounded-none border-0 bg-card px-5 py-4 leading-7 shadow-none focus-visible:ring-0" placeholder="Escribe o pega tu texto aquí…" aria-label="Texto del estudio" />
          <div className="space-y-4 border-t bg-card p-4">
            <SelectField aria-label="Voz TTS" value={settings.voiceURI || 'default'} onValueChange={(voiceURI) => setSettings({ voiceURI: voiceURI === 'default' ? '' : voiceURI })} options={voiceOptions} className="w-full" />
            <VoiceSlider label="Velocidad" value={settings.rate} min={0.5} max={2.5} step={0.05} display={`${settings.rate.toFixed(2)}×`} onChange={(rate) => setSettings({ rate })} />
            <VoiceSlider label="Tono" value={settings.pitch} min={0.5} max={1.5} step={0.05} display={settings.pitch.toFixed(2)} onChange={(pitch) => setSettings({ pitch })} />
            <VoiceSlider label="Volumen" value={settings.volume} min={0} max={1} step={0.05} display={`${Math.round(settings.volume * 100)}%`} onChange={(volume) => setSettings({ volume })} />
          </div>
        </div>

        <div ref={readingRef} className="min-h-0 overflow-auto bg-card">
          <div className="border-b bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground">VISTA DE LECTURA</div>
          <div className="mx-auto max-w-3xl space-y-2 px-5 py-6 md:px-8">
            {sourceSegments.length ? sourceSegments.map((segment, index) => {
              const isActive = controller.position?.segmentId === segment.id;
              return (
                <button
                  key={segment.id}
                  type="button"
                  data-tts-control="true"
                  onClick={() => controller.play(index)}
                  className={`block w-full cursor-pointer rounded-r-md px-4 py-3 text-left transition hover:bg-accent/60 ${isActive ? 'tts-active-paragraph' : ''}`}
                  style={{ fontSize: `${readerFontSize / 100}rem`, lineHeight: readerLineHeight }}
                  aria-label={`Leer párrafo ${index + 1}`}
                >
                  <Paragraph text={segment.text} activeWord={isActive ? controller.position?.word ?? null : null} />
                </button>
              );
            }) : <p className="py-16 text-center text-sm text-muted-foreground">Agrega texto en el editor para comenzar.</p>}
          </div>
        </div>
      </div>

      <div className="max-h-[55vh] space-y-3 overflow-auto border-t bg-card p-4 xl:hidden">
        <details>
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Voz, velocidad, tono y volumen</summary>
          <div className="mt-3 space-y-4">
            <SelectField aria-label="Voz TTS compacta" value={settings.voiceURI || 'default'} onValueChange={(voiceURI) => setSettings({ voiceURI: voiceURI === 'default' ? '' : voiceURI })} options={voiceOptions} className="w-full" />
            <VoiceSlider label="Velocidad" value={settings.rate} min={0.5} max={2.5} step={0.05} display={`${settings.rate.toFixed(2)}×`} onChange={(rate) => setSettings({ rate })} />
            <VoiceSlider label="Tono" value={settings.pitch} min={0.5} max={1.5} step={0.05} display={settings.pitch.toFixed(2)} onChange={(pitch) => setSettings({ pitch })} />
            <VoiceSlider label="Volumen" value={settings.volume} min={0} max={1} step={0.05} display={`${Math.round(settings.volume * 100)}%`} onChange={(volume) => setSettings({ volume })} />
          </div>
        </details>
        <Textarea value={text} onChange={(event) => setText(event.target.value)} className="max-h-36" placeholder="Editar texto…" aria-label="Editar texto TTS" />
      </div>
    </section>
  );
}

function VoiceSlider({ label, value, display, onChange, ...range }: { label: string; value: number; display: string; onChange: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="grid grid-cols-[72px_1fr_52px] items-center gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Slider value={value} onValueChange={onChange} label={label} {...range} />
      <span className="text-right font-mono tabular-nums">{display}</span>
    </label>
  );
}

function Paragraph({ text, activeWord }: { text: string; activeWord: { start: number; end: number } | null }) {
  const words = extractWordRanges(text);
  if (!activeWord) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  words.forEach((word, index) => {
    if (word.start >= activeWord.end || word.end <= activeWord.start) return;
    parts.push(text.slice(cursor, word.start));
    parts.push(<mark key={index} data-active-word="true" className="tts-active-word">{word.text}</mark>);
    cursor = word.end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

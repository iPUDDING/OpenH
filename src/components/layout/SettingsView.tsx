import { useEffect, useState } from 'react';
import { BookOpenCheck, Database, Download, Keyboard, Monitor, Moon, Plus, RefreshCw, RotateCcw, ShieldCheck, Sun, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useAppStore } from '@/store/useAppStore';
import { useAppVersion } from '@/hooks/useAppVersion';
import { usePomodoro } from '@/hooks/usePomodoro';
import { cn, comboFromEvent, formatCombo } from '@/lib/utils';
import { createWorkspaceBackup, parseWorkspaceBackup } from '@/lib/workspace';
import { cancelSpeech } from '@/services/ttsService';
import { importWorkspaceDialog, isTauri, saveBinaryFile } from '@/services/fileSystemService';
import type { Theme } from '@/types';

export default function SettingsView() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const autoScroll = useAppStore((state) => state.autoScroll);
  const setAutoScroll = useAppStore((state) => state.setAutoScroll);
  const readerFontSize = useAppStore((state) => state.readerFontSize);
  const readerLineHeight = useAppStore((state) => state.readerLineHeight);
  const readerWidth = useAppStore((state) => state.readerWidth);
  const setReaderPreferences = useAppStore((state) => state.setReaderPreferences);
  const pomodoro = useAppStore((state) => state.pomodoro);
  const setPomodoro = useAppStore((state) => state.setPomodoroSettings);
  const pronunciationRules = useAppStore((state) => state.pronunciationRules);
  const setPronunciationRules = useAppStore((state) => state.setPronunciationRules);
  const recents = useAppStore((state) => state.recents);
  const clearRecents = useAppStore((state) => state.clearRecents);
  const keybindings = useAppStore((state) => state.keybindings);
  const setKeybinding = useAppStore((state) => state.setKeybinding);
  const resetKeybindings = useAppStore((state) => state.resetKeybindings);
  const paperTheme = useAppStore((state) => state.paperTheme);
  const setPaperTheme = useAppStore((state) => state.setPaperTheme);
  const timer = usePomodoro();
  const version = useAppVersion();
  const desktop = isTauri();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  // Captura de la combinación para reasignar un atajo.
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') { setRecording(null); return; }
      const combo = comboFromEvent(event);
      if (combo) {
        setKeybinding(recording, combo);
        setRecording(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, setKeybinding]);

  const addRule = () => {
    if (!from.trim() || !to.trim()) return;
    setPronunciationRules([...pronunciationRules, { id: globalThis.crypto?.randomUUID?.() ?? `rule-${Date.now()}-${Math.random()}`, from: from.trim(), to: to.trim(), enabled: true }]);
    setFrom('');
    setTo('');
  };

  const exportBackup = async () => {
    setBackupMessage(null);
    try {
      const saved = await saveBinaryFile(createWorkspaceBackup(), { suggestedName: `openhub-backup-${new Date().toISOString().slice(0, 10)}.json`, extensions: ['json'], filterName: 'Copia de OpenHub' });
      if (saved) setBackupMessage('Copia de seguridad exportada correctamente.');
    } catch (error) { setBackupMessage(error instanceof Error ? error.message : 'No se pudo exportar.'); }
  };

  const restoreBackup = async () => {
    setBackupMessage(null);
    try {
      const json = await importWorkspaceDialog();
      if (!json) return;
      const data = parseWorkspaceBackup(json);
      if (!window.confirm('Se reemplazarán los borradores y preferencias actuales por el contenido de la copia. ¿Continuar?')) return;
      cancelSpeech('settings-restore');
      useAppStore.setState(data);
      setBackupMessage('Copia restaurada. Los cambios ya están aplicados.');
    } catch (error) { setBackupMessage(error instanceof Error ? error.message : 'No se pudo restaurar la copia.'); }
  };

  return (
    <section className="h-full overflow-auto" aria-label="Ajustes de OpenHub">
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        <div className="mb-7"><h1 className="text-2xl font-bold tracking-tight">Ajustes</h1><p className="mt-1 text-sm text-muted-foreground">Personaliza OpenHub. Todos los cambios se guardan localmente.</p></div>
        <div className="space-y-5">
          <SettingsCard title="Apariencia" description="El tema Sistema sigue la configuración de Windows.">
            <div className="grid grid-cols-3 gap-2">
              {([{ id: 'light', label: 'Claro', icon: Sun }, { id: 'dark', label: 'Oscuro', icon: Moon }, { id: 'system', label: 'Sistema', icon: Monitor }] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTheme(id)} className={cn('flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm transition hover:bg-accent', theme === id && 'border-primary bg-primary/10 text-primary ring-1 ring-primary')}><Icon className="h-4 w-4" />{label}</button>
              ))}
            </div>
            <SettingRow title="Desplazamiento durante lectura" description="Centra suavemente la palabra que está sonando."><Switch checked={autoScroll} onCheckedChange={setAutoScroll} label="Auto-scroll TTS" /></SettingRow>
          </SettingsCard>

          <SettingsCard title="Temas" description="Diseños completos estilo Apple con cristal esmerilado y tipografía SF. En Apple Oscuro puedes arrastrar la barra de lectura y acoplarla verticalmente a un lateral; la posición se guarda en este equipo.">
            <div className="grid gap-3 sm:grid-cols-2">
              {APPLE_THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  aria-pressed={theme === option.id}
                  className={cn(
                    'group overflow-hidden rounded-xl border text-left transition hover:border-primary/60 hover:shadow-soft',
                    theme === option.id ? 'border-primary ring-2 ring-primary/40' : 'border-border',
                  )}
                >
                  <ThemePreview variant={option.id} />
                  <span className="block px-4 py-3">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{option.label}</span>
                      {theme === option.id && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Activo</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Lectura y accesibilidad" description="Se aplica al visor Markdown y a la vista del estudio TTS.">
            <RangeSetting label="Texto" value={readerFontSize} min={80} max={200} step={5} display={`${readerFontSize}%`} onChange={(readerFontSize) => setReaderPreferences({ readerFontSize })} />
            <RangeSetting label="Interlineado" value={readerLineHeight} min={1.4} max={2.2} step={0.05} display={readerLineHeight.toFixed(2)} onChange={(readerLineHeight) => setReaderPreferences({ readerLineHeight })} />
            <RangeSetting label="Ancho" value={readerWidth} min={600} max={1100} step={20} display={`${readerWidth} px`} onChange={(readerWidth) => setReaderPreferences({ readerWidth })} />
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium">Papel del documento</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Modo noche para el texto: cambia solo el fondo del documento, no el tema de la app.</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {([['white', 'Blanco', '#ffffff'], ['sepia', 'Sepia', '#fbf3e4'], ['gray', 'Gris', '#2b2b30'], ['black', 'Negro', '#000000']] as const).map(([id, label, swatch]) => (
                  <button key={id} onClick={() => setPaperTheme(id)} aria-pressed={paperTheme === id} className={cn('flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition hover:bg-accent', paperTheme === id && 'border-primary ring-1 ring-primary')}>
                    <span className="h-6 w-6 rounded-full border border-black/15 shadow-inner" style={{ background: swatch }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Pronunciación TTS" description="Sustituciones solo para la voz: el documento y sus posiciones de resaltado no cambian.">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Término (ej. Kubernetes)" aria-label="Término original" onKeyDown={(event) => { if (event.key === 'Enter') addRule(); }} />
              <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Se pronuncia (ej. ku ber ne tes)" aria-label="Pronunciación" onKeyDown={(event) => { if (event.key === 'Enter') addRule(); }} />
              <Button onClick={addRule} disabled={!from.trim() || !to.trim()} aria-label="Añadir regla"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              {pronunciationRules.map((rule) => (
                <div key={rule.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-lg bg-muted/40 p-2">
                  <Input value={rule.from} onChange={(event) => setPronunciationRules(pronunciationRules.map((item) => item.id === rule.id ? { ...item, from: event.target.value } : item))} aria-label={`Original: ${rule.from}`} className="h-8 bg-background" />
                  <Input value={rule.to} onChange={(event) => setPronunciationRules(pronunciationRules.map((item) => item.id === rule.id ? { ...item, to: event.target.value } : item))} aria-label={`Pronunciación de ${rule.from}`} className="h-8 bg-background" />
                  <Switch checked={rule.enabled} onCheckedChange={(enabled) => setPronunciationRules(pronunciationRules.map((item) => item.id === rule.id ? { ...item, enabled } : item))} label={`Activar regla ${rule.from}`} />
                  <Button variant="ghost" size="icon-sm" onClick={() => setPronunciationRules(pronunciationRules.filter((item) => item.id !== rule.id))} aria-label={`Eliminar regla ${rule.from}`}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              {!pronunciationRules.length && <p className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground"><BookOpenCheck className="mr-2 inline h-4 w-4" />Aún no hay reglas. Prueba con nombres técnicos, siglas o extranjerismos.</p>}
            </div>
          </SettingsCard>

          <SettingsCard title="Pomodoro" description="Duración de los ciclos de enfoque y descanso.">
            <RangeSetting label="Trabajo" value={pomodoro.workMinutes} min={5} max={60} step={1} display={`${pomodoro.workMinutes} min`} onChange={(workMinutes) => setPomodoro({ workMinutes })} />
            <RangeSetting label="Descanso" value={pomodoro.breakMinutes} min={1} max={30} step={1} display={`${pomodoro.breakMinutes} min`} onChange={(breakMinutes) => setPomodoro({ breakMinutes })} />
            <SettingRow title="Estadísticas de esta ejecución" description={`${timer.completedSessions} sesiones de trabajo completadas.`}><Button variant="outline" size="sm" onClick={timer.resetStats}><RotateCcw className="h-4 w-4" />Reiniciar</Button></SettingRow>
          </SettingsCard>

          <SettingsCard title="Actualizaciones" description={`Versión instalada: ${version}. Las descargas se verifican mediante firma antes de instalarse.`}>
            <SettingRow title="Buscar una nueva versión" description={desktop ? 'La comprobación usa internet solo al buscar o descargar. OpenHub sigue funcionando sin conexión.' : 'La actualización automática está disponible en la aplicación de escritorio para Windows.'}><Button variant="outline" size="sm" disabled={!desktop} onClick={() => window.dispatchEvent(new CustomEvent('openhub:check-updates'))}><RefreshCw className="h-4 w-4" />Buscar actualizaciones</Button></SettingRow>
          </SettingsCard>

          <SettingsCard title="Privacidad y almacenamiento" description="Sin cuentas, analítica ni sincronización externa.">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-500/5 p-3 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="font-medium">Tus documentos permanecen en tu equipo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Estado y preferencias: WebView2 / localStorage.<br />Datos de aplicación: %APPDATA%\com.openhub.app\</p></div></div>
            <SettingRow title="Historial de recientes" description={`${recents.length} elementos guardados. Limpiar no elimina archivos del disco.`}><Button variant="outline" size="sm" disabled={!recents.length} onClick={() => { if (window.confirm('¿Limpiar todo el historial de recientes?')) clearRecents(); }}><Trash2 className="h-4 w-4" />Limpiar</Button></SettingRow>
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium">Copia de seguridad del espacio de trabajo</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Incluye borradores, recientes, mapas, reglas TTS y preferencias en un JSON versionado.</p>
              <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void exportBackup()}><Download className="h-4 w-4" />Exportar copia</Button><Button variant="outline" size="sm" onClick={() => void restoreBackup()}><Upload className="h-4 w-4" />Restaurar copia</Button></div>
              {backupMessage && <p role="status" className="mt-3 rounded-md bg-primary/5 p-2 text-xs text-muted-foreground">{backupMessage}</p>}
            </div>
          </SettingsCard>

          <SettingsCard title="Atajos de teclado" description="Trabaja sin quitar las manos del teclado.">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {[['Ctrl + K', 'Paleta de comandos'], ['Alt + 1…4', 'Cambiar de herramienta'], ['Ctrl + O', 'Abrir documento'], ['F11', 'Pantalla completa'], ['Espacio', 'Pausar / reanudar lectura activa'], ['Ctrl + Shift + H', 'Mostrar / ocultar barra superior'], ['Ctrl + F / Ctrl + G', 'Buscar / siguiente en PDF y mapas'], ['Ctrl + rueda', 'Zoom en visor (MD/PDF) y mapas'], ['Ctrl + + / − / 0', 'Acercar, alejar o restablecer zoom'], ['Inicio / Fin / N / P', 'Navegar páginas PDF']].map(([keys, description]) => <div key={keys} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2"><span className="text-xs text-muted-foreground">{description}</span><kbd className="whitespace-nowrap rounded border bg-background px-2 py-1 font-mono text-[10px]"><Keyboard className="mr-1 inline h-3 w-3" />{keys}</kbd></div>)}
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium">Atajos personalizables</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pulsa «Grabar» y luego la combinación deseada. Escape cancela.</p>
              <div className="mt-3 space-y-2">
                {KEYBINDING_ACTIONS.map((action) => (
                  <div key={action.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                    <span className="text-xs text-muted-foreground">{action.label}</span>
                    <div className="flex items-center gap-2">
                      <kbd className="whitespace-nowrap rounded border bg-background px-2 py-1 font-mono text-[10px]">{recording === action.id ? 'Pulsa teclas…' : formatCombo(keybindings[action.id] ?? '')}</kbd>
                      <Button variant="outline" size="sm" onClick={() => setRecording(recording === action.id ? null : action.id)}>{recording === action.id ? 'Cancelar' : 'Grabar'}</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-3" onClick={resetKeybindings}><RotateCcw className="h-4 w-4" />Restablecer atajos</Button>
            </div>
          </SettingsCard>

          <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" />OpenHub {version} · Tauri v2 + React 18</div>
        </div>
      </div>
    </section>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">{title}</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">{description}</p><div className="space-y-5">{children}</div></section>;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-5 border-t pt-4"><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>{children}</div>;
}

function RangeSetting({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return <label className="grid grid-cols-[92px_1fr_66px] items-center gap-4 text-sm"><span>{label}</span><Slider value={value} min={min} max={max} step={step} onValueChange={onChange} label={label} /><span className="text-right font-mono text-xs tabular-nums">{display}</span></label>;
}

const KEYBINDING_ACTIONS: Array<{ id: string; label: string }> = [
  { id: 'palette', label: 'Paleta de comandos' },
  { id: 'toggleHeader', label: 'Mostrar / ocultar barra superior' },
  { id: 'open', label: 'Abrir documento' },
  { id: 'tool1', label: 'Ir a Documentos' },
  { id: 'tool2', label: 'Ir a Estudio TTS' },
  { id: 'tool3', label: 'Ir a Mapas mentales' },
  { id: 'tool4', label: 'Ir a Ajustes' },
];

const APPLE_THEME_OPTIONS: Array<{ id: Theme; label: string; description: string }> = [
  { id: 'apple-light', label: 'Apple Claro', description: 'Cristal esmerilado, documento limpio y barra de lectura flotante en azul Apple.' },
  { id: 'apple-dark', label: 'Apple Oscuro', description: 'El mismo diseño en modo oscuro macOS, con acentos azules suaves sobre carbón y barra de lectura movible y vertical en los laterales.' },
  { id: 'apple-outline', label: 'Apple con Índice', description: 'Tema claro con el panel de índice del documento abierto a la derecha.' },
  { id: 'apple-focus', label: 'Apple Foco', description: 'Sin barra lateral: solo el documento centrado y una barra flotante mínima.' },
];

/** Miniatura CSS de cada tema: reproduce la estructura de la ventana sin cargar imágenes. */
function ThemePreview({ variant }: { variant: Theme }) {
  const dark = variant === 'apple-dark';
  const shell = dark ? 'bg-[#141416] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]';
  const panel = dark ? 'bg-[#232328]/80' : 'bg-white/80';
  const line = dark ? 'bg-white/25' : 'bg-black/15';
  const lineStrong = dark ? 'bg-white/60' : 'bg-black/45';
  const accent = 'bg-[#007aff]';
  const highlight = dark ? 'bg-[#3a4a5e]' : 'bg-[#dce9f7]';
  const showSidebar = variant !== 'apple-focus';
  const showOutline = variant === 'apple-outline';
  return (
    <span className={cn('block h-28 overflow-hidden rounded-t-[11px] p-2', shell)} aria-hidden="true">
      <span className="flex h-full flex-col overflow-hidden rounded-lg border border-black/10 shadow-sm dark:border-white/10">
        <span className={cn('flex h-5 shrink-0 items-center gap-1.5 px-2', panel)}>
          <span className={cn('h-1 w-10 rounded-full', lineStrong)} />
        </span>
        <span className="flex min-h-0 flex-1">
          {showSidebar && (
            <span className={cn('flex w-9 shrink-0 flex-col gap-1.5 p-1.5', panel)}>
              <span className={cn('h-1.5 w-full rounded-full', accent)} />
              <span className={cn('h-1.5 w-4/5 rounded-full', line)} />
              <span className={cn('h-1.5 w-3/5 rounded-full', line)} />
              <span className={cn('h-1.5 w-4/5 rounded-full', line)} />
            </span>
          )}
          <span className={cn('relative flex min-w-0 flex-1 flex-col gap-1.5 p-2', dark ? 'bg-[#1a1a1e]' : 'bg-white')}>
            <span className={cn('h-2 w-2/3 rounded-full', lineStrong)} />
            <span className={cn('h-1.5 w-1/2 rounded-full', line)} />
            <span className={cn('h-1.5 w-full rounded-full', line)} />
            <span className={cn('h-1.5 w-5/6 rounded-full', highlight)} />
            <span className={cn('h-1.5 w-full rounded-full', line)} />
            <span className={cn('absolute bottom-1.5 left-1/2 flex h-4 w-3/4 -translate-x-1/2 items-center gap-1 rounded-full px-1.5 shadow-md', panel)}>
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', accent)} />
              <span className={cn('h-1 flex-1 rounded-full', line)} />
              <span className={cn('h-1 w-4 rounded-full', lineStrong)} />
            </span>
          </span>
          {showOutline && (
            <span className={cn('flex w-9 shrink-0 flex-col gap-1.5 p-1.5', panel)}>
              <span className={cn('h-1.5 w-3/4 rounded-full', lineStrong)} />
              <span className={cn('h-1.5 w-full rounded-full', line)} />
              <span className={cn('h-1.5 w-5/6 rounded-full', line)} />
              <span className={cn('h-1.5 w-2/3 rounded-full', line)} />
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

import { useState } from 'react';
import { BookOpenCheck, Database, Download, Keyboard, Monitor, Moon, Plus, RefreshCw, RotateCcw, ShieldCheck, Sun, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { useAppStore } from '@/store/useAppStore';
import { useAppVersion } from '@/hooks/useAppVersion';
import { usePomodoro } from '@/hooks/usePomodoro';
import { cn } from '@/lib/utils';
import { createWorkspaceBackup, parseWorkspaceBackup } from '@/lib/workspace';
import { cancelSpeech } from '@/services/ttsService';
import { importWorkspaceDialog, isTauri, saveBinaryFile } from '@/services/fileSystemService';

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
  const timer = usePomodoro();
  const version = useAppVersion();
  const desktop = isTauri();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

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

          <SettingsCard title="Lectura y accesibilidad" description="Se aplica al visor Markdown y a la vista del estudio TTS.">
            <RangeSetting label="Texto" value={readerFontSize} min={80} max={200} step={5} display={`${readerFontSize}%`} onChange={(readerFontSize) => setReaderPreferences({ readerFontSize })} />
            <RangeSetting label="Interlineado" value={readerLineHeight} min={1.4} max={2.2} step={0.05} display={readerLineHeight.toFixed(2)} onChange={(readerLineHeight) => setReaderPreferences({ readerLineHeight })} />
            <RangeSetting label="Ancho" value={readerWidth} min={600} max={1100} step={20} display={`${readerWidth} px`} onChange={(readerWidth) => setReaderPreferences({ readerWidth })} />
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

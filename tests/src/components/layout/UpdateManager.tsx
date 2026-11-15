import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '@/services/fileSystemService';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';

const DISMISSED_KEY = 'openhub-update-dismissed';
type DialogStatus = 'hidden' | 'checking' | 'latest' | 'available' | 'downloading' | 'installing' | 'error';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Error desconocido.');
}
function releaseUpdate(update: Update | null): void {
  if (update) void update.close().catch(() => undefined);
}

export function UpdateManager() {
  const [status, setStatus] = useState<DialogStatus>('hidden');
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const checkUpdates = useCallback(async (manual: boolean) => {
    if (!isTauri() || busyRef.current) return;
    busyRef.current = true;
    const request = ++requestRef.current;
    setError('');
    if (manual) setStatus('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const available = await check();
      if (request !== requestRef.current) {
        releaseUpdate(available);
        return;
      }
      if (available) {
        let dismissed: string | null = null;
        try { dismissed = localStorage.getItem(DISMISSED_KEY); } catch { /* La comprobación sigue disponible sin persistencia. */ }
        if (manual || dismissed !== available.version) {
          setUpdate(available);
          setDownloaded(0);
          setTotal(0);
          setStatus('available');
        } else {
          releaseUpdate(available);
        }
      } else if (manual) {
        setUpdate(null);
        setStatus('latest');
      }
    } catch (checkError) {
      // El arranque offline es silencioso; una acción manual sí informa el motivo.
      if (manual && request === requestRef.current) {
        setUpdate(null);
        setError(`No se pudo comprobar la actualización. Revisa tu conexión y vuelve a intentarlo.\n\n${message(checkError)}`);
        setStatus('error');
      }
    } finally {
      if (request === requestRef.current) busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const timeout = window.setTimeout(() => void checkUpdates(false), 1800);
    const onManualCheck = () => void checkUpdates(true);
    window.addEventListener('openhub:check-updates', onManualCheck);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('openhub:check-updates', onManualCheck);
      requestRef.current += 1;
      busyRef.current = false;
    };
  }, [checkUpdates]);

  const close = () => {
    if (status === 'downloading' || status === 'installing') return;
    if (status === 'available' && update) {
      try { localStorage.setItem(DISMISSED_KEY, update.version); } catch { /* El aviso puede volver si el almacenamiento está bloqueado. */ }
    }
    releaseUpdate(update);
    setUpdate(null);
    requestRef.current += 1;
    busyRef.current = false;
    setStatus('hidden');
  };

  useEffect(() => {
    if (status === 'hidden') {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
      previousFocusRef.current = null;
      return;
    }
    if (!previousFocusRef.current) previousFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusTimer = window.setTimeout(() => {
      if (!dialog || dialog.contains(document.activeElement)) return;
      const target = dialog.querySelector<HTMLElement>('[data-dialog-primary]') ?? dialog.querySelector<HTMLElement>('button:not([disabled])') ?? dialog;
      target.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [status]);

  const install = async () => {
    if (!update || busyRef.current) return;
    busyRef.current = true;
    const request = ++requestRef.current;
    setError('');
    setDownloaded(0);
    setTotal(0);
    setStatus('downloading');
    try {
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (request !== requestRef.current) return;
        if (event.event === 'Started') {
          received = 0;
          setDownloaded(0);
          setTotal(event.data.contentLength ?? 0);
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          setDownloaded(received);
        }
      });
      if (request !== requestRef.current) return;
      setStatus('installing');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (installError) {
      if (request !== requestRef.current) return;
      setError(`No se pudo instalar la actualización. Tus documentos y ajustes locales no fueron modificados.\n\n${message(installError)}`);
      setStatus('error');
      busyRef.current = false;
    }
  };

  if (status === 'hidden') return null;
  const busy = status === 'checking' || status === 'downloading' || status === 'installing';
  const progress = total > 0 ? Math.min(100, (downloaded / total) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="update-title" tabIndex={-1} className="w-full max-w-md rounded-xl border bg-card p-5 text-card-foreground shadow-2xl outline-none animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              {status === 'latest' ? <CheckCircle2 className="h-5 w-5" /> : status === 'error' ? <AlertTriangle className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="update-title" className="font-semibold">
                {status === 'checking' && 'Buscando actualizaciones'}
                {status === 'latest' && 'OpenHub está actualizado'}
                {status === 'available' && `Nueva versión ${update?.version ?? ''}`}
                {status === 'downloading' && 'Descargando actualización'}
                {status === 'installing' && 'Instalando y reiniciando'}
                {status === 'error' && 'Actualización no completada'}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Actualizaciones firmadas desde OpenH-updates</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} disabled={busy} aria-label="Cerrar actualización"><X className="h-4 w-4" /></Button>
        </div>

        <div className="mt-4 text-sm">
          {status === 'checking' && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />Consultando la release más reciente…</div>}
          {status === 'latest' && <p className="text-muted-foreground">Ya tienes instalada la versión más reciente publicada.</p>}
          {status === 'available' && (
            <>
              <p className="text-muted-foreground">Hay una nueva versión de OpenHub. Se descargará, verificará su firma y después se reiniciará la aplicación.</p>
              {update?.body && <div className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">{update.body}</div>}
            </>
          )}
          {(status === 'downloading' || status === 'installing') && (
            <div>
              <Progress value={status === 'installing' ? 100 : progress} label="Progreso de actualización" />
              <p className="mt-2 text-xs text-muted-foreground">
                {status === 'installing' ? 'Instalación verificada. OpenHub se reiniciará…' : total > 0 ? `${Math.round(progress)}% · ${(downloaded / 1048576).toFixed(1)} de ${(total / 1048576).toFixed(1)} MB` : `${(downloaded / 1048576).toFixed(1)} MB descargados`}
              </p>
            </div>
          )}
          {status === 'error' && <p role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-destructive/10 p-3 text-xs leading-5 text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {!busy && <Button variant="ghost" onClick={close}>{status === 'available' ? 'Más tarde' : 'Cerrar'}</Button>}
          {status === 'available' && <Button autoFocus data-dialog-primary onClick={() => void install()}><Download className="h-4 w-4" />Descargar y actualizar</Button>}
          {status === 'error' && <Button onClick={() => { busyRef.current = false; if (update) void install(); else void checkUpdates(true); }}><RefreshCw className="h-4 w-4" />Reintentar</Button>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

import { useCallback, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@/services/fileSystemService';

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isTauri() || (typeof document !== 'undefined' && document.fullscreenEnabled);

  const refresh = useCallback(async () => {
    try {
      if (isTauri()) setFullscreen(await getCurrentWindow().isFullscreen());
      else setFullscreen(Boolean(document.fullscreenElement));
    } catch {
      // La consulta puede fallar durante el cierre de la ventana nativa.
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    setError(null);
    try {
      if (isTauri()) {
        const appWindow = getCurrentWindow();
        const next = !(await appWindow.isFullscreen());
        await appWindow.setFullscreen(next);
        setFullscreen(next);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        throw new Error('Pantalla completa no disponible en este contexto.');
      }
    } catch (cause) {
      setError(`No se pudo cambiar la pantalla completa: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const sync = () => { if (mounted) void refresh(); };
    sync();
    document.addEventListener('fullscreenchange', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('focus', sync);
    return () => {
      mounted = false;
      document.removeEventListener('fullscreenchange', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('focus', sync);
    };
  }, [refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'F11' && event.code !== 'F11') || event.repeat) return;
      event.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [toggleFullscreen]);

  return { fullscreen, supported, error, toggleFullscreen };
}

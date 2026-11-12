import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DocumentViewer from '@/components/tools/viewer/DocumentViewer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useAppStore } from '@/store/useAppStore';
import type { ToolId } from '@/types';

const TtsStudio = lazy(() => import('@/components/tools/tts/TtsStudio'));
const MarkmapStudio = lazy(() => import('@/components/tools/markmap/MarkmapStudio'));
const SettingsView = lazy(() => import('@/components/layout/SettingsView'));

const toolOrder: ToolId[] = ['viewer', 'tts', 'markmap', 'settings'];

export default function App() {
  const activeTool = useAppStore((state) => state.activeTool);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const theme = useAppStore((state) => state.theme);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [visited, setVisited] = useState<Set<ToolId>>(() => new Set(['viewer']));
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setVisited((current) => current.has(activeTool) ? current : new Set(current).add(activeTool));
  }, [activeTool]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setCommandsOpen((open) => !open);
        return;
      }
      if (event.altKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        setActiveTool(toolOrder[Number(event.key) - 1]);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'o') {
        event.preventDefault();
        setActiveTool('viewer');
        window.dispatchEvent(new CustomEvent('openhub:open'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveTool]);

  const panel = (id: ToolId, children: React.ReactNode) => (
    <div key={id} className="h-full min-h-0" style={{ display: activeTool === id ? 'block' : 'none' }} aria-hidden={activeTool !== id}>
      <ErrorBoundary name={id === 'tts' ? 'el estudio TTS' : id === 'markmap' ? 'el mapa mental' : id === 'settings' ? 'los ajustes' : 'el visor'}>
        {children}
      </ErrorBoundary>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header onToggleSidebar={() => setSidebarOpen((open) => !open)} onOpenCommands={() => setCommandsOpen(true)} />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} />
        <main ref={mainRef} className="min-w-0 flex-1 bg-background">
          {panel('viewer', <DocumentViewer />)}
          {visited.has('tts') && panel('tts', <Suspense fallback={<ModuleFallback />}><TtsStudio /></Suspense>)}
          {visited.has('markmap') && panel('markmap', <Suspense fallback={<ModuleFallback />}><MarkmapStudio /></Suspense>)}
          {visited.has('settings') && panel('settings', <Suspense fallback={<ModuleFallback />}><SettingsView /></Suspense>)}
        </main>
      </div>
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
    </div>
  );
}

function ModuleFallback() {
  return <div className="grid h-full place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Cargando módulo…</div></div>;
}

import { AudioLines, BrainCircuit, Clock3, FileText, Settings, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Hint } from '@/components/ui/Tooltip';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import type { RecentDocument, ToolId } from '@/types';

const tools = [
  { id: 'viewer' as const, label: 'Documentos', icon: FileText, shortcut: 'Alt+1', color: 'text-blue-500' },
  { id: 'tts' as const, label: 'Estudio TTS', icon: AudioLines, shortcut: 'Alt+2', color: 'text-violet-500' },
  { id: 'markmap' as const, label: 'Mapas mentales', icon: BrainCircuit, shortcut: 'Alt+3', color: 'text-emerald-500' },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings, shortcut: 'Alt+4', color: 'text-slate-500' },
];

export function Sidebar({ open, headerHidden = false }: { open: boolean; headerHidden?: boolean }) {
  const active = useAppStore((state) => state.activeTool);
  const setActive = useAppStore((state) => state.setActiveTool);
  const recents = useAppStore((state) => state.recents);
  const removeRecent = useAppStore((state) => state.removeRecent);

  const select = (id: ToolId) => setActive(id);
  const openRecent = (recent: RecentDocument) => window.dispatchEvent(new CustomEvent('openhub:recent', { detail: recent }));

  return (
    <aside className={cn('z-30 flex shrink-0 flex-col border-r bg-card transition-[width] duration-200 max-lg:absolute max-lg:bottom-0 max-lg:left-0 max-lg:shadow-xl', headerHidden ? 'max-lg:top-0' : 'max-lg:top-14', open ? 'w-60' : 'w-16 max-lg:w-0 max-lg:overflow-hidden')} aria-label="Navegación principal">
      <nav className="space-y-1 p-2">
        {tools.map(({ id, label, icon: Icon, shortcut, color }) => {
          const button = (
            <Button
              variant={active === id ? 'secondary' : 'ghost'}
              className={cn('w-full', open ? 'justify-start px-3' : 'justify-center px-0', active === id && 'bg-primary/10 text-primary')}
              onClick={() => select(id)}
              aria-current={active === id ? 'page' : undefined}
              title={!open ? `${label} (${shortcut})` : undefined}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active === id ? color : '')} />
              {open && <><span className="truncate">{label}</span><kbd className="ml-auto text-[10px] font-normal text-muted-foreground">{shortcut}</kbd></>}
            </Button>
          );
          return open ? <div key={id}>{button}</div> : <Hint key={id} label={`${label} · ${shortcut}`}>{button}</Hint>;
        })}
      </nav>
      {open && (
        <div className="flex min-h-0 flex-1 flex-col border-t pt-3">
          <div className="mb-2 flex items-center gap-2 px-4 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />RECIENTES</div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {recents.length ? recents.map((recent) => (
              <div key={recent.id} className="group flex items-center rounded-md hover:bg-accent">
                <button className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left" onClick={() => openRecent(recent)} title={recent.path || recent.name}>
                  <FileText className={cn('h-3.5 w-3.5 shrink-0', recent.kind === 'pdf' ? 'text-red-400' : 'text-blue-400')} />
                  <span className="min-w-0"><span className="block truncate text-xs">{recent.name}</span><span className="block text-[10px] text-muted-foreground">{new Date(recent.openedAt).toLocaleDateString()}</span></span>
                </button>
                <button className="mr-1 flex rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100" onClick={() => removeRecent(recent.id)} aria-label={`Quitar ${recent.name} de recientes`}><X className="h-3 w-3" /></button>
              </div>
            )) : <p className="px-3 py-5 text-center text-xs leading-5 text-muted-foreground">Los documentos que abras aparecerán aquí.</p>}
          </div>
        </div>
      )}
      {open && <div className="border-t p-3 text-[10px] leading-4 text-muted-foreground"><Trash2 className="mr-1 inline h-3 w-3" />Datos solo en este equipo.<br />Ningún contenido sale de OpenHub.</div>}
    </aside>
  );
}

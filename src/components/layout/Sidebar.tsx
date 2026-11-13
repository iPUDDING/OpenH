import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, BrainCircuit, Check, Clock3, FilePlus2, FileText, FolderOpen, Pencil, Settings, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  const activeDocumentId = useAppStore((state) => state.activeDocumentId);
  const renameRecent = useAppStore((state) => state.renameRecent);
  const removeRecent = useAppStore((state) => state.removeRecent);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const renameCancelledRef = useRef(false);
  const editingActiveRef = useRef<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const select = (id: ToolId) => setActive(id);
  const openRecent = (recent: RecentDocument) => window.dispatchEvent(new CustomEvent('openhub:recent', { detail: recent }));
  const createText = () => {
    const names = new Set(recents.map((recent) => recent.name.toLocaleLowerCase()));
    let index = 1;
    while (names.has(`texto ${index}.md`)) index += 1;
    window.dispatchEvent(new CustomEvent('openhub:new-document', { detail: { name: `Texto ${index}.md` } }));
  };
  const openFile = () => window.dispatchEvent(new CustomEvent('openhub:open'));

  const startRename = useCallback((recent: RecentDocument) => {
    renameCancelledRef.current = false;
    editingActiveRef.current = recent.id;
    setDraftName(recent.name);
    setEditingId(recent.id);
  }, []);

  const cancelRename = useCallback(() => {
    renameCancelledRef.current = true;
    editingActiveRef.current = null;
    setEditingId(null);
  }, []);

  const commitRename = useCallback(() => {
    const currentEditingId = editingActiveRef.current;
    if (renameCancelledRef.current || !currentEditingId) return;
    editingActiveRef.current = null;
    setEditingId(null);
    const result = renameRecent(currentEditingId, draftName);
    if (result) {
      window.dispatchEvent(new CustomEvent('openhub:document-renamed', { detail: result }));
    }
  }, [draftName, renameRecent]);

  useEffect(() => {
    if (!editingId || !renameInputRef.current) return;
    const input = renameInputRef.current;
    input.focus();
    const dot = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }, [editingId]);

  useEffect(() => {
    if (editingId && !recents.some((item) => item.id === editingId)) {
      editingActiveRef.current = null;
      setEditingId(null);
    }
  }, [editingId, recents]);

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
          <div className="grid grid-cols-2 gap-1.5 px-2 pb-3">
            <Button variant="outline" size="sm" className="min-w-0 gap-1.5 px-2 text-[11px]" onClick={createText} aria-label="Crear texto nuevo"><FilePlus2 className="h-3.5 w-3.5" />Nuevo texto</Button>
            <Button variant="outline" size="sm" className="min-w-0 gap-1.5 px-2 text-[11px]" onClick={openFile} aria-label="Abrir archivo desde Recientes"><FolderOpen className="h-3.5 w-3.5" />Abrir archivo</Button>
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {recents.length ? recents.map((recent) => {
              const isCurrent = active === 'viewer' && recent.id === activeDocumentId;
              const isEditing = editingId === recent.id;
              return (
                <div key={recent.id} className={cn('group flex items-center rounded-md hover:bg-accent', isCurrent && 'bg-primary/5')}>
                  {isEditing ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                      <FileText className={cn('h-3.5 w-3.5 shrink-0', recent.kind === 'pdf' ? 'text-red-400' : 'text-blue-400')} />
                      <Input
                        ref={renameInputRef}
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitRename();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={commitRename}
                        maxLength={260}
                        aria-label={`Nuevo nombre para ${recent.name}`}
                        className="h-7 min-w-0 flex-1 px-1.5 text-xs"
                      />
                      <button type="button" className="flex shrink-0 rounded p-1 text-emerald-600 hover:bg-background dark:text-emerald-400" onMouseDown={(event) => event.preventDefault()} onClick={commitRename} aria-label={`Guardar nombre de ${recent.name}`}><Check className="h-3 w-3" /></button>
                      <button type="button" className="flex shrink-0 rounded p-1 text-muted-foreground hover:bg-background" onMouseDown={(event) => event.preventDefault()} onClick={cancelRename} aria-label={`Cancelar cambio de nombre de ${recent.name}`}><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                        onClick={() => openRecent(recent)}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          startRename(recent);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'F2') {
                            event.preventDefault();
                            startRename(recent);
                          }
                        }}
                        title={`${recent.path || recent.name} (doble clic para renombrar)`}
                      >
                        <FileText className={cn('h-3.5 w-3.5 shrink-0', recent.kind === 'pdf' ? 'text-red-400' : 'text-blue-400')} />
                        <span className="min-w-0"><span className="block truncate text-xs">{recent.name}</span><span className="block text-[10px] text-muted-foreground">{new Date(recent.openedAt).toLocaleDateString()}</span></span>
                      </button>
                      <button
                        type="button"
                        className={cn('flex shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100', isCurrent ? 'opacity-60' : 'opacity-0')}
                        onClick={() => startRename(recent)}
                        aria-label={`Renombrar ${recent.name}`}
                        title="Cambiar nombre dentro de OpenHub"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="mr-1 flex shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                        onClick={() => removeRecent(recent.id)}
                        aria-label={`Quitar ${recent.name} de recientes`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            }) : <p className="px-3 py-5 text-center text-xs leading-5 text-muted-foreground">Crea un texto o abre un archivo para verlo aquí.</p>}
          </div>
        </div>
      )}
      {open && <div className="border-t p-3 text-[10px] leading-4 text-muted-foreground"><Trash2 className="mr-1 inline h-3 w-3" />Datos solo en este equipo.<br />Ningún contenido sale de OpenHub.</div>}
    </aside>
  );
}

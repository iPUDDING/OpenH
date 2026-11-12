import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AudioLines, BrainCircuit, Clock3, FileText, FolderOpen, Moon, PanelLeft, Play, Search, Settings, SkipForward, Sun } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/store/useAppStore';
import { usePomodoro } from '@/hooks/usePomodoro';
import { normalizeSearchText } from '@/lib/text';
import type { ToolId } from '@/types';

interface Command {
  id: string;
  title: string;
  detail: string;
  keywords: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette({ open, onClose, onToggleSidebar }: { open: boolean; onClose: () => void; onToggleSidebar: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const recents = useAppStore((state) => state.recents);
  const pomodoro = usePomodoro();

  const commands = useMemo<Command[]>(() => {
    const navigate = (id: ToolId, title: string, detail: string, icon: Command['icon']): Command => ({
      id: `tool-${id}`, title, detail, keywords: `ir navegar ${id}`, icon, action: () => setActiveTool(id),
    });
    return [
      navigate('viewer', 'Ir a Documentos', 'Visor Markdown, TXT y PDF', FileText),
      navigate('tts', 'Ir a Estudio TTS', 'Lectura por voz y pronunciación', AudioLines),
      navigate('markmap', 'Ir a Mapas mentales', 'Editor y canvas Markmap', BrainCircuit),
      navigate('settings', 'Ir a Ajustes', 'Lectura, privacidad y copias de seguridad', Settings),
      { id: 'open', title: 'Abrir documento…', detail: 'Ctrl+O', keywords: 'archivo pdf markdown txt', icon: FolderOpen, action: () => { setActiveTool('viewer'); window.dispatchEvent(new CustomEvent('openhub:open')); } },
      { id: 'theme', title: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro', detail: 'Alternar apariencia', keywords: 'tema oscuro claro apariencia', icon: theme === 'dark' ? Sun : Moon, action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'sidebar', title: 'Mostrar u ocultar barra lateral', detail: 'Ampliar el área de trabajo', keywords: 'panel navegacion sidebar', icon: PanelLeft, action: onToggleSidebar },
      { id: 'pomodoro', title: pomodoro.running ? 'Pausar Pomodoro' : 'Iniciar Pomodoro', detail: 'Controlar la sesión actual', keywords: 'timer enfoque descanso', icon: Play, action: pomodoro.toggle },
      { id: 'skip', title: 'Saltar a la siguiente sesión', detail: 'Trabajo ↔ descanso', keywords: 'pomodoro saltar break', icon: SkipForward, action: pomodoro.skip },
      ...recents.map((recent): Command => ({
        id: `recent-${recent.id}`,
        title: recent.name,
        detail: `Reabrir ${recent.kind === 'pdf' ? 'PDF' : 'Markdown'}`,
        keywords: `reciente ${recent.path ?? ''}`,
        icon: Clock3,
        action: () => { setActiveTool('viewer'); window.dispatchEvent(new CustomEvent('openhub:recent', { detail: recent })); },
      })),
    ];
  }, [onToggleSidebar, pomodoro, recents, setActiveTool, setTheme, theme]);

  const filtered = useMemo(() => {
    const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return commands;
    return commands.filter((command) => {
      const haystack = normalizeSearchText(`${command.title} ${command.detail} ${command.keywords}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setSelected(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    document.querySelector(`[data-command-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;
  const run = (command: Command) => {
    onClose();
    window.setTimeout(command.action, 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/35 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Paleta de comandos" className="w-full max-w-xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((index) => Math.min(filtered.length - 1, index + 1)); }
              if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((index) => Math.max(0, index - 1)); }
              if (event.key === 'Enter' && filtered[selected]) { event.preventDefault(); run(filtered[selected]); }
              if (event.key === 'Tab') { event.preventDefault(); setSelected((index) => (index + (event.shiftKey ? -1 : 1) + filtered.length) % Math.max(1, filtered.length)); }
            }}
            className="h-14 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            placeholder="Busca herramientas, comandos o documentos…"
            aria-label="Buscar comandos"
            aria-controls="command-results"
          />
          <kbd className="rounded border bg-muted px-2 py-1 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length ? filtered.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                data-command-index={index}
                role="option"
                aria-selected={selected === index}
                onMouseEnter={() => setSelected(index)}
                onClick={() => run(command)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${selected === index ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{command.title}</span><span className="block truncate text-xs text-muted-foreground">{command.detail}</span></span>
                {selected === index && <kbd className="text-[10px] text-muted-foreground">↵</kbd>}
              </button>
            );
          }) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay comandos que coincidan con “{query}”.</p>}
        </div>
        <footer className="flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground"><span>↑↓ Navegar</span><span>↵ Ejecutar</span><span>Ctrl+K Abrir</span></footer>
      </section>
    </div>,
    document.body,
  );
}

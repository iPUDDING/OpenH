import { CloudOff, Menu, Moon, PanelTopClose, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Hint } from '@/components/ui/Tooltip';
import { useAppStore } from '@/store/useAppStore';
import { useAppVersion } from '@/hooks/useAppVersion';

export function Header({ onToggleSidebar, onOpenCommands, onHide }: { onToggleSidebar: () => void; onOpenCommands: () => void; onHide: () => void }) {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const version = useAppVersion();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3 md:px-4">
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Alternar barra lateral"><Menu className="h-5 w-5" /></Button>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-black text-primary-foreground shadow-sm">O</div>
        <div><div className="text-sm font-bold tracking-tight">OpenHub</div><div className="hidden text-[10px] font-medium uppercase tracking-[.18em] text-muted-foreground sm:block">DevSuite Hub</div></div>
      </div>
      <span className="ml-2 hidden items-center gap-1.5 rounded-full border bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 sm:flex"><CloudOff className="h-3.5 w-3.5" />100% offline</span>
      <button onClick={onOpenCommands} className="ml-auto flex h-8 w-56 items-center gap-2 whitespace-nowrap rounded-md border bg-background px-3 text-xs text-muted-foreground transition hover:bg-accent max-md:w-9 max-md:justify-center max-md:px-0" aria-label="Abrir paleta de comandos">
        <Search className="h-3.5 w-3.5 shrink-0" /><span className="max-md:hidden">Buscar comandos…</span><kbd className="ml-auto whitespace-nowrap text-[9px] max-md:hidden">Ctrl K</kbd>
      </button>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground lg:inline">v{version}</span>
        <Hint label={isDark ? 'Usar tema claro' : 'Usar tema oscuro'}>
          <Button variant="ghost" size="icon-sm" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Cambiar tema">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
        </Hint>
        <Hint label="Ocultar barra superior · Ctrl+Shift+H">
          <Button variant="ghost" size="icon-sm" onClick={onHide} aria-label="Ocultar barra superior"><PanelTopClose className="h-4 w-4" /></Button>
        </Hint>
      </div>
    </header>
  );
}

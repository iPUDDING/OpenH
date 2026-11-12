import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Download, FileCode2, FileImage, FileText, Focus, Maximize, Minimize, Minus, Plus, Printer, Search } from 'lucide-react';
import { MarkmapEditor } from './MarkmapEditor';
import { MarkmapCanvas, type MarkmapCanvasHandle } from './MarkmapCanvas';
import { PomodoroTimer } from '@/components/tools/tts/PomodoroTimer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Hint } from '@/components/ui/Tooltip';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { createInteractiveHtml, exportBaseName, printMarkmap, serializeMarkmapSvg, svgToPng } from '@/lib/exporters';

const templates = {
  'Plan de proyecto': '# Plan de proyecto\n\n## Objetivos\n- Resultado esperado\n- Métricas de éxito\n\n## Fases\n### Descubrimiento\n- Requisitos\n- Riesgos\n### Implementación\n- Hitos\n- Responsables\n### Entrega\n- Validación\n- Documentación\n',
  'Lluvia de ideas': '# Lluvia de ideas\n\n## Tema central\n### Idea 1\n- Variante A\n- Variante B\n### Idea 2\n- Oportunidad\n- Recursos\n### Idea 3\n- Próximo experimento\n',
  'Resumen académico': '# Resumen académico\n\n## Conceptos clave\n- Definición\n- Contexto histórico\n\n## Argumentos\n### Evidencia\n### Contraargumentos\n\n## Conclusiones\n- Preguntas pendientes\n- Bibliografía\n',
};

type ExportKind = 'md' | 'svg' | 'html' | 'png' | 'pdf';

export default function MarkmapStudio() {
  const content = useAppStore((state) => state.markmapContent);
  const setContent = useAppStore((state) => state.setMarkmapContent);
  const theme = useAppStore((state) => state.theme);
  const files = useFileSystem();
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<MarkmapCanvasHandle | null>(null);
  const [focus, setFocus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const onSearchMatches = useCallback((count: number) => {
    setSearchTotal(count);
    setSearchIndex((index) => count ? Math.min(index, count - 1) : 0);
  }, []);
  useEffect(() => setSearchIndex(0), [searchQuery]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!rootRef.current?.offsetParent) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 30);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'g') {
        event.preventDefault();
        setSearchOpen(true);
        setSearchIndex((index) => searchTotal ? (index + (event.shiftKey ? -1 : 1) + searchTotal) % searchTotal : 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchTotal]);

  const goToSearchResult = (direction: number) => {
    if (!searchTotal) return;
    setSearchIndex((index) => (index + direction + searchTotal) % searchTotal);
  };

  const exportMap = async (kind: ExportKind) => {
    setMessage(null);
    setExporting(true);
    try {
      const base = exportBaseName(content.split('\n')[0].replace(/^#+\s*/, '') || 'mapa-mental');
      let saved: boolean | null = true;
      if (kind === 'md') {
        saved = await files.saveFile(content, { suggestedName: `${base}.md`, extensions: ['md'], filterName: 'Markdown' });
      } else {
        if (!svgRef.current) throw new Error('El mapa todavía no está listo.');
        const svg = serializeMarkmapSvg(svgRef.current, dark);
        if (kind === 'svg') saved = await files.saveFile(svg, { suggestedName: `${base}.svg`, extensions: ['svg'], filterName: 'SVG' });
        if (kind === 'html') saved = await files.saveFile(createInteractiveHtml(base, svg, dark), { suggestedName: `${base}.html`, extensions: ['html'], filterName: 'HTML interactivo' });
        if (kind === 'png') saved = await files.saveFile(await svgToPng(svg), { suggestedName: `${base}.png`, extensions: ['png'], filterName: 'Imagen PNG' });
        if (kind === 'pdf') printMarkmap(base, svg);
      }
      if (saved === null) return; // useFileSystem ya expone el error concreto.
      if (!saved) {
        setMessage('Exportación cancelada. No se realizaron cambios.');
        return;
      }
      setMessage(kind === 'pdf' ? 'Vista de impresión abierta. Selecciona “Microsoft Print to PDF”.' : 'Exportación completada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section ref={rootRef} className="flex h-full min-h-0 flex-col" aria-label="Generador de mapas mentales">
      <header className="flex min-h-14 flex-wrap items-center gap-1.5 border-b bg-card px-4 py-2">
        <div className="mr-1 flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500"><BrainCircuit className="h-5 w-5" /></div>
          <div><h1 className="text-sm font-semibold">Mapas mentales</h1><p className="hidden text-xs text-muted-foreground md:block">Markdown → mapa interactivo</p></div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Hint label="Alejar"><Button variant="ghost" size="icon-sm" onClick={() => controlsRef.current?.zoomBy(0.8)} aria-label="Alejar mapa"><Minus className="h-4 w-4" /></Button></Hint>
          <Hint label="Acercar"><Button variant="ghost" size="icon-sm" onClick={() => controlsRef.current?.zoomBy(1.25)} aria-label="Acercar mapa"><Plus className="h-4 w-4" /></Button></Hint>
          <Hint label="Ajustar mapa"><Button variant="ghost" size="icon-sm" onClick={() => controlsRef.current?.fit()} aria-label="Ajustar mapa"><Maximize className="h-4 w-4" /></Button></Hint>
          <Hint label="Expandir todo"><Button variant="ghost" size="icon-sm" onClick={() => controlsRef.current?.toggleAll(false)} aria-label="Expandir todos los nodos"><ChevronsUpDown className="h-4 w-4" /></Button></Hint>
          <Hint label="Colapsar todo"><Button variant="ghost" size="icon-sm" onClick={() => controlsRef.current?.toggleAll(true)} aria-label="Colapsar todos los nodos"><ChevronsDownUp className="h-4 w-4" /></Button></Hint>
          <Hint label="Buscar temas (Ctrl+F)"><Button variant={searchOpen ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => { setSearchOpen((open) => !open); window.setTimeout(() => searchInputRef.current?.focus(), 30); }} aria-label="Buscar temas"><Search className="h-4 w-4" /></Button></Hint>
          <Hint label={focus ? 'Salir del modo foco' : 'Modo foco'}><Button variant={focus ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setFocus((value) => !value)} aria-label="Alternar modo foco">{focus ? <Minimize className="h-4 w-4" /> : <Focus className="h-4 w-4" />}</Button></Hint>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"><Download className="h-4 w-4" />Exportar</summary>
            <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border bg-card p-1.5 shadow-soft">
              <ExportButton icon={<FileText />} label="Markdown (.md)" onClick={() => void exportMap('md')} />
              <ExportButton icon={<FileCode2 />} label="SVG vectorial" onClick={() => void exportMap('svg')} />
              <ExportButton icon={<FileCode2 />} label="HTML interactivo" onClick={() => void exportMap('html')} />
              <ExportButton icon={<FileImage />} label="Imagen PNG (2×)" onClick={() => void exportMap('png')} />
              <ExportButton icon={<Printer />} label="PDF / Imprimir" onClick={() => void exportMap('pdf')} />
            </div>
          </details>
          <PomodoroTimer />
        </div>
      </header>
      {searchOpen && (
        <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') goToSearchResult(event.shiftKey ? -1 : 1); if (event.key === 'Escape') setSearchOpen(false); }} placeholder="Buscar un tema en el mapa…" className="h-8 max-w-md" />
          <span className="text-xs tabular-nums text-muted-foreground">{searchQuery ? `${searchTotal ? searchIndex + 1 : 0}/${searchTotal}` : ''}</span>
          <Button variant="ghost" size="icon-sm" disabled={!searchTotal} onClick={() => goToSearchResult(-1)} aria-label="Tema anterior"><ChevronUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" disabled={!searchTotal} onClick={() => goToSearchResult(1)} aria-label="Tema siguiente"><ChevronDown className="h-4 w-4" /></Button>
        </div>
      )}
      {(message || files.error) && <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-2 text-xs text-muted-foreground"><span>{files.error || message}</span><button onClick={() => { setMessage(null); files.clearError(); }}>Cerrar</button></div>}
      <div className={`grid min-h-0 flex-1 ${focus ? 'grid-cols-1' : 'grid-cols-1 grid-rows-[minmax(160px,0.8fr)_minmax(220px,1.2fr)] lg:grid-cols-[minmax(300px,0.85fr)_minmax(400px,1.15fr)] lg:grid-rows-1'}`}>
        {!focus && (
          <div className="flex min-h-0 flex-col border-r max-lg:border-b">
            <div className="flex items-center gap-1 overflow-x-auto border-b bg-muted/40 px-2 py-1.5">
              <span className="px-2 text-[11px] font-semibold text-muted-foreground">PLANTILLAS</span>
              {Object.keys(templates).map((name) => <button key={name} className="whitespace-nowrap rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setContent(templates[name as keyof typeof templates])}>{name}</button>)}
            </div>
            <div className="min-h-0 flex-1"><MarkmapEditor value={content} onChange={setContent} /></div>
          </div>
        )}
        <MarkmapCanvas ref={svgRef} content={content} controlsRef={controlsRef} searchQuery={searchOpen ? searchQuery : ''} activeSearchIndex={searchIndex} onSearchMatches={onSearchMatches} />
      </div>
      {exporting && <div className="pointer-events-none fixed bottom-5 right-5 rounded-lg bg-foreground px-4 py-2 text-xs text-background shadow-lg">Preparando exportación…</div>}
    </section>
  );
}

function ExportButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs hover:bg-accent [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground" onClick={onClick}>{icon}{label}</button>;
}

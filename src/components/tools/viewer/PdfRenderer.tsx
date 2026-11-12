import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Maximize2, Minus, Plus, Search } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/Select';
import { Hint } from '@/components/ui/Tooltip';
import { applySearchHighlights, applySpeechHighlights, buildDomTextMap, clearSearchHighlights, clearSpeechHighlights, type DocumentTextMap } from '@/lib/domTextMap';
import { findMatches } from '@/lib/text';
import { clamp } from '@/lib/utils';
import type { SpeechPosition, SpeechSegment } from '@/types';

type PdfEngine = typeof import('pdfjs-dist');
type FitMode = 'custom' | 'width' | 'page';

interface PdfRendererProps {
  data: Uint8Array;
  position: SpeechPosition | null;
  autoScroll: boolean;
  onSegmentsChange: (segments: SpeechSegment[]) => void;
}

function pageText(content: TextContent): string {
  return content.items.map((item) => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('');
}

export function PdfRenderer({ data, position, autoScroll, onSegmentsChange }: PdfRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [engine, setEngine] = useState<{ pdfjs: PdfEngine; document: PDFDocumentProxy } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [scale, setScale] = useState(1.25);
  const [renderScale, setRenderScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [textMap, setTextMap] = useState<DocumentTextMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);
    setPageNumber(1);
    setPageTexts([]);
    onSegmentsChange([]);

    const load = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const task = pdfjs.getDocument({ data: data.slice() });
        const documentProxy = await task.promise;
        loadedDocument = documentProxy;
        if (cancelled) {
          void documentProxy.destroy();
          return;
        }
        setEngine({ pdfjs, document: documentProxy });
        const texts: string[] = [];
        for (let page = 1; page <= documentProxy.numPages; page += 1) {
          const pdfPage = await documentProxy.getPage(page);
          const content = await pdfPage.getTextContent();
          texts.push(pageText(content));
          pdfPage.cleanup();
          if (cancelled) return;
        }
        setPageTexts(texts);
        onSegmentsChange(texts.flatMap((text, index) => text.trim() ? [{ id: `pdf-page-${index + 1}`, text }] : []));
        setLoading(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo abrir el PDF.');
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [data, onSegmentsChange]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!engine || !canvasRef.current || !textLayerRef.current) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const render = async () => {
      try {
        setLoading(true);
        const page = await engine.document.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(240, containerSize.width - 48);
        const availableHeight = Math.max(240, containerSize.height - 48);
        const actualScale = fitMode === 'width'
          ? availableWidth / base.width
          : fitMode === 'page'
            ? Math.min(availableWidth / base.width, availableHeight / base.height)
            : scale;
        setRenderScale(actualScale);
        const viewport = page.getViewport({ scale: actualScale });
        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('No se pudo iniciar el canvas PDF.');
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        task = page.render({
          canvasContext: context,
          viewport: page.getViewport({ scale: actualScale * pixelRatio }),
        });
        await task.promise;
        if (cancelled) return;

        const layer = textLayerRef.current!;
        layer.replaceChildren();
        layer.style.width = `${viewport.width}px`;
        layer.style.height = `${viewport.height}px`;
        const content = await page.getTextContent();
        for (const item of content.items) {
          if (!('str' in item) || !item.str) continue;
          const transform = engine.pdfjs.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.hypot(transform[2], transform[3]);
          const span = document.createElement('span');
          span.textContent = item.str;
          span.style.left = `${transform[4]}px`;
          span.style.top = `${transform[5] - fontHeight}px`;
          span.style.fontSize = `${fontHeight}px`;
          span.style.fontFamily = 'sans-serif';
          layer.append(span);
          const desiredWidth = item.width * actualScale;
          const measured = span.getBoundingClientRect().width;
          if (desiredWidth > 0 && measured > 0) span.style.transform = `scaleX(${desiredWidth / measured})`;
          layer.append(document.createTextNode(item.hasEOL ? '\n' : ' '));
        }
        const nextMap = buildDomTextMap(layer);
        if (nextMap.segments[0]) nextMap.segments[0].id = `pdf-page-${pageNumber}`;
        setTextMap(nextMap);
        setLoading(false);
        page.cleanup();
      } catch (renderError) {
        if (!cancelled && !(renderError instanceof Error && renderError.name === 'RenderingCancelledException')) {
          setError(renderError instanceof Error ? renderError.message : 'No se pudo renderizar la página.');
          setLoading(false);
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
      clearSpeechHighlights(textMap);
    };
    // textMap se limpia mediante el efecto de resaltado, no debe reiniciar el render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.height, containerSize.width, engine, fitMode, pageNumber, scale]);

  useEffect(() => {
    const match = position?.segmentId.match(/^pdf-page-(\d+)$/);
    if (match) setPageNumber(Number(match[1]));
  }, [position?.segmentId]);

  useEffect(() => {
    applySpeechHighlights(textMap, position?.segmentId ?? null, position?.word ?? null, autoScroll);
    return () => clearSpeechHighlights(textMap);
  }, [autoScroll, position, textMap]);

  const matches = useMemo(() => pageTexts.flatMap((text, pageIndex) => (
    findMatches(text, query).map((_, localIndex) => ({ page: pageIndex + 1, localIndex }))
  )), [pageTexts, query]);

  useEffect(() => {
    if (query && matches.length) {
      setActiveMatch(0);
      setPageNumber(matches[0].page);
    }
  }, [matches, query]);

  const goToMatch = (index: number) => {
    if (!matches.length) return;
    const normalized = (index + matches.length) % matches.length;
    setActiveMatch(normalized);
    setPageNumber(matches[normalized].page);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setActiveMatch(0);
  };

  const setZoom = (next: number) => {
    setFitMode('custom');
    setScale(clamp(next, 0.5, 3));
  };

  useEffect(() => {
    const localIndex = matches[activeMatch]?.page === pageNumber ? matches[activeMatch].localIndex : -1;
    applySearchHighlights(textMap, query, localIndex, localIndex >= 0);
    return () => clearSearchHighlights(textMap);
  }, [activeMatch, matches, pageNumber, query, textMap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.offsetParent) return;
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, [contenteditable="true"]');
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'g') {
        event.preventDefault();
        goToMatch(activeMatch + (event.shiftKey ? -1 : 1));
        return;
      }
      if (editing) return;
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key)) {
        event.preventDefault();
        setZoom(renderScale + (event.key === '-' ? -0.15 : 0.15));
      } else if (event.key === 'PageDown' || event.key.toLocaleLowerCase() === 'n') {
        event.preventDefault();
        setPageNumber((page) => Math.min(engine?.document.numPages ?? 1, page + 1));
      } else if (event.key === 'PageUp' || event.key.toLocaleLowerCase() === 'p') {
        event.preventDefault();
        setPageNumber((page) => Math.max(1, page - 1));
      } else if (event.key === 'Home') { event.preventDefault(); setPageNumber(1); }
      else if (event.key === 'End') { event.preventDefault(); setPageNumber(engine?.document.numPages ?? 1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeMatch, engine, matches, renderScale]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-card px-3 py-2">
        <Button variant="ghost" size="icon-sm" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <Input type="number" min={1} max={engine?.document.numPages ?? 1} value={pageNumber} onChange={(event) => setPageNumber(clamp(Number(event.target.value), 1, engine?.document.numPages ?? 1))} className="h-8 w-16 px-2 text-center" aria-label="Página actual" />
          / {engine?.document.numPages ?? '—'}
        </label>
        <Button variant="ghost" size="icon-sm" onClick={() => setPageNumber((page) => Math.min(engine?.document.numPages ?? 1, page + 1))} disabled={pageNumber >= (engine?.document.numPages ?? 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Hint label="Alejar"><Button variant="ghost" size="icon-sm" onClick={() => setZoom(renderScale - 0.15)} aria-label="Alejar PDF"><Minus className="h-4 w-4" /></Button></Hint>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(renderScale * 100)}%</span>
        <Hint label="Acercar"><Button variant="ghost" size="icon-sm" onClick={() => setZoom(renderScale + 0.15)} aria-label="Acercar PDF"><Plus className="h-4 w-4" /></Button></Hint>
        <SelectField aria-label="Ajuste del PDF" value={fitMode} onValueChange={(value) => setFitMode(value as FitMode)} options={[{ value: 'width', label: 'Ajustar ancho' }, { value: 'page', label: 'Página completa' }, { value: 'custom', label: 'Zoom manual' }]} className="w-36" />
        <div className="ml-auto flex min-w-56 items-center gap-1">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input ref={searchInputRef} value={query} onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') goToMatch(activeMatch + (event.shiftKey ? -1 : 1)); }} placeholder="Buscar en el PDF…" className="h-8" />
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{query ? `${matches.length ? activeMatch + 1 : 0}/${matches.length}` : ''}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => goToMatch(activeMatch - 1)} disabled={!matches.length} aria-label="Coincidencia anterior"><ChevronUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => goToMatch(activeMatch + 1)} disabled={!matches.length} aria-label="Coincidencia siguiente"><ChevronDown className="h-4 w-4" /></Button>
        </div>
      </div>
      {error && <div role="alert" className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-slate-300/60 p-6 dark:bg-slate-950/70">
        {loading && <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2 text-xs shadow"><Loader2 className="h-4 w-4 animate-spin text-primary" />Procesando PDF…</div>}
        <div className="relative mx-auto w-fit bg-white shadow-soft" style={{ minWidth: engine ? undefined : 240, minHeight: engine ? undefined : 320 }}>
          <canvas ref={canvasRef} aria-label={`Página ${pageNumber} del PDF`} />
          <div ref={textLayerRef} className="pdf-text-layer openhub-highlight-root" aria-label={`Texto seleccionable de la página ${pageNumber}`} />
        </div>
        {!engine && !loading && !error && <div className="p-12 text-center text-muted-foreground"><Maximize2 className="mx-auto mb-3 h-8 w-8" />No hay páginas para mostrar.</div>}
      </div>
    </div>
  );
}

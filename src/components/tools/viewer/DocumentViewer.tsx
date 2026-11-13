import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Check, Columns2, Download, FileText, FolderOpen, ListTree, Loader2, Minus, PanelTop, Pencil, Plus, UploadCloud, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ReaderToolbar } from './ReaderToolbar';
import { DocumentOutline } from './DocumentOutline';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Hint } from '@/components/ui/Tooltip';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useSpeechSpaceShortcut, useTts } from '@/hooks/useTts';
import { normalizeZoom, useAppStore, type RenamedRecentResult } from '@/store/useAppStore';
import { isTauri } from '@/services/fileSystemService';
import { countWords } from '@/lib/text';
import { extractHeadings } from '@/lib/headings';
import { prepareSpeechSegments } from '@/lib/pronunciation';
import { selectedDocumentText } from '@/lib/selection';
import { basename } from '@/lib/utils';
import type { DocumentTextMap } from '@/lib/domTextMap';
import type { OpenedDocument, RecentDocument, SpeechSegment } from '@/types';

const PdfRenderer = lazy(() => import('./PdfRenderer').then((module) => ({ default: module.PdfRenderer })));

function isMarkdownDocument(document: CurrentDocument | null): document is CurrentDocument {
  return document?.kind === 'markdown';
}

interface CurrentDocument {
  id: string;
  name: string;
  path?: string;
  kind: 'markdown' | 'pdf';
  data?: Uint8Array;
  customName?: boolean;
}

export default function DocumentViewer() {
  const markdown = useAppStore((state) => state.markdownContent);
  const markdownName = useAppStore((state) => state.markdownName);
  const markdownPath = useAppStore((state) => state.markdownPath);
  const markdownId = useAppStore((state) => state.markdownId);
  const setMarkdown = useAppStore((state) => state.setMarkdown);
  const mode = useAppStore((state) => state.viewerMode);
  const setMode = useAppStore((state) => state.setViewerMode);
  const viewerZoom = useAppStore((state) => state.viewerZoom);
  const setViewerZoom = useAppStore((state) => state.setViewerZoom);
  const addRecent = useAppStore((state) => state.addRecent);
  const renameRecent = useAppStore((state) => state.renameRecent);
  const autoScroll = useAppStore((state) => state.autoScroll);
  const pronunciationRules = useAppStore((state) => state.pronunciationRules);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setActiveDocumentId = useAppStore((state) => state.setActiveDocumentId);
  const files = useFileSystem();
  const [current, setCurrent] = useState<CurrentDocument | null>(() => {
    if (!markdown) return null;
    const id = markdownId || markdownPath || `draft:${markdownName}`;
    const existing = useAppStore.getState().recents.find((item) => item.id === id);
    return { id, name: existing?.name ?? markdownName, path: markdownPath, kind: 'markdown', customName: existing?.customName };
  });
  useEffect(() => {
    setActiveDocumentId(current?.id);
  }, [current?.id, setActiveDocumentId]);
  const [draft, setDraft] = useState('');
  const [textMap, setTextMap] = useState<DocumentTextMap | null>(null);
  const [pdfSegments, setPdfSegments] = useState<SpeechSegment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const [renamingHeader, setRenamingHeader] = useState(false);
  const [headerDraftName, setHeaderDraftName] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const markdownAreaRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const headerRenameInputRef = useRef<HTMLInputElement>(null);
  const headerRenameCancelledRef = useRef(false);
  const renamingHeaderRef = useRef(false);
  const zoomRef = useRef(viewerZoom);
  zoomRef.current = viewerZoom;

  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const documentWordCount = useMemo(() => current?.kind === 'pdf'
    ? countWords(pdfSegments.map((segment) => segment.sourceText ?? segment.text).join('\n'))
    : countWords(markdown), [current?.kind, markdown, pdfSegments]);

  const sourceSegments = useMemo<SpeechSegment[]>(() => current?.kind === 'pdf' ? pdfSegments : textMap?.segments ?? [], [current?.kind, pdfSegments, textMap]);
  const segments = useMemo(() => prepareSpeechSegments(sourceSegments, pronunciationRules), [sourceSegments, pronunciationRules]);
  const tts = useTts(segments);
  useSpeechSpaceShortcut(sectionRef, tts);

  const loadDocument = useCallback((document: OpenedDocument) => {
    tts.stop();
    setNotice(null);
    renamingHeaderRef.current = false;
    setRenamingHeader(false);
    setSelectionText('');
    setTextMap(null);
    setPdfSegments([]);
    const state = useAppStore.getState();
    const existingByPath = document.path ? state.recents.find((item) => item.path === document.path) : undefined;
    const id = document.id || existingByPath?.id || document.path || `draft:${document.name}`;
    const existing = existingByPath ?? (document.id ? state.recents.find((item) => item.id === id) : undefined);
    const customName = Boolean(document.customName || existing?.customName);
    const name = document.customName ? document.name : (existing?.customName ? existing.name : document.name);
    setCurrent({ id, name, path: document.path, kind: document.kind, data: document.data, customName });
    if (document.kind === 'markdown') {
      const text = document.text ?? '';
      setMarkdown(text, name, document.path, id);
      addRecent({ id, name, path: document.path, kind: 'markdown', content: text, ...(customName ? { customName: true } : {}) });
    } else {
      addRecent({ id, name, path: document.path, kind: 'pdf', ...(customName ? { customName: true } : {}) });
    }
  }, [addRecent, setMarkdown, tts.stop]);

  const openDialog = useCallback(async () => {
    const document = await files.openDialog();
    if (document) loadDocument(document);
  }, [files.openDialog, loadDocument]);

  const openPath = useCallback(async (path: string) => {
    const document = await files.openPath(path);
    if (document) loadDocument(document);
  }, [files.openPath, loadDocument]);

  const openRecent = useCallback(async (recent: RecentDocument) => {
    setActiveTool('viewer');
    if (recent.path && isTauri()) {
      const document = await files.openPath(recent.path);
      if (document) loadDocument({ ...document, id: recent.id, name: recent.name, customName: recent.customName });
      return;
    }
    if (recent.kind === 'markdown' && recent.content !== undefined) {
      loadDocument({ id: recent.id, name: recent.name, path: recent.path, kind: 'markdown', text: recent.content, customName: recent.customName });
      return;
    }
    setNotice('El sistema ya no tiene acceso directo a este archivo. Vuelve a abrirlo desde tu disco.');
  }, [files.openPath, loadDocument, setActiveTool]);

  useEffect(() => {
    const onOpen = () => { setActiveTool('viewer'); void openDialog(); };
    const onRecent = (event: Event) => void openRecent((event as CustomEvent<RecentDocument>).detail);
    const onNewDocument = (event: Event) => {
      const requestedName = (event as CustomEvent<{ name?: string }>).detail?.name?.trim();
      const name = requestedName || 'Texto sin título.md';
      setActiveTool('viewer');
      loadDocument({ id: `draft:${name}`, name, kind: 'markdown', text: '' });
      setMode('split');
      window.requestAnimationFrame(() => sectionRef.current?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Editor Markdown"]')?.focus());
    };
    const onRenamed = (event: Event) => {
      const detail = (event as CustomEvent<RenamedRecentResult>).detail;
      if (!detail) return;
      setCurrent((prev) => {
        if (!prev) return prev;
        if (prev.id !== detail.oldId && !(detail.path && prev.path === detail.path)) return prev;
        return { ...prev, id: detail.id, name: detail.name, customName: true };
      });
    };
    window.addEventListener('openhub:open', onOpen);
    window.addEventListener('openhub:recent', onRecent);
    window.addEventListener('openhub:new-document', onNewDocument);
    window.addEventListener('openhub:document-renamed', onRenamed);
    return () => {
      window.removeEventListener('openhub:open', onOpen);
      window.removeEventListener('openhub:recent', onRecent);
      window.removeEventListener('openhub:new-document', onNewDocument);
      window.removeEventListener('openhub:document-renamed', onRenamed);
    };
  }, [loadDocument, openDialog, openRecent, setActiveTool, setMode]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'drop' && event.payload.paths[0]) {
        setActiveTool('viewer');
        void openPath(event.payload.paths[0]);
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openPath, setActiveTool]);

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file || isTauri()) return;
    const document = await files.openFile(file);
    if (document) loadDocument(document);
  };

  const syncSelection = useCallback(() => {
    setSelectionText(selectedDocumentText(sectionRef.current));
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, [syncSelection]);

  const readSelection = useCallback(() => {
    const text = selectedDocumentText(sectionRef.current) || selectionText;
    if (!text) {
      setNotice('Para escuchar un fragmento: selecciónalo con el ratón en la vista previa, el editor o el PDF y pulsa «Leer selección».');
      return;
    }
    setNotice(`Leyendo solo la selección: ${countWords(text)} ${countWords(text) === 1 ? 'palabra' : 'palabras'}.`);
    tts.play(0, prepareSpeechSegments([{ id: 'selection', text }], pronunciationRules));
  }, [pronunciationRules, selectionText, tts.play]);

  const saveMarkdown = async () => {
    const rawName = current?.name || 'documento.md';
    const suggestedName = /\.(md|markdown|txt)$/i.test(rawName) ? rawName : `${rawName}.md`;
    const saved = await files.saveFile(markdown, { suggestedName, extensions: ['md'], filterName: 'Markdown' });
    if (saved) setNotice('Documento guardado correctamente.');
  };

  useEffect(() => {
    if (!isMarkdownDocument(current)) return;
    const timeout = window.setTimeout(() => {
      addRecent({
        id: current.id,
        name: current.name,
        path: current.path,
        kind: 'markdown',
        content: markdown,
        ...(current.customName ? { customName: true } : {}),
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [addRecent, current, markdown]);

  const applyMarkdownZoom = useCallback((next: number) => {
    const normalized = normalizeZoom(next);
    const scroller = previewScrollRef.current;
    const ratio = scroller && scroller.scrollHeight > scroller.clientHeight && scroller.scrollTop > 0
      ? scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight)
      : null;
    zoomRef.current = normalized;
    setViewerZoom(normalized);
    if (ratio !== null) {
      window.requestAnimationFrame(() => {
        const currentScroller = previewScrollRef.current;
        if (!currentScroller) return;
        const maxScroll = currentScroller.scrollHeight - currentScroller.clientHeight;
        if (maxScroll > 0) currentScroller.scrollTop = Math.round(ratio * maxScroll);
      });
    }
  }, [setViewerZoom]);

  const isMarkdown = current?.kind === 'markdown';

  useEffect(() => {
    const element = markdownAreaRef.current;
    if (!element || !isMarkdown) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 120 : event.deltaY;
      if (!deltaY) return;
      const base = zoomRef.current;
      const next = Math.abs(deltaY) >= 40
        ? base + (deltaY < 0 ? 0.1 : -0.1)
        : base * Math.exp(-deltaY * 0.004);
      applyMarkdownZoom(next);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [applyMarkdownZoom, current?.id, isMarkdown]);

  useEffect(() => {
    if (!isMarkdown) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!sectionRef.current?.offsetParent) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) {
        event.preventDefault();
        if (event.key === '0') applyMarkdownZoom(1);
        else applyMarkdownZoom(zoomRef.current + (event.key === '-' ? -0.1 : 0.1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyMarkdownZoom, isMarkdown]);

  const startHeaderRename = useCallback(() => {
    if (!current) return;
    headerRenameCancelledRef.current = false;
    renamingHeaderRef.current = true;
    setHeaderDraftName(current.name);
    setRenamingHeader(true);
  }, [current]);

  const cancelHeaderRename = useCallback(() => {
    headerRenameCancelledRef.current = true;
    renamingHeaderRef.current = false;
    setRenamingHeader(false);
  }, []);

  const commitHeaderRename = useCallback(() => {
    if (headerRenameCancelledRef.current || !renamingHeaderRef.current || !current) return;
    renamingHeaderRef.current = false;
    setRenamingHeader(false);
    const trimmed = headerDraftName.trim().slice(0, 260);
    if (!trimmed || trimmed === current.name) return;
    const result = renameRecent(current.id, trimmed);
    const nextId = result?.id ?? current.id;
    const nextName = result?.name ?? trimmed;
    setCurrent((prev) => prev ? { ...prev, id: nextId, name: nextName, customName: true } : prev);
    if (current.kind === 'markdown') {
      setMarkdown(markdown, nextName, current.path, nextId);
    }
    if (!result) {
      addRecent({
        id: nextId,
        name: nextName,
        path: current.path,
        kind: current.kind,
        customName: true,
        ...(current.kind === 'markdown' ? { content: markdown } : {}),
      });
    }
  }, [addRecent, current, headerDraftName, markdown, renameRecent, setMarkdown]);

  useEffect(() => {
    if (!renamingHeader || !headerRenameInputRef.current) return;
    const input = headerRenameInputRef.current;
    input.focus();
    const dot = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }, [renamingHeader]);

  const handleTextMap = useCallback((map: DocumentTextMap | null) => setTextMap(map), []);
  const handlePdfSegments = useCallback((next: SpeechSegment[]) => setPdfSegments(next), []);

  return (
    <section
      ref={sectionRef}
      className="flex h-full min-h-0 flex-col"
      onMouseUp={syncSelection}
      onKeyUp={syncSelection}
      onSelect={syncSelection}
      onDrop={onDrop}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
      aria-label="Visor de documentos"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            {current ? (
              renamingHeader ? (
                <div className="flex max-w-md items-center gap-1">
                  <Input
                    ref={headerRenameInputRef}
                    value={headerDraftName}
                    onChange={(event) => setHeaderDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitHeaderRename();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelHeaderRename();
                      }
                    }}
                    onBlur={commitHeaderRename}
                    aria-label="Nombre del documento"
                    maxLength={260}
                    className="h-7 px-2 text-sm font-semibold"
                  />
                  <Hint label="Guardar nombre">
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" onMouseDown={(event) => event.preventDefault()} onClick={commitHeaderRename} aria-label="Guardar nombre del documento"><Check className="h-3.5 w-3.5" /></Button>
                  </Hint>
                  <Hint label="Cancelar">
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={cancelHeaderRename} aria-label="Cancelar cambio de nombre"><X className="h-3.5 w-3.5" /></Button>
                  </Hint>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-1">
                  <h1
                    onClick={startHeaderRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === 'F2') {
                        event.preventDefault();
                        startHeaderRename();
                      }
                    }}
                    title="Haz clic para cambiar el nombre dentro de OpenHub"
                    className="-mx-1.5 min-w-0 cursor-pointer truncate rounded px-1.5 py-0.5 text-sm font-semibold transition hover:bg-accent"
                  >
                    {current.name}
                  </h1>
                  <Hint label="Cambiar nombre dentro de OpenHub">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={startHeaderRename}
                      className="h-6 w-6 shrink-0 text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
                      aria-label={`Renombrar ${current.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Hint>
                </div>
              )
            ) : (
              <h1 className="truncate text-sm font-semibold">Visor de documentos</h1>
            )}
            <p className="truncate text-xs text-muted-foreground">{current?.path || (current ? `${documentWordCount} palabras` : 'Markdown, TXT y PDF')}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {isMarkdown && (
            <>
              <div className="mr-1 flex rounded-md border bg-background p-0.5">
                <Hint label="Vista previa"><Button variant={mode === 'preview' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('preview')} aria-label="Vista previa"><PanelTop className="h-4 w-4" /></Button></Hint>
                <Hint label="Editor y vista dividida"><Button variant={mode === 'split' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('split')} aria-label="Vista dividida"><Columns2 className="h-4 w-4" /></Button></Hint>
              </div>
              <div className="mr-1 flex items-center rounded-md border bg-background p-0.5" role="group" aria-label="Zoom del documento">
                <Hint label="Alejar · Ctrl+rueda o Ctrl+−">
                  <Button variant="ghost" size="icon-sm" onClick={() => applyMarkdownZoom(viewerZoom - 0.1)} disabled={viewerZoom <= 0.5} aria-label="Alejar documento"><Minus className="h-3.5 w-3.5" /></Button>
                </Hint>
                <Hint label="Restablecer zoom al 100% · Ctrl+0">
                  <button
                    type="button"
                    onClick={() => applyMarkdownZoom(1)}
                    className="min-w-11 rounded px-1 py-1 text-center text-xs font-medium tabular-nums text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    aria-label="Restablecer zoom"
                  >
                    {Math.round(viewerZoom * 100)}%
                  </button>
                </Hint>
                <Hint label="Acercar · Ctrl+rueda o Ctrl++">
                  <Button variant="ghost" size="icon-sm" onClick={() => applyMarkdownZoom(viewerZoom + 0.1)} disabled={viewerZoom >= 3} aria-label="Acercar documento"><Plus className="h-3.5 w-3.5" /></Button>
                </Hint>
              </div>
              <Hint label="Índice del documento"><Button variant={outlineOpen ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setOutlineOpen((open) => !open)} disabled={!headings.length} aria-label="Mostrar índice"><ListTree className="h-4 w-4" /></Button></Hint>
              <Hint label="Guardar Markdown"><Button variant="ghost" size="icon-sm" onClick={() => void saveMarkdown()} disabled={files.busy} aria-label="Guardar Markdown"><Download className="h-4 w-4" /></Button></Hint>
            </>
          )}
          <Button size="sm" onClick={() => void openDialog()} disabled={files.busy}><FolderOpen className="h-4 w-4" />Abrir</Button>
        </div>
      </header>

      {(files.error || notice) && (
        <div role="status" className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          <span>{files.error || notice}</span>
          <Button variant="ghost" size="sm" onClick={() => { files.clearError(); setNotice(null); }}>Cerrar</Button>
        </div>
      )}

      {!current ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
          <div className="w-full max-w-2xl animate-fade-in">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UploadCloud className="h-7 w-7" /></div>
              <h2 className="text-2xl font-bold tracking-tight">Tu espacio de lectura</h2>
              <p className="mt-2 text-sm text-muted-foreground">Arrastra un documento, ábrelo desde Windows o empieza pegando Markdown.</p>
            </div>
            <div className="rounded-xl border border-dashed border-primary/40 bg-card p-4 shadow-soft">
              <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={'# Escribe o pega Markdown aquí…\n\nTu documento se guardará localmente.'} className="min-h-52 border-0 bg-transparent shadow-none focus-visible:ring-0" aria-label="Markdown inicial" />
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
                <Button variant="ghost" onClick={() => void openDialog()}><FolderOpen className="h-4 w-4" />Examinar archivos</Button>
                <Button disabled={!draft.trim()} onClick={() => loadDocument({ name: 'Borrador.md', kind: 'markdown', text: draft })}>Abrir borrador</Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ReaderToolbar controller={tts} onReadSelection={readSelection} selectionLength={selectionText.length} showPomodoro={isMarkdown} />
          {isMarkdown ? (
            <div ref={markdownAreaRef} className={`grid min-h-0 flex-1 ${mode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {mode === 'split' && (
                <div className="hidden min-h-0 border-r lg:flex lg:flex-col">
                  <div className="border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">EDITOR MARKDOWN</div>
                  <Textarea
                    value={markdown}
                    onChange={(event) => setMarkdown(event.target.value, current.name, current.path, current.id)}
                    className="min-h-0 flex-1 rounded-none border-0 bg-card font-mono shadow-none focus-visible:ring-0"
                    style={{ fontSize: `${Math.round(13 * viewerZoom * 10) / 10}px`, lineHeight: `${Math.round(24 * viewerZoom * 10) / 10}px` }}
                    spellCheck={false}
                    aria-label="Editor Markdown"
                  />
                </div>
              )}
              <div className="flex min-h-0 bg-card">
                {outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
                <div ref={previewScrollRef} className="min-h-0 flex-1 overflow-auto">
                  <MarkdownRenderer content={markdown} documentPath={current.path} position={tts.position} autoScroll={autoScroll} onTextMap={handleTextMap} />
                </div>
              </div>
            </div>
          ) : current.data ? (
            <Suspense fallback={<div className="grid flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Cargando PDF.js</span></div>}>
              <PdfRenderer data={current.data} position={tts.position} autoScroll={autoScroll} onSegmentsChange={handlePdfSegments} />
            </Suspense>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center"><div><p className="mb-3 text-muted-foreground">Vuelve a abrir “{basename(current.name)}” para cargar su contenido.</p><Button onClick={() => void openDialog()}>Seleccionar PDF</Button></div></div>
          )}
        </>
      )}
    </section>
  );
}

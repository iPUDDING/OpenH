import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Columns2, Download, FileText, FolderOpen, ListTree, Loader2, PanelTop, UploadCloud } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ReaderToolbar } from './ReaderToolbar';
import { DocumentOutline } from './DocumentOutline';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Hint } from '@/components/ui/Tooltip';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useTts } from '@/hooks/useTts';
import { useAppStore } from '@/store/useAppStore';
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
  name: string;
  path?: string;
  kind: 'markdown' | 'pdf';
  data?: Uint8Array;
}

export default function DocumentViewer() {
  const markdown = useAppStore((state) => state.markdownContent);
  const markdownName = useAppStore((state) => state.markdownName);
  const markdownPath = useAppStore((state) => state.markdownPath);
  const setMarkdown = useAppStore((state) => state.setMarkdown);
  const mode = useAppStore((state) => state.viewerMode);
  const setMode = useAppStore((state) => state.setViewerMode);
  const addRecent = useAppStore((state) => state.addRecent);
  const autoScroll = useAppStore((state) => state.autoScroll);
  const pronunciationRules = useAppStore((state) => state.pronunciationRules);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const files = useFileSystem();
  const [current, setCurrent] = useState<CurrentDocument | null>(() => markdown ? { name: markdownName, path: markdownPath, kind: 'markdown' } : null);
  const [draft, setDraft] = useState('');
  const [textMap, setTextMap] = useState<DocumentTextMap | null>(null);
  const [pdfSegments, setPdfSegments] = useState<SpeechSegment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [selectionText, setSelectionText] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const documentWordCount = useMemo(() => current?.kind === 'pdf'
    ? countWords(pdfSegments.map((segment) => segment.sourceText ?? segment.text).join('\n'))
    : countWords(markdown), [current?.kind, markdown, pdfSegments]);

  const sourceSegments = useMemo<SpeechSegment[]>(() => current?.kind === 'pdf' ? pdfSegments : textMap?.segments ?? [], [current?.kind, pdfSegments, textMap]);
  const segments = useMemo(() => prepareSpeechSegments(sourceSegments, pronunciationRules), [sourceSegments, pronunciationRules]);
  const tts = useTts(segments);

  const loadDocument = useCallback((document: OpenedDocument) => {
    tts.stop();
    setNotice(null);
    setSelectionText('');
    setTextMap(null);
    setPdfSegments([]);
    setCurrent({ name: document.name, path: document.path, kind: document.kind, data: document.data });
    if (document.kind === 'markdown') {
      const text = document.text ?? '';
      setMarkdown(text, document.name, document.path);
      addRecent({ name: document.name, path: document.path, kind: 'markdown', content: text });
    } else {
      addRecent({ name: document.name, path: document.path, kind: 'pdf' });
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
      await openPath(recent.path);
      return;
    }
    if (recent.kind === 'markdown' && recent.content !== undefined) {
      loadDocument({ name: recent.name, path: recent.path, kind: 'markdown', text: recent.content });
      return;
    }
    setNotice('El sistema ya no tiene acceso directo a este archivo. Vuelve a abrirlo desde tu disco.');
  }, [loadDocument, openPath, setActiveTool]);

  useEffect(() => {
    const onOpen = () => { setActiveTool('viewer'); void openDialog(); };
    const onRecent = (event: Event) => void openRecent((event as CustomEvent<RecentDocument>).detail);
    window.addEventListener('openhub:open', onOpen);
    window.addEventListener('openhub:recent', onRecent);
    return () => {
      window.removeEventListener('openhub:open', onOpen);
      window.removeEventListener('openhub:recent', onRecent);
    };
  }, [openDialog, openRecent, setActiveTool]);

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
    const saved = await files.saveFile(markdown, { suggestedName: current?.name || 'documento.md', extensions: ['md'], filterName: 'Markdown' });
    if (saved) setNotice('Documento guardado correctamente.');
  };

  useEffect(() => {
    if (!isMarkdownDocument(current)) return;
    const timeout = window.setTimeout(() => {
      addRecent({ name: current.name, path: current.path, kind: 'markdown', content: markdown });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [addRecent, current, markdown]);

  const handleTextMap = useCallback((map: DocumentTextMap | null) => setTextMap(map), []);
  const handlePdfSegments = useCallback((next: SpeechSegment[]) => setPdfSegments(next), []);
  const isMarkdown = current?.kind === 'markdown';

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
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{current?.name ?? 'Visor de documentos'}</h1>
            <p className="truncate text-xs text-muted-foreground">{current?.path || (current ? `${documentWordCount} palabras` : 'Markdown, TXT y PDF')}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {isMarkdown && (
            <>
              <div className="mr-1 flex rounded-md border bg-background p-0.5">
                <Hint label="Vista previa"><Button variant={mode === 'preview' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('preview')} aria-label="Vista previa"><PanelTop className="h-4 w-4" /></Button></Hint>
                <Hint label="Editor y vista dividida"><Button variant={mode === 'split' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('split')} aria-label="Vista dividida"><Columns2 className="h-4 w-4" /></Button></Hint>
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
            <div className={`grid min-h-0 flex-1 ${mode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {mode === 'split' && (
                <div className="hidden min-h-0 border-r lg:flex lg:flex-col">
                  <div className="border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">EDITOR MARKDOWN</div>
                  <Textarea
                    value={markdown}
                    onChange={(event) => setMarkdown(event.target.value, current.name, current.path)}
                    className="min-h-0 flex-1 rounded-none border-0 bg-card font-mono text-[13px] leading-6 shadow-none focus-visible:ring-0"
                    spellCheck={false}
                    aria-label="Editor Markdown"
                  />
                </div>
              )}
              <div className="flex min-h-0 bg-card">
                {outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
                <div className="min-h-0 flex-1 overflow-auto">
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

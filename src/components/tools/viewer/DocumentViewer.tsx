import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Bookmark as BookmarkIcon, BookmarkPlus, Check, Columns2, Download, FileText, FolderOpen, ListTree, Loader2, Minus, Palette, PanelTop, Pencil, Plus, Printer, StickyNote, Trash2, UploadCloud, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderContextMenu } from './ReaderContextMenu';
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
import { applyMathSpeech } from '@/lib/mathSpeech';
import { applyDashSpeech } from '@/lib/dashSpeech';
import { selectedDocumentText } from '@/lib/selection';
import { basename } from '@/lib/utils';
import { segmentIndexAtPoint, type DocumentTextMap } from '@/lib/domTextMap';
import type { Bookmark, DocNote, OpenedDocument, PaperTheme, RecentDocument, SpeechSegment } from '@/types';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer').then((module) => ({ default: module.MarkdownRenderer })));
const PdfRenderer = lazy(() => import('./PdfRenderer').then((module) => ({ default: module.PdfRenderer })));
const OfficeRenderer = lazy(() => import('./OfficeRenderer').then((module) => ({ default: module.OfficeRenderer })));

function isMarkdownDocument(document: CurrentDocument | null): document is CurrentDocument {
  return document?.kind === 'markdown';
}

interface CurrentDocument {
  id: string;
  name: string;
  path?: string;
  kind: 'markdown' | 'pdf' | 'docx' | 'pptx' | 'xlsx';
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
  const theme = useAppStore((state) => state.theme);
  const paperTheme = useAppStore((state) => state.paperTheme);
  const setPaperTheme = useAppStore((state) => state.setPaperTheme);
  const setReadingPosition = useAppStore((state) => state.setReadingPosition);
  const bookmarks = useAppStore((state) => state.bookmarks);
  const addBookmark = useAppStore((state) => state.addBookmark);
  const removeBookmark = useAppStore((state) => state.removeBookmark);
  const notes = useAppStore((state) => state.notes);
  const addNote = useAppStore((state) => state.addNote);
  const removeNote = useAppStore((state) => state.removeNote);
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
  useEffect(() => {
    setContextMenu(null);
  }, [current?.id]);
  const [draft, setDraft] = useState('');
  const [textMap, setTextMap] = useState<DocumentTextMap | null>(null);
  const [pdfSegments, setPdfSegments] = useState<SpeechSegment[]>([]);
  const [pdfPage, setPdfPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segmentIndex: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(() => theme === 'apple-outline');
  // El tema Outline abre el índice al activarse; el tema Foco lo cierra.
  useEffect(() => {
    if (theme === 'apple-outline') setOutlineOpen(true);
    else if (theme === 'apple-focus') setOutlineOpen(false);
  }, [theme]);
  const [selectionText, setSelectionText] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [renamingHeader, setRenamingHeader] = useState(false);
  const [headerDraftName, setHeaderDraftName] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const markdownAreaRef = useRef<HTMLDivElement>(null);
  const officeAreaRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const headerRenameInputRef = useRef<HTMLInputElement>(null);
  const headerRenameCancelledRef = useRef(false);
  const renamingHeaderRef = useRef(false);
  const zoomRef = useRef(viewerZoom);
  const progressValueRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLSpanElement>(null);
  zoomRef.current = viewerZoom;

  const headings = useMemo(() => {
    if ((current?.kind === 'docx' || current?.kind === 'pptx' || current?.kind === 'xlsx') && textMap) {
      return textMap.segments
        .filter((segment) => /^H[1-6]$/.test(segment.element.tagName))
        .map((segment) => ({ id: segment.id, level: Number(segment.element.tagName[1]), text: segment.text.trim() }))
        .filter((heading) => heading.text);
    }
    return extractHeadings(markdown);
  }, [current?.kind, textMap, markdown]);
  const documentWordCount = useMemo(() => {
    if (current?.kind === 'pdf') return countWords(pdfSegments.map((segment) => segment.sourceText ?? segment.text).join('\n'));
    if (current?.kind === 'docx' || current?.kind === 'pptx' || current?.kind === 'xlsx') return countWords(textMap?.segments.map((segment) => segment.text).join('\n') ?? '');
    return countWords(markdown);
  }, [current?.kind, markdown, pdfSegments, textMap]);

  const sourceSegments = useMemo<SpeechSegment[]>(() => current?.kind === 'pdf' ? pdfSegments : textMap?.segments ?? [], [current?.kind, pdfSegments, textMap]);
  const segments = useMemo(() => prepareSpeechSegments(applyDashSpeech(applyMathSpeech(sourceSegments)), pronunciationRules), [sourceSegments, pronunciationRules]);
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
      addRecent({ id, name, path: document.path, kind: document.kind, ...(customName ? { customName: true } : {}) });
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
    tts.play(0, prepareSpeechSegments(applyDashSpeech(applyMathSpeech([{ id: 'selection', text }])), pronunciationRules));
  }, [pronunciationRules, selectionText, tts.play]);

  const saveMarkdown = async () => {
    const rawName = current?.name || 'documento.md';
    const suggestedName = /\.(md|markdown|txt)$/i.test(rawName) ? rawName : `${rawName}.md`;
    const saved = await files.saveFile(markdown, { suggestedName, extensions: ['md'], filterName: 'Markdown' });
    if (saved) setNotice('Documento guardado correctamente.');
  };

  const addCurrentBookmark = useCallback(() => {
    if (!current) return;
    const position = progressValueRef.current;
    const percent = Math.round(position * 100);
    addBookmark(current.id, {
      id: globalThis.crypto?.randomUUID?.() ?? `bm-${Date.now()}-${Math.random()}`,
      label: `Marcador · ${percent}%`,
      position,
      createdAt: Date.now(),
    });
    setNotice(`Marcador guardado en el ${percent}% del documento.`);
  }, [addBookmark, current]);

  const goToBookmark = useCallback((position: number) => {
    const scroller = previewScrollRef.current;
    if (!scroller) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    if (max > 0) scroller.scrollTop = position * max;
  }, []);

  const exportHtml = async () => {
    if (!current) return;
    const body = previewScrollRef.current?.querySelector('.markdown-body')?.innerHTML
      ?? `<pre>${markdown.replace(/</g, '&lt;')}</pre>`;
    const title = current.name.replace(/\.[^.]+$/, '');
    const html = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<title>${title} — OpenHub</title>\n<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1d1d1f}h1,h2,h3{line-height:1.25}pre{background:#f5f5f7;padding:16px;border-radius:8px;overflow:auto}code{background:#f5f5f7;padding:2px 6px;border-radius:4px}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px 12px}</style>\n</head>\n<body>\n${body}\n</body>\n</html>`;
    const suggestedName = `${title}.html`;
    const saved = await files.saveFile(html, { suggestedName, extensions: ['html'], filterName: 'HTML' });
    if (saved) setNotice('Documento exportado como HTML.');
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
  const isOffice = current?.kind === 'docx' || current?.kind === 'pptx' || current?.kind === 'xlsx';

  useEffect(() => {
    const element = isMarkdown ? markdownAreaRef.current : isOffice ? officeAreaRef.current : null;
    if (!element) return;
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
  }, [applyMarkdownZoom, current?.id, isMarkdown, isOffice]);

  useEffect(() => {
    if (!isMarkdown && !isOffice) return;
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
  }, [applyMarkdownZoom, isMarkdown, isOffice]);

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

  // Progreso de lectura + persistencia de posición (con debounce).
  const positionSaveRef = useRef<number | null>(null);
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = current?.id ?? null;
  useEffect(() => {
    const scroller = previewScrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 0 ? scroller.scrollTop / max : 0;
      progressValueRef.current = ratio;
      if (progressFillRef.current) progressFillRef.current.style.transform = `scaleX(${ratio})`;
      progressBarRef.current?.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      const id = currentIdRef.current;
      if (!id) return;
      if (positionSaveRef.current) window.clearTimeout(positionSaveRef.current);
      positionSaveRef.current = window.setTimeout(() => setReadingPosition(id, ratio), 400);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (positionSaveRef.current) window.clearTimeout(positionSaveRef.current);
    };
  }, [current?.id, setReadingPosition]);

  // Restaurar la posición guardada al abrir un documento.
  useEffect(() => {
    if (!current?.id) return;
    const saved = useAppStore.getState().readingPositions[current.id];
    const scroller = previewScrollRef.current;
    if (saved === undefined || !scroller) return;
    const restore = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (max > 0) scroller.scrollTop = saved * max;
    };
    const raf = window.requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 350);
    return () => { window.cancelAnimationFrame(raf); window.clearTimeout(timer); };
    // Solo al cambiar de documento, no en cada scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const documentCharCount = useMemo(() => {
    if (current?.kind === 'pdf') return pdfSegments.map((s) => s.sourceText ?? s.text).join('\n').length;
    if (current?.kind === 'docx' || current?.kind === 'pptx' || current?.kind === 'xlsx') return textMap?.segments.map((s) => s.text).join('\n').length ?? 0;
    return markdown.length;
  }, [current?.kind, markdown, pdfSegments, textMap]);
  const readingMinutes = Math.max(1, Math.round(documentWordCount / 200));

  // Clic derecho sobre el documento: si el cursor está sobre un párrafo
  // mapeado, se ofrece "Empezar lectura desde aquí"; si no, menú nativo.
  const onReaderContextMenu = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const index = segmentIndexAtPoint(textMap, event.clientX, event.clientY);
    if (index === null) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, segmentIndex: index });
  }, [textMap]);

  const onPdfContextMenu = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    const index = pdfSegments.findIndex((segment) => segment.id === `pdf-page-${pdfPage}`);
    if (index === -1) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, segmentIndex: index });
  }, [pdfPage, pdfSegments]);

  const appleTheme = theme.startsWith('apple-');
  // En el tema Outline el índice va a la derecha, como en la referencia.
  const outlineOnRight = theme === 'apple-outline';

  return (
    <section
      ref={sectionRef}
      className="relative flex h-full min-h-0 flex-col"
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
                  {current.kind !== 'markdown' && (
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{current.kind}</span>
                  )}
                </div>
              )
            ) : (
              <h1 className="truncate text-sm font-semibold">Visor de documentos</h1>
            )}
            <p className="truncate text-xs text-muted-foreground">{current?.path || (current ? `${documentWordCount} palabras · ${documentCharCount} caracteres · ≈ ${readingMinutes} min de lectura` : 'Markdown, TXT, PDF, DOCX, PPTX y XLSX')}</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {isMarkdown && (
            <div className="mr-1 flex rounded-md border bg-background p-0.5">
              <Hint label="Vista previa"><Button variant={mode === 'preview' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('preview')} aria-label="Vista previa"><PanelTop className="h-4 w-4" /></Button></Hint>
              <Hint label="Editor y vista dividida"><Button variant={mode === 'split' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setMode('split')} aria-label="Vista dividida"><Columns2 className="h-4 w-4" /></Button></Hint>
            </div>
          )}
          {(isMarkdown || isOffice) && (
            <>
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
            </>
          )}
          {current && (
            <>
              <PaperThemeMenu paperTheme={paperTheme} onSelect={setPaperTheme} />
              <Hint label="Añadir marcador en la posición actual"><Button variant="ghost" size="icon-sm" onClick={addCurrentBookmark} aria-label="Añadir marcador"><BookmarkPlus className="h-4 w-4" /></Button></Hint>
              <Hint label="Notas del documento"><Button variant={notesOpen ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setNotesOpen((open) => !open)} aria-label="Mostrar notas"><StickyNote className="h-4 w-4" /></Button></Hint>
              <Hint label="Exportar documento como HTML"><Button variant="ghost" size="icon-sm" onClick={() => void exportHtml()} disabled={files.busy} aria-label="Exportar como HTML"><Download className="h-4 w-4" /></Button></Hint>
              <Hint label="Imprimir o guardar como PDF"><Button variant="ghost" size="icon-sm" onClick={() => window.print()} aria-label="Imprimir documento"><Printer className="h-4 w-4" /></Button></Hint>
            </>
          )}
          {isMarkdown && <Hint label="Guardar Markdown"><Button variant="ghost" size="icon-sm" onClick={() => void saveMarkdown()} disabled={files.busy} aria-label="Guardar Markdown"><Download className="h-4 w-4" /></Button></Hint>}
          <Button size="sm" onClick={() => void openDialog()} disabled={files.busy}><FolderOpen className="h-4 w-4" />Abrir</Button>
        </div>
      </header>

      {(files.error || notice) && (
        <div role="status" className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
          <span>{files.error || notice}</span>
          <Button variant="ghost" size="sm" onClick={() => { files.clearError(); setNotice(null); }}>Cerrar</Button>
        </div>
      )}

      {current && (
        <div ref={progressBarRef} className="reading-progress" role="progressbar" aria-valuenow={Math.round(progressValueRef.current * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de lectura">
          <span ref={progressFillRef} style={{ transform: 'scaleX(0)' }} />
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
            <div ref={markdownAreaRef} onContextMenu={onReaderContextMenu} className={`grid min-h-0 flex-1 ${mode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
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
                {!outlineOnRight && outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
                <div ref={previewScrollRef} className={`${paperTheme !== 'white' ? `paper-${paperTheme}` : ''} ${appleTheme ? 'min-h-0 flex-1 overflow-auto pb-28' : 'min-h-0 flex-1 overflow-auto'}`}>
                  <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Cargando vista previa Markdown</span></div>}>
                    <MarkdownRenderer content={markdown} documentPath={current.path} position={tts.position} autoScroll={autoScroll} onTextMap={handleTextMap} />
                  </Suspense>
                </div>
                {outlineOnRight && outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
                {notesOpen && current && (
                  <NotesPanel
                    documentId={current.id}
                    docNotes={notes[current.id] ?? []}
                    docBookmarks={bookmarks[current.id] ?? []}
                    draft={noteDraft}
                    onDraftChange={setNoteDraft}
                    onAddNote={() => {
                      const text = noteDraft.trim();
                      if (!text) return;
                      addNote(current.id, { id: globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random()}`, text, createdAt: Date.now() });
                      setNoteDraft('');
                    }}
                    onRemoveNote={(noteId) => removeNote(current.id, noteId)}
                    onGoToBookmark={goToBookmark}
                    onRemoveBookmark={(bookmarkId) => removeBookmark(current.id, bookmarkId)}
                  />
                )}
              </div>
            </div>
          ) : (current.kind === 'docx' || current.kind === 'pptx' || current.kind === 'xlsx') && current.data ? (
            <div ref={officeAreaRef} onContextMenu={onReaderContextMenu} className="flex min-h-0 flex-1 bg-card">
              {!outlineOnRight && outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
              <div ref={previewScrollRef} className={`${paperTheme !== 'white' ? `paper-${paperTheme}` : ''} ${appleTheme ? 'min-h-0 flex-1 overflow-auto pb-28' : 'min-h-0 flex-1 overflow-auto'}`}>
                <Suspense fallback={<div className="grid flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Convirtiendo documento</span></div>}>
                  <OfficeRenderer kind={current.kind} data={current.data} position={tts.position} autoScroll={autoScroll} onTextMap={handleTextMap} />
                </Suspense>
              </div>
              {outlineOnRight && outlineOpen && headings.length > 0 && <DocumentOutline headings={headings} />}
            </div>
          ) : current.data ? (
            <div onContextMenu={onPdfContextMenu} className="flex min-h-0 flex-1 flex-col">
              <Suspense fallback={<div className="grid flex-1 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Cargando PDF.js</span></div>}>
                <PdfRenderer data={current.data} position={tts.position} autoScroll={autoScroll} onSegmentsChange={handlePdfSegments} onPageChange={setPdfPage} />
              </Suspense>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center"><div><p className="mb-3 text-muted-foreground">Vuelve a abrir “{basename(current.name)}” para cargar su contenido.</p><Button onClick={() => void openDialog()}>Seleccionar {current.kind.toUpperCase()}</Button></div></div>
          )}
        </>
      )}
      {contextMenu && (
        <ReaderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onReadFromHere={() => tts.play(contextMenu.segmentIndex)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  );
}

const PAPER_OPTIONS: Array<{ id: PaperTheme; label: string; swatch: string }> = [
  { id: 'white', label: 'Blanco', swatch: '#ffffff' },
  { id: 'sepia', label: 'Sepia', swatch: '#fbf3e4' },
  { id: 'gray', label: 'Gris nocturno', swatch: '#2b2b30' },
  { id: 'black', label: 'Negro', swatch: '#000000' },
];

function PaperThemeMenu({ paperTheme, onSelect }: { paperTheme: PaperTheme; onSelect: (theme: PaperTheme) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);
  return (
    <div ref={ref} className="relative">
      <Hint label="Papel del documento (modo noche)">
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen((value) => !value)} aria-label="Cambiar papel del documento" aria-expanded={open}>
          <Palette className="h-4 w-4" />
        </Button>
      </Hint>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border bg-card p-1.5 shadow-xl animate-fade-in" role="menu" aria-label="Papel del documento">
          {PAPER_OPTIONS.map((option) => (
            <button
              key={option.id}
              role="menuitemradio"
              aria-checked={paperTheme === option.id}
              onClick={() => { onSelect(option.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-xs transition hover:bg-accent ${paperTheme === option.id ? 'bg-primary/10 font-medium text-primary' : ''}`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-inner" style={{ background: option.swatch }} />
              {option.label}
              {paperTheme === option.id && <Check className="ml-auto h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NotesPanelProps {
  documentId: string;
  docNotes: DocNote[];
  docBookmarks: Bookmark[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAddNote: () => void;
  onRemoveNote: (noteId: string) => void;
  onGoToBookmark: (position: number) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}

function NotesPanel({ docNotes, docBookmarks, draft, onDraftChange, onAddNote, onRemoveNote, onGoToBookmark, onRemoveBookmark }: NotesPanelProps) {
  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-l bg-muted/20 p-3 md:block" aria-label="Notas y marcadores del documento">
      <div className="mb-3 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />Notas
      </div>
      <div className="mb-4">
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onAddNote(); } }}
          placeholder="Escribe una nota y pulsa Ctrl+Enter…"
          className="min-h-16 text-xs"
          aria-label="Nueva nota"
        />
        <Button size="sm" className="mt-2 w-full" onClick={onAddNote} disabled={!draft.trim()}>Añadir nota</Button>
      </div>
      <div className="space-y-2">
        {docNotes.length ? docNotes.map((note) => (
          <div key={note.id} className="group rounded-lg border bg-card p-2.5">
            <p className="whitespace-pre-wrap text-xs leading-5">{note.text}</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
              <button type="button" onClick={() => onRemoveNote(note.id)} className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label="Eliminar nota"><Trash2 className="h-3 w-3" /></button>
            </div>
          </div>
        )) : <p className="px-1 py-3 text-center text-xs leading-5 text-muted-foreground">Aún no hay notas para este documento.</p>}
      </div>
      <div className="mb-2 mt-5 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <BookmarkIcon className="h-3.5 w-3.5" />Marcadores
      </div>
      <div className="space-y-1">
        {docBookmarks.length ? docBookmarks.map((bookmark) => (
          <div key={bookmark.id} className="group flex items-center gap-1">
            <button type="button" onClick={() => onGoToBookmark(bookmark.position)} className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent" title="Ir al marcador">
              {bookmark.label}
            </button>
            <button type="button" onClick={() => onRemoveBookmark(bookmark.id)} className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-destructive group-hover:opacity-100" aria-label={`Eliminar ${bookmark.label}`}><Trash2 className="h-3 w-3" /></button>
          </div>
        )) : <p className="px-1 py-2 text-xs leading-5 text-muted-foreground">Usa el botón de marcador para guardar tu posición.</p>}
      </div>
    </aside>
  );
}

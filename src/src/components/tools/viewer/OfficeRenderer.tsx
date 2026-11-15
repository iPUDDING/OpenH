import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { applySpeechHighlights, buildDomTextMap, clearSpeechHighlights, type DocumentTextMap } from '@/lib/domTextMap';
import { headingId } from '@/lib/headings';
import { useAppStore } from '@/store/useAppStore';
import type { SpeechPosition } from '@/types';

interface OfficeRendererProps {
  kind: 'docx' | 'pptx' | 'xlsx';
  data: Uint8Array;
  position: SpeechPosition | null;
  autoScroll: boolean;
  onTextMap: (map: DocumentTextMap | null) => void;
}

/**
 * Muestra un DOCX/PPTX convertido a HTML semántico (carga diferida del
 * parser y de JSZip) con el mismo resaltado TTS y zoom que el Markdown.
 */
export function OfficeRenderer({ kind, data, position, autoScroll, onTextMap }: OfficeRendererProps) {
  const rootRef = useRef<HTMLElement>(null);
  const readerFontSize = useAppStore((state) => state.readerFontSize);
  const readerLineHeight = useAppStore((state) => state.readerLineHeight);
  const readerWidth = useAppStore((state) => state.readerWidth);
  const viewerZoom = useAppStore((state) => state.viewerZoom);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<DocumentTextMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    import('@/lib/office')
      .then(({ parseOfficeDocument }) => parseOfficeDocument(kind, data))
      .then((document) => {
        if (!cancelled) setHtml(document.html);
      })
      .catch((parseError: unknown) => {
        if (!cancelled) {
          setError(parseError instanceof Error ? parseError.message : 'No se pudo leer el documento.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [kind, data]);

  // Asigna IDs a los encabezados y mapea el DOM tras el commit.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !html) return;
    root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
      heading.id = headingId(heading.textContent ?? '', index);
    });
    const next = buildDomTextMap(root);
    setMap(next);
    onTextMap(next);
    return () => clearSpeechHighlights(next);
  }, [html, onTextMap]);

  useEffect(() => {
    applySpeechHighlights(map, position?.segmentId ?? null, position?.word ?? null, autoScroll);
  }, [autoScroll, map, position]);

  if (error) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (!html) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="sr-only">Convirtiendo documento</span>
      </div>
    );
  }

  return (
    <article
      ref={rootRef}
      className="markdown-body openhub-highlight-root"
      aria-label={`Vista previa de ${kind.toUpperCase()}`}
      style={{ fontSize: `${readerFontSize / 100}rem`, lineHeight: readerLineHeight, maxWidth: `${readerWidth}px`, zoom: viewerZoom }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

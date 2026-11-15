import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type AnchorHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { applySpeechHighlights, buildDomTextMap, clearSpeechHighlights, type DocumentTextMap } from '@/lib/domTextMap';
import { resolveMarkdownAsset } from '@/services/fileSystemService';
import type { SpeechPosition } from '@/types';
import { headingId } from '@/lib/headings';
import { useAppStore } from '@/store/useAppStore';

function MarkdownLink({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} target="_blank" rel="noreferrer noopener">{children}</a>;
}

interface MarkdownRendererProps {
  content: string;
  documentPath?: string;
  position: SpeechPosition | null;
  autoScroll: boolean;
  onTextMap: (map: DocumentTextMap | null) => void;
}

export function MarkdownRenderer({ content, documentPath, position, autoScroll, onTextMap }: MarkdownRendererProps) {
  const rootRef = useRef<HTMLElement>(null);
  const readerFontSize = useAppStore((state) => state.readerFontSize);
  const readerLineHeight = useAppStore((state) => state.readerLineHeight);
  const readerWidth = useAppStore((state) => state.readerWidth);
  const viewerZoom = useAppStore((state) => state.viewerZoom);
  const [map, setMap] = useState<DocumentTextMap | null>(null);

  // Asigna IDs y mapea el DOM tras el commit sin reemplazar nodos <h1>–<h6> en re-renders.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
      heading.id = headingId(heading.textContent ?? '', index);
    });
    const next = buildDomTextMap(root);
    setMap(next);
    onTextMap(next);
    return () => clearSpeechHighlights(next);
  }, [content, onTextMap]);

  useEffect(() => {
    applySpeechHighlights(map, position?.segmentId ?? null, position?.word ?? null, autoScroll);
  }, [autoScroll, map, position]);

  const handleImage = useCallback((props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} src={resolveMarkdownAsset(props.src ?? '', documentPath)} loading="lazy" alt={props.alt ?? ''} />
  ), [documentPath]);

  const components = useMemo(() => ({
    img: handleImage,
    a: MarkdownLink,
  }), [handleImage]);

  return (
    <article
      ref={rootRef}
      className="markdown-body openhub-highlight-root"
      aria-label="Vista previa de Markdown"
      style={{ fontSize: `${readerFontSize / 100}rem`, lineHeight: readerLineHeight, maxWidth: `${readerWidth}px`, zoom: viewerZoom }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeHighlight, { detect: false }], rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

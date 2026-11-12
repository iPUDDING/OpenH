import { createElement, useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
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

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (node && typeof node === 'object' && 'props' in node) return textContent((node.props as { children?: ReactNode }).children);
  return '';
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
  const [map, setMap] = useState<DocumentTextMap | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const next = buildDomTextMap(rootRef.current);
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

  let headingIndex = 0;
  const heading = (level: number) => function Heading({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
    const index = headingIndex++;
    const id = headingId(textContent(children), index);
    return createElement(`h${level}`, { ...props, id }, children);
  };

  return (
    <article
      ref={rootRef}
      className="markdown-body openhub-highlight-root"
      aria-label="Vista previa de Markdown"
      style={{ fontSize: `${readerFontSize / 100}rem`, lineHeight: readerLineHeight, maxWidth: `${readerWidth}px` }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeHighlight, { detect: false }], rehypeKatex]}
        components={{
          h1: heading(1), h2: heading(2), h3: heading(3), h4: heading(4), h5: heading(5), h6: heading(6),
          img: handleImage,
          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

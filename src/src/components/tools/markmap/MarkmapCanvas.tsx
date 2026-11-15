import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useMarkmap } from '@/hooks/useMarkmap';
import { normalizeSearchText } from '@/lib/text';

export interface MarkmapCanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  toggleAll: (collapse: boolean) => void;
}

interface MarkmapCanvasProps {
  content: string;
  controlsRef?: React.MutableRefObject<MarkmapCanvasHandle | null>;
  searchQuery?: string;
  activeSearchIndex?: number;
  onSearchMatches?: (count: number) => void;
}

export const MarkmapCanvas = forwardRef<SVGSVGElement, MarkmapCanvasProps>(function MarkmapCanvas({ content, controlsRef, searchQuery = '', activeSearchIndex = 0, onSearchMatches }, svgRef) {
  const localRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(svgRef, () => localRef.current!, []);
  const controls = useMarkmap(localRef, content);
  if (controlsRef) controlsRef.current = { fit: controls.fit, zoomBy: controls.zoomBy, toggleAll: controls.toggleAll };

  useEffect(() => {
    if (!controls.ready || !localRef.current) return;
    const timeout = window.setTimeout(() => {
      const nodes = Array.from(localRef.current!.querySelectorAll<SVGGElement>('.markmap-node'));
      nodes.forEach((node) => node.removeAttribute('data-markmap-search'));
      if (!searchQuery.trim()) {
        onSearchMatches?.(0);
        return;
      }
      const needle = normalizeSearchText(searchQuery);
      const matches = nodes.filter((node) => normalizeSearchText(node.textContent ?? '').includes(needle));
      matches.forEach((node) => node.dataset.markmapSearch = 'match');
      onSearchMatches?.(matches.length);
      const active = matches[activeSearchIndex];
      if (active) {
        active.dataset.markmapSearch = 'current';
        controls.focusElement(active);
      }
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [activeSearchIndex, controls.ready, controls.revision, onSearchMatches, searchQuery]);

  return (
    <div className="relative h-full min-h-0 bg-card" onWheel={(event) => { if (event.ctrlKey) { event.preventDefault(); controls.zoomBy(event.deltaY < 0 ? 1.12 : 0.89); } }}>
      {!controls.ready && !controls.error && <div className="absolute inset-0 z-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      {controls.error && <p role="alert" className="absolute left-4 right-4 top-4 z-10 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{controls.error}</p>}
      <svg ref={localRef} className="markmap-svg" role="img" aria-label="Mapa mental interactivo" />
    </div>
  );
});

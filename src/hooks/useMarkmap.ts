import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Markmap } from 'markmap-view';

export function useMarkmap(svgRef: RefObject<SVGSVGElement>, content: string) {
  const instanceRef = useRef<Markmap | null>(null);
  const transformerRef = useRef<import('markmap-lib').Transformer | null>(null);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const [{ Markmap: MarkmapClass }, { Transformer }] = await Promise.all([import('markmap-view'), import('markmap-lib')]);
        if (cancelled || !svgRef.current) return;
        transformerRef.current = new Transformer();
        instanceRef.current = MarkmapClass.create(svgRef.current, {
          duration: 220,
          maxWidth: 320,
          paddingX: 18,
          spacingVertical: 12,
          initialExpandLevel: -1,
        });
        setReady(true);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo iniciar Markmap.');
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      svgRef.current?.replaceChildren();
    };
  }, [svgRef]);

  useEffect(() => {
    if (!ready || !instanceRef.current || !transformerRef.current) return;
    let cancelled = false;
    const render = async () => {
      try {
        const { root } = transformerRef.current!.transform(content);
        await instanceRef.current!.setData(root);
        await instanceRef.current!.fit();
        if (!cancelled) {
          setError(null);
          setRevision((value) => value + 1);
        }
      } catch (transformError) {
        if (!cancelled) setError(transformError instanceof Error ? transformError.message : 'No se pudo transformar el Markdown.');
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [content, ready]);

  const fit = useCallback(() => instanceRef.current?.fit(), []);

  const zoomBy = useCallback((factor: number) => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.svg.transition().duration(180).call(instance.zoom.scaleBy, factor);
  }, []);

  const focusElement = useCallback((element: SVGGElement) => {
    const instance = instanceRef.current;
    const matrix = element.transform.baseVal.consolidate()?.matrix;
    if (instance && matrix) {
      instance.svg.transition().duration(260).call(instance.zoom.translateTo, matrix.e, matrix.f);
    }
  }, []);

  const toggleAll = useCallback((collapse: boolean) => {
    const instance = instanceRef.current;
    const transformer = transformerRef.current;
    if (!instance || !transformer) return;
    const { root } = transformer.transform(content);
    const visit = (node: typeof root) => {
      if (node.children?.length) node.payload = { ...node.payload, fold: collapse ? 1 : 0 };
      node.children?.forEach(visit);
    };
    visit(root);
    void instance.setData(root)
      .then(() => instance.fit())
      .then(() => setRevision((value) => value + 1))
      .catch((renderError: unknown) => setError(renderError instanceof Error ? renderError.message : 'No se pudo actualizar el mapa.'));
  }, [content]);

  return { ready, revision, error, fit, zoomBy, focusElement, toggleAll };
}

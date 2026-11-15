import type { MathSpeechRange, SpeechSegment, WordRange } from '@/types';
import { findMatches, findSentenceRange } from './text';
import { latexToSpeech } from './mathSpeech';

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, td, th';

interface TextNodeOffset {
  node: Text;
  start: number;
  end: number;
}

export interface DomSpeechSegment extends SpeechSegment {
  element: HTMLElement;
  nodes: TextNodeOffset[];
}

export interface DocumentTextMap {
  root: HTMLElement;
  segments: DomSpeechSegment[];
}

/**
 * Recorre un bloque en orden de documento recogiendo sus nodos de texto
 * visibles y sus fórmulas KaTeX como rangos con lectura en español.
 * El MathML de KaTeX (invisible, con la anotación del código TeX) se excluye:
 * si se incluyera, la voz leería el código fuente literalmente y el
 * auto-scroll saltaría entre nodos invisibles.
 */
function collectSegmentParts(element: HTMLElement): { nodes: TextNodeOffset[]; mathRanges: MathSpeechRange[]; text: string } {
  const nodes: TextNodeOffset[] = [];
  const mathRanges: MathSpeechRange[] = [];
  let text = '';
  const pushTextNode = (node: Text) => {
    const value = (node.textContent ?? '').replace(/\u00a0/g, ' ');
    if (value !== node.textContent) node.textContent = value;
    if (!value) return;
    nodes.push({ node, start: text.length, end: text.length + value.length });
    text += value;
  };
  const walk = (parent: Node) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        pushTextNode(child as Text);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      if (el.closest('script, style, [data-no-tts]')) continue;
      if (el.classList.contains('katex')) {
        const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? '';
        const start = text.length;
        const html = el.querySelector('.katex-html');
        if (html) {
          const walker = document.createTreeWalker(html, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => (node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
          });
          let glyph = walker.nextNode() as Text | null;
          while (glyph) {
            pushTextNode(glyph);
            glyph = walker.nextNode() as Text | null;
          }
        }
        const glyphText = text.slice(start);
        mathRanges.push({ start, end: text.length, tex, spoken: tex ? latexToSpeech(tex) : glyphText });
        continue;
      }
      if (el.tagName.toLowerCase() === 'math' || el.classList.contains('katex-mathml')) continue;
      walk(el);
    }
  };
  walk(element);
  return { nodes, mathRanges, text };
}

/**
 * Devuelve el índice del segmento de lectura bajo un punto de la pantalla
 * (coordenadas de cliente), o null si el punto no está sobre texto mapeado.
 * Se usa para "Empezar lectura desde aquí" del menú contextual: el navegador
 * resuelve el nodo de texto más cercano al cursor y se busca el segmento que
 * lo contiene (con respaldo por contención para imágenes, enlaces y saltos).
 */
export function segmentIndexAtPoint(map: DocumentTextMap | null, clientX: number, clientY: number): number | null {
  if (!map) return null;
  const doc = map.root.ownerDocument;
  let node: Node | null = null;
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) node = range.startContainer;
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(clientX, clientY);
    if (position) node = position.offsetNode;
  }
  if (!node) return null;
  for (let index = 0; index < map.segments.length; index += 1) {
    const segment = map.segments[index];
    const hit = segment.nodes.some((item) => item.node === node)
      || (node.nodeType === Node.ELEMENT_NODE && segment.element.contains(node));
    if (!hit) continue;
    // El navegador devuelve el nodo más cercano aunque el clic caiga en zona
    // vacía: solo se acepta si el punto está dentro del bloque del párrafo.
    const rect = segment.element.getBoundingClientRect();
    const tolerance = 6;
    const inside = clientX >= rect.left - tolerance && clientX <= rect.right + tolerance
      && clientY >= rect.top - tolerance && clientY <= rect.bottom + tolerance;
    return inside ? index : null;
  }
  return null;
}

export function buildDomTextMap(root: HTMLElement): DocumentTextMap {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
    .filter((element) => !element.querySelector(BLOCK_SELECTOR));
  const elements = candidates.length ? candidates : [root];
  const segments = elements.flatMap((element, index): DomSpeechSegment[] => {
    const { nodes, mathRanges, text } = collectSegmentParts(element);
    if (!text.trim()) return [];
    return [{ id: element.id || `dom-segment-${index}`, element, nodes, text, ...(mathRanges.length ? { mathRanges } : {}) }];
  });
  return { root, segments };
}

function createRange(segment: DomSpeechSegment, start: number, end: number): Range | null {
  const range = document.createRange();
  let started = false;
  for (const item of segment.nodes) {
    if (!started && start >= item.start && start <= item.end) {
      range.setStart(item.node, Math.max(0, Math.min(item.node.length, start - item.start)));
      started = true;
    }
    if (started && end >= item.start && end <= item.end) {
      range.setEnd(item.node, Math.max(0, Math.min(item.node.length, end - item.start)));
      return range;
    }
  }
  if (started && segment.nodes.length) {
    const last = segment.nodes.at(-1)!;
    range.setEnd(last.node, last.node.length);
    return range;
  }
  range.detach();
  return null;
}

type HighlightInstance = { /* Estructura opaca de CSS Custom Highlight API. */ };
type HighlightConstructor = new (...ranges: Range[]) => HighlightInstance;
type HighlightRegistry = { set(name: string, highlight: HighlightInstance): void; delete(name: string): void };

function highlightApi() {
  const constructor = (window as unknown as { Highlight?: HighlightConstructor }).Highlight;
  const registry = (window.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights;
  return constructor && registry ? { constructor, registry } : null;
}

function clearOverlay(root: HTMLElement): void {
  root.querySelectorAll('[data-openhub-highlight-overlay="word"], [data-openhub-highlight-overlay="phrase"]').forEach((node) => node.remove());
  root.querySelectorAll('[data-openhub-phrase]').forEach((node) => node.removeAttribute('data-openhub-phrase'));
}

function paintOverlay(root: HTMLElement, range: Range, kind: 'word' | 'phrase' | 'search' | 'search-current'): void {
  const rootRect = root.getBoundingClientRect();
  const zoom = Number(getComputedStyle(root).zoom) || 1;
  const overlay = document.createElement('div');
  overlay.dataset.openhubHighlightOverlay = kind;
  overlay.className = 'openhub-highlight-overlay';
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 1 || rect.height < 1) continue;
    const mark = document.createElement('mark');
    mark.className = `openhub-fallback-${kind}`;
    mark.style.left = `${(rect.left - rootRect.left) / zoom + root.scrollLeft}px`;
    mark.style.top = `${(rect.top - rootRect.top) / zoom + root.scrollTop}px`;
    mark.style.width = `${rect.width / zoom}px`;
    mark.style.height = `${rect.height / zoom}px`;
    overlay.append(mark);
  }
  root.append(overlay);
}

export function clearSpeechHighlights(map?: DocumentTextMap | null): void {
  const api = typeof window !== 'undefined' ? highlightApi() : null;
  api?.registry.delete('openhub-word');
  api?.registry.delete('openhub-phrase');
  if (map) clearOverlay(map.root);
}

export function applySpeechHighlights(
  map: DocumentTextMap | null,
  segmentId: string | null,
  word: WordRange | null,
  autoScroll = true,
): void {
  if (!map) return;
  clearSpeechHighlights(map);
  const segment = map.segments.find(({ id }) => id === segmentId);
  if (!segment) return;

  const sentence = word ? findSentenceRange(segment.text, word) : { start: 0, end: segment.text.length };
  const phraseRange = createRange(segment, sentence.start, sentence.end);
  const wordRange = word ? createRange(segment, word.start, word.end) : null;
  const api = highlightApi();
  if (api) {
    if (phraseRange) api.registry.set('openhub-phrase', new api.constructor(phraseRange));
    if (wordRange) api.registry.set('openhub-word', new api.constructor(wordRange));
  } else {
    if (phraseRange) paintOverlay(map.root, phraseRange, 'phrase');
    if (wordRange) paintOverlay(map.root, wordRange, 'word');
  }
  // Los rangos colapsados (p. ej. una palabra dentro de una fórmula) no deben
  // mover el scroll: su rectángulo es 0 y haría saltar el visor.
  if (autoScroll && wordRange && !wordRange.collapsed) scrollRangeIntoView(wordRange, segment.element);
  phraseRange?.detach();
}

export function clearSearchHighlights(map?: DocumentTextMap | null): void {
  const api = typeof window !== 'undefined' ? highlightApi() : null;
  api?.registry.delete('openhub-search');
  api?.registry.delete('openhub-search-current');
  map?.root.querySelectorAll('[data-openhub-highlight-overlay="search"], [data-openhub-highlight-overlay="search-current"]').forEach((node) => node.remove());
}

export function applySearchHighlights(map: DocumentTextMap | null, query: string, activeIndex = -1, scroll = false): void {
  clearSearchHighlights(map);
  if (!map || !query.trim()) return;
  const ranges: Range[] = [];
  const owners: HTMLElement[] = [];
  let remaining = 500;
  for (const segment of map.segments) {
    if (remaining <= 0) break;
    const matches = findMatches(segment.text, query).slice(0, remaining);
    remaining -= matches.length;
    for (const match of matches) {
      const range = createRange(segment, match.index, match.index + match.length);
      if (!range) continue;
      ranges.push(range);
      owners.push(segment.element);
    }
  }
  const api = highlightApi();
  if (api && ranges.length) {
    api.registry.set('openhub-search', new api.constructor(...ranges));
    if (activeIndex >= 0 && ranges[activeIndex]) api.registry.set('openhub-search-current', new api.constructor(ranges[activeIndex]));
  } else {
    ranges.forEach((range, index) => paintOverlay(map.root, range, index === activeIndex ? 'search-current' : 'search'));
  }
  if (scroll && activeIndex >= 0 && ranges[activeIndex]) scrollRangeIntoView(ranges[activeIndex], owners[activeIndex]);
}

export function scrollRangeIntoView(range: Range, element: HTMLElement): void {
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (!rect || (rect.width < 1 && rect.height < 1)) return;
  let container = element.parentElement;
  while (container && container !== document.body) {
    const style = getComputedStyle(container);
    if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) break;
    container = container.parentElement;
  }
  if (!container || container === document.body) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const bounds = container.getBoundingClientRect();
  if (rect.top < bounds.top + 70 || rect.bottom > bounds.bottom - 70) {
    container.scrollTo({
      top: Math.max(0, container.scrollTop + rect.top - bounds.top - container.clientHeight * 0.35),
      behavior: 'smooth',
    });
  }
}

import type { SpeechSegment, WordRange } from '@/types';
import { findMatches, findSentenceRange } from './text';

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

function textNodes(element: HTMLElement): TextNodeOffset[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, [data-no-tts]')) return NodeFilter.FILTER_REJECT;
      return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: TextNodeOffset[] = [];
  let offset = 0;
  let current = walker.nextNode() as Text | null;
  while (current) {
    const text = (current.textContent ?? '').replace(/\u00a0/g, ' ');
    if (text !== current.textContent) current.textContent = text;
    nodes.push({ node: current, start: offset, end: offset + text.length });
    offset += text.length;
    current = walker.nextNode() as Text | null;
  }
  return nodes;
}

export function buildDomTextMap(root: HTMLElement): DocumentTextMap {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
    .filter((element) => !element.querySelector(BLOCK_SELECTOR));
  const elements = candidates.length ? candidates : [root];
  const segments = elements.flatMap((element, index): DomSpeechSegment[] => {
    const nodes = textNodes(element);
    const text = nodes.map(({ node }) => node.textContent ?? '').join('');
    if (!text.trim()) return [];
    return [{ id: element.id || `dom-segment-${index}`, element, nodes, text }];
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
  const overlay = document.createElement('div');
  overlay.dataset.openhubHighlightOverlay = kind;
  overlay.className = 'openhub-highlight-overlay';
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 1 || rect.height < 1) continue;
    const mark = document.createElement('mark');
    mark.className = `openhub-fallback-${kind}`;
    mark.style.left = `${rect.left - rootRect.left + root.scrollLeft}px`;
    mark.style.top = `${rect.top - rootRect.top + root.scrollTop}px`;
    mark.style.width = `${rect.width}px`;
    mark.style.height = `${rect.height}px`;
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
  if (autoScroll && wordRange) scrollRangeIntoView(wordRange, segment.element);
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
  const segment = map?.segments[0];
  if (!map || !segment || !query.trim()) return;
  const matches = findMatches(segment.text, query).slice(0, 500);
  const ranges = matches.flatMap((match) => {
    const range = createRange(segment, match.index, match.index + match.length);
    return range ? [range] : [];
  });
  const api = highlightApi();
  if (api && ranges.length) {
    api.registry.set('openhub-search', new api.constructor(...ranges));
    if (activeIndex >= 0 && ranges[activeIndex]) api.registry.set('openhub-search-current', new api.constructor(ranges[activeIndex]));
  } else {
    ranges.forEach((range, index) => paintOverlay(map.root, range, index === activeIndex ? 'search-current' : 'search'));
  }
  if (scroll && activeIndex >= 0 && ranges[activeIndex]) scrollRangeIntoView(ranges[activeIndex], segment.element);
}

export function scrollRangeIntoView(range: Range, element: HTMLElement): void {
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (!rect) return;
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

/** Obtiene únicamente la selección perteneciente al documento visible. */
export function selectedDocumentText(root: HTMLElement | null): string {
  if (!root || typeof window === 'undefined') return '';
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement && root.contains(active)) {
    return active.value.slice(active.selectionStart, active.selectionEnd).trim();
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;
  if (!element || !root.contains(element) || element.closest('button, input, select, [role="dialog"], [data-no-selection]')) return '';
  return selection.toString().trim();
}

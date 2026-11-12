export interface DocumentHeading {
  id: string;
  level: number;
  text: string;
}

function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim();
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'seccion';
}

export function headingId(text: string, index: number): string {
  return `openhub-heading-${index}-${slug(text)}`;
}

export function extractHeadings(markdown: string): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  let insideFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = plainMarkdown(match[2]);
    if (!text) continue;
    headings.push({ id: headingId(text, headings.length), level: match[1].length, text });
  }
  return headings;
}

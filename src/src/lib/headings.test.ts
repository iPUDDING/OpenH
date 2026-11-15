import { describe, expect, it } from 'vitest';
import { extractHeadings } from './headings';

describe('índice Markdown', () => {
  it('extrae niveles, limpia formato e ignora bloques de código', () => {
    const headings = extractHeadings('# Título **principal**\n```md\n# No es un título\n```\n## [Enlace](https://example.com)');
    expect(headings).toHaveLength(2);
    expect(headings[0]).toMatchObject({ level: 1, text: 'Título principal' });
    expect(headings[1]).toMatchObject({ level: 2, text: 'Enlace' });
    expect(headings[0].id).not.toBe(headings[1].id);
  });
});

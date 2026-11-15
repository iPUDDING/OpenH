import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseDocx } from './docx';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function makeDocx(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Resumen de kinesiología</w:t></w:r></w:p>
<w:p><w:r><w:t>La </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>fisioterapia</w:t></w:r><w:r><w:t> ayuda.</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Primer punto</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Segundo punto</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Columna A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Columna B</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:hyperlink r:id="rId2"><w:r><w:t>Enlace de ejemplo</w:t></w:r></w:hyperlink></w:p>
</w:body>
</w:document>`;

const RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com" TargetMode="External"/>
</Relationships>`;

const NUMBERING = `<?xml version="1.0"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

describe('conversión DOCX a HTML', () => {
  it('convierte encabezados, negrita, listas, tablas, imágenes y enlaces', async () => {
    const data = await makeDocx({
      'word/document.xml': DOCUMENT,
      'word/_rels/document.xml.rels': RELS,
      'word/numbering.xml': NUMBERING,
      'word/media/image1.png': new Uint8Array(Buffer.from(PNG_1X1, 'base64')),
    });
    const { html } = await parseDocx(data);
    expect(html).toContain('<h1>Resumen de kinesiología</h1>');
    expect(html).toContain('<strong>fisioterapia</strong>');
    expect(html).toContain('<ul><li>Primer punto</li><li>Segundo punto</li></ul>');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Columna A</th>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('rechaza archivos sin documento principal', async () => {
    const data = await makeDocx({ 'word/other.xml': '<root/>' });
    await expect(parseDocx(data)).rejects.toThrow('word/document.xml');
  });

  it('rechaza archivos que no son ZIP', async () => {
    await expect(parseDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow('ZIP');
  });
});

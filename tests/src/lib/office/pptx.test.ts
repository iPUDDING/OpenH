import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parsePptx } from './pptx';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function makePptx(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

const PRESENTATION = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
</p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`;

const SLIDE1 = `<?xml version="1.0"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Fisioterapia respiratoria</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>
<a:p><a:r><a:t>Introducción al tema.</a:t></a:r></a:p>
<a:p><a:pPr lvl="1"/><a:r><a:t>Punto con sangría</a:t></a:r></a:p>
</p:txBody></p:sp>
<p:graphicFrame><a:graphic><a:graphicData><a:tbl>
<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Encabezado</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Dato</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
</a:tbl></a:graphicData></a:graphic></p:graphicFrame>
<p:pic><p:nvPicPr><p:cNvPr descr="Diagrama de flujo"/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>
</p:spTree></p:cSld>
</p:sld>`;

const SLIDE1_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

const SLIDE2 = `<?xml version="1.0"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Segunda diapositiva</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
</p:sld>`;

const SLIDE2_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`;

const NOTES = `<?xml version="1.0"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Recordar la práctica de hoy.</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
</p:notes>`;

describe('conversión PPTX a HTML', () => {
  it('convierte títulos, cuerpo, listas, tablas, imágenes y notas en orden', async () => {
    const data = await makePptx({
      'ppt/presentation.xml': PRESENTATION,
      'ppt/_rels/presentation.xml.rels': PRESENTATION_RELS,
      'ppt/slides/slide1.xml': SLIDE1,
      'ppt/slides/_rels/slide1.xml.rels': SLIDE1_RELS,
      'ppt/slides/slide2.xml': SLIDE2,
      'ppt/slides/_rels/slide2.xml.rels': SLIDE2_RELS,
      'ppt/notesSlides/notesSlide1.xml': NOTES,
      'ppt/media/image1.png': new Uint8Array(Buffer.from(PNG_1X1, 'base64')),
    });
    const { html } = await parsePptx(data);
    expect(html).toContain('<h1>Fisioterapia respiratoria</h1>');
    expect(html).toContain('<p>Introducción al tema.</p>');
    expect(html).toContain('<ul><li>Punto con sangría</li></ul>');
    expect(html).toContain('<th>Encabezado</th>');
    expect(html).toContain('<td>Dato</td>');
    expect(html).toContain('<img src="data:image/png;base64,');
    expect(html).toContain('alt="Diagrama de flujo"');
    expect(html).toContain('<hr>');
    expect(html).toContain('<h1>Segunda diapositiva</h1>');
    expect(html).toContain('<blockquote>Recordar la práctica de hoy.</blockquote>');
    expect(html.indexOf('Fisioterapia respiratoria')).toBeLessThan(html.indexOf('Segunda diapositiva'));
  });

  it('rechaza archivos sin presentación', async () => {
    const data = await makePptx({ 'ppt/other.xml': '<root/>' });
    await expect(parsePptx(data)).rejects.toThrow('ppt/presentation.xml');
  });
});

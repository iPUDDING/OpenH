// Genera archivos DOCX/PPTX reales de prueba para QA (tests/fixtures/).
// Uso: node scripts/generate-fixtures.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import JSZip from 'jszip';

const outputDir = new URL('../tests/fixtures/', import.meta.url).pathname;
await mkdir(outputDir, { recursive: true });

// PNG sólido mínimo (sin dependencias): rectángulo de color con borde.
function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function makePng(width, height, [r, g, b]) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const border = x < 4 || y < 4 || x >= width - 4 || y >= height - 4;
      const [br, bg, bb] = border ? [37, 99, 235] : [r, g, b];
      raw[row + 1 + x * 3] = br;
      raw[row + 2 + x * 3] = bg;
      raw[row + 3 + x * 3] = bb;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const diagramPng = makePng(320, 140, [219, 234, 254]);

const DOCX_DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Fisioterapia respiratoria</w:t></w:r></w:p>
<w:p><w:r><w:t>La </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>fisioterapia respiratoria</w:t></w:r><w:r><w:t> es una disciplina de la kinesiología que busca mejorar la función pulmonar y la oxigenación.</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Técnicas principales</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Drenaje postural</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Percusión torácica</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Ejercicios respiratorios</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Indicaciones</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Técnica</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Indicación</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Drenaje postural</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Secreciones retenidas</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Percusión</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Neumonía</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:drawing><wp:inline><wp:extent cx="4572000" cy="2000000"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
<w:p><w:r><w:t>Material de referencia: </w:t></w:r><w:hyperlink r:id="rId2"><w:r><w:t>guía de técnicas</w:t></w:r></w:hyperlink><w:r><w:t>.</w:t></w:r></w:p>
</w:body>
</w:document>`;

const DOCX_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/guia" TargetMode="External"/>
</Relationships>`;

const DOCX_NUMBERING = `<?xml version="1.0"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

const PPTX_PRESENTATION = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
</p:presentation>`;

const PPTX_PRESENTATION_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`;

const PPTX_SLIDE1 = `<?xml version="1.0"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Fisioterapia respiratoria</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>
<a:p><a:r><a:t>Introducción a las técnicas de higiene bronquial.</a:t></a:r></a:p>
<a:p><a:pPr lvl="1"/><a:r><a:t>Drenaje postural</a:t></a:r></a:p>
<a:p><a:pPr lvl="1"/><a:r><a:t>Percusión torácica</a:t></a:r></a:p>
</p:txBody></p:sp>
<p:graphicFrame><a:graphic><a:graphicData><a:tbl>
<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Técnica</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Indicación</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Drenaje postural</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Secreciones retenidas</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
</a:tbl></a:graphicData></a:graphic></p:graphicFrame>
<p:pic><p:nvPicPr><p:cNvPr descr="Diagrama de flujo"/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>
</p:spTree></p:cSld>
</p:sld>`;

const PPTX_SLIDE1_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

const PPTX_SLIDE2 = `<?xml version="1.0"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Técnicas y práctica</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>
<a:p><a:r><a:t>Repasar posiciones de drenaje con el grupo.</a:t></a:r></a:p>
</p:txBody></p:sp>
</p:spTree></p:cSld>
</p:sld>`;

const PPTX_SLIDE2_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`;

const PPTX_NOTES = `<?xml version="1.0"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Recordar la práctica de hoy con el grupo.</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld>
</p:notes>`;

const docx = new JSZip();
docx.file('word/document.xml', DOCX_DOCUMENT);
docx.file('word/_rels/document.xml.rels', DOCX_RELS);
docx.file('word/numbering.xml', DOCX_NUMBERING);
docx.file('word/media/image1.png', diagramPng);
await writeFile(`${outputDir}muestra.docx`, await docx.generateAsync({ type: 'nodebuffer' }));

const pptx = new JSZip();
pptx.file('ppt/presentation.xml', PPTX_PRESENTATION);
pptx.file('ppt/_rels/presentation.xml.rels', PPTX_PRESENTATION_RELS);
pptx.file('ppt/slides/slide1.xml', PPTX_SLIDE1);
pptx.file('ppt/slides/_rels/slide1.xml.rels', PPTX_SLIDE1_RELS);
pptx.file('ppt/slides/slide2.xml', PPTX_SLIDE2);
pptx.file('ppt/slides/_rels/slide2.xml.rels', PPTX_SLIDE2_RELS);
pptx.file('ppt/notesSlides/notesSlide1.xml', PPTX_NOTES);
pptx.file('ppt/media/image1.png', diagramPng);
await writeFile(`${outputDir}muestra.pptx`, await pptx.generateAsync({ type: 'nodebuffer' }));

const XLSX_WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Técnicas" sheetId="1" r:id="rId1"/><sheet name="Resumen" sheetId="2" r:id="rId2"/></sheets>
</workbook>`;

const XLSX_WORKBOOK_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;

const XLSX_SHARED_STRINGS = `<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
<si><t>Técnica</t></si>
<si><t>Drenaje postural</t></si>
<si><t>Secreciones retenidas</t></si>
</sst>`;

const XLSX_SHEET1 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>42</v></c><c r="C2" t="b"><v>1</v></c></row>
</sheetData>
<hyperlinks><hyperlink ref="B2" r:id="rId1"/></hyperlinks>
</worksheet>`;

const XLSX_SHEET1_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/guia" TargetMode="External"/>
</Relationships>`;

const XLSX_SHEET2 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1"><v>7</v></c></row>
</sheetData>
</worksheet>`;

const xlsx = new JSZip();
xlsx.file('xl/workbook.xml', XLSX_WORKBOOK);
xlsx.file('xl/_rels/workbook.xml.rels', XLSX_WORKBOOK_RELS);
xlsx.file('xl/sharedStrings.xml', XLSX_SHARED_STRINGS);
xlsx.file('xl/worksheets/sheet1.xml', XLSX_SHEET1);
xlsx.file('xl/worksheets/_rels/sheet1.xml.rels', XLSX_SHEET1_RELS);
xlsx.file('xl/worksheets/sheet2.xml', XLSX_SHEET2);
await writeFile(`${outputDir}muestra.xlsx`, await xlsx.generateAsync({ type: 'nodebuffer' }));

console.log('Fixtures generadas: tests/fixtures/muestra.docx, muestra.pptx y muestra.xlsx');

import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseXlsx } from './xlsx';

async function makeXlsx(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

const WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Técnicas" sheetId="1" r:id="rId1"/><sheet name="Resumen" sheetId="2" r:id="rId2"/></sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;

const SHARED_STRINGS = `<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
<si><t>Técnica</t></si>
<si><t>Drenaje postural</t></si>
<si><t>Secreciones retenidas</t></si>
<si><r><t>Texto </t></r><r><t>rico</t></r></si>
</sst>`;

const SHEET1 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>42</v></c><c r="C2" t="b"><v>1</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>Nota al pie</t></is></c><c r="C3" t="str"><v>resultado</v></c></row>
</sheetData>
<mergeCells count="1"><mergeCell ref="A3:B3"/></mergeCells>
<hyperlinks><hyperlink ref="B2" r:id="rId1"/></hyperlinks>
</worksheet>`;

const SHEET1_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/guia" TargetMode="External"/>
</Relationships>`;

const SHEET2 = `<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1"><v>7</v></c></row>
</sheetData>
</worksheet>`;

describe('conversión XLSX a HTML', () => {
  it('convierte hojas, cadenas compartidas, números, booleanos, combinadas e hipervínculos', async () => {
    const data = await makeXlsx({
      'xl/workbook.xml': WORKBOOK,
      'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
      'xl/sharedStrings.xml': SHARED_STRINGS,
      'xl/worksheets/sheet1.xml': SHEET1,
      'xl/worksheets/_rels/sheet1.xml.rels': SHEET1_RELS,
      'xl/worksheets/sheet2.xml': SHEET2,
    });
    const { html } = await parseXlsx(data);
    expect(html).toContain('<h2>Técnicas</h2>');
    expect(html).toContain('<td>Técnica</td>');
    expect(html).toContain('<td>Drenaje postural</td>');
    expect(html).toContain('<td>Secreciones retenidas</td>');
    expect(html).toContain('<td>Texto rico</td>');
    expect(html).toContain('<td>VERDADERO</td>');
    expect(html).toContain('<td>resultado</td>');
    expect(html).toContain('<td colspan="2">Nota al pie</td>');
    expect(html).toContain('<a href="https://example.com/guia" target="_blank" rel="noreferrer noopener">42</a>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<h2>Resumen</h2>');
    expect(html.indexOf('Técnicas')).toBeLessThan(html.indexOf('Resumen'));
  });

  it('rechaza archivos sin libro', async () => {
    const data = await makeXlsx({ 'xl/other.xml': '<root/>' });
    await expect(parseXlsx(data)).rejects.toThrow('xl/workbook.xml');
  });

  it('rechaza archivos que no son ZIP', async () => {
    await expect(parseXlsx(new Uint8Array([1, 2, 3]))).rejects.toThrow('ZIP');
  });
});

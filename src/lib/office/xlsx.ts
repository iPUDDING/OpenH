import type JSZip from 'jszip';
import { attr, childNamed, childrenNamed, descendantsNamed, type XmlNode } from './xml';
import { escapeHtml } from '../text';
import { loadZip, readRels, readXmlFile, resolveTarget, type OfficeDocument } from './shared';

interface CellData {
  text: string;
  href?: string;
  colspan: number;
  rowspan: number;
}

interface SheetGrid {
  rows: Map<number, Map<number, CellData>>;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

/** Convierte letras de columna (`A`, `BC`) a índice 0-based. */
function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Convierte un índice 0-based a letras de columna (`A`, `BC`). */
function columnLetters(index: number): string {
  let remaining = index + 1;
  let letters = '';
  while (remaining > 0) {
    const offset = (remaining - 1) % 26;
    letters = String.fromCharCode(65 + offset) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

/** Extrae `col`/`row` 0-based de una referencia como `BC12`. */
function parseRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  return { col: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

/** Texto concatenado de todos los `<t>` de un nodo (cadenas ricas). */
function richText(node: XmlNode): string {
  return descendantsNamed(node, 't').map((t) => t.text).join('');
}

async function loadSharedStrings(zip: JSZip): Promise<string[]> {
  const root = await readXmlFile(zip, 'xl/sharedStrings.xml');
  if (!root) return [];
  return childrenNamed(root, 'si').map((si) => richText(si));
}

function cellText(cell: XmlNode, sharedStrings: string[]): string {
  const type = attr(cell, 't');
  const value = childNamed(cell, 'v');
  const inline = childNamed(cell, 'is');
  if (type === 'inlineStr' && inline) return richText(inline);
  if (!value) return '';
  const raw = value.text;
  if (type === 's') {
    const index = Number(raw);
    return Number.isInteger(index) && sharedStrings[index] !== undefined ? sharedStrings[index] : '';
  }
  if (type === 'b') return raw === '1' ? 'VERDADERO' : 'FALSO';
  if (type === 'e') return raw;
  return raw;
}

function parseSheetGrid(sheet: XmlNode, sharedStrings: string[]): SheetGrid {
  const grid: SheetGrid = {
    rows: new Map(),
    minRow: Number.POSITIVE_INFINITY,
    maxRow: -1,
    minCol: Number.POSITIVE_INFINITY,
    maxCol: -1,
  };
  const sheetData = childNamed(sheet, 'sheetData');
  if (!sheetData) return grid;

  const put = (row: number, col: number, data: CellData) => {
    let rowMap = grid.rows.get(row);
    if (!rowMap) {
      rowMap = new Map();
      grid.rows.set(row, rowMap);
    }
    rowMap.set(col, data);
    grid.minRow = Math.min(grid.minRow, row);
    grid.maxRow = Math.max(grid.maxRow, row);
    grid.minCol = Math.min(grid.minCol, col);
    grid.maxCol = Math.max(grid.maxCol, col);
  };

  for (const rowNode of childrenNamed(sheetData, 'row')) {
    const rowIndex = Number(attr(rowNode, 'r') ?? '0') - 1;
    if (!Number.isFinite(rowIndex) || rowIndex < 0) continue;
    for (const cell of childrenNamed(rowNode, 'c')) {
      const ref = attr(cell, 'r');
      const position = ref ? parseRef(ref) : null;
      if (!position) continue;
      put(position.row, position.col, {
        text: cellText(cell, sharedStrings),
        colspan: 1,
        rowspan: 1,
      });
    }
  }

  // Celdas combinadas: el valor vive en la esquina superior izquierda.
  const mergeCells = childNamed(sheet, 'mergeCells');
  if (mergeCells) {
    for (const merge of childrenNamed(mergeCells, 'mergeCell')) {
      const ref = attr(merge, 'ref') ?? '';
      const [start, end] = ref.split(':');
      const from = start ? parseRef(start) : null;
      const to = end ? parseRef(end) : null;
      if (!from || !to) continue;
      const existing = grid.rows.get(from.row)?.get(from.col);
      if (existing) {
        existing.colspan = to.col - from.col + 1;
        existing.rowspan = to.row - from.row + 1;
      }
      // Marca las celdas cubiertas para no repetirlas al renderizar.
      for (let row = from.row; row <= to.row; row += 1) {
        for (let col = from.col; col <= to.col; col += 1) {
          if (row === from.row && col === from.col) continue;
          put(row, col, { text: '', colspan: 0, rowspan: 0 });
        }
      }
    }
  }
  return grid;
}

function sheetHyperlinks(sheet: XmlNode, rels: Map<string, string>): Map<string, string> {
  const links = new Map<string, string>();
  const hyperlinks = childNamed(sheet, 'hyperlinks');
  if (!hyperlinks) return links;
  for (const link of childrenNamed(hyperlinks, 'hyperlink')) {
    const ref = attr(link, 'ref');
    const rid = attr(link, 'r:id');
    if (!ref || !rid) continue;
    const target = rels.get(rid);
    if (target) links.set(ref, target);
  }
  return links;
}

function gridToTable(grid: SheetGrid, links: Map<string, string>): string {
  if (grid.maxRow < 0) return '';
  const rows: string[] = [];
  for (let row = grid.minRow; row <= grid.maxRow; row += 1) {
    const rowMap = grid.rows.get(row);
    const cells: string[] = [];
    for (let col = grid.minCol; col <= grid.maxCol; col += 1) {
      const data = rowMap?.get(col);
      if (!data) {
        cells.push('<td></td>');
        continue;
      }
      if (data.colspan === 0) continue; // celda cubierta por una combinada
      const ref = `${columnLetters(col)}${row + 1}`;
      const href = links.get(ref);
      const text = escapeHtml(data.text);
      const content = href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${text}</a>` : text;
      const span = `${data.colspan > 1 ? ` colspan="${data.colspan}"` : ''}${data.rowspan > 1 ? ` rowspan="${data.rowspan}"` : ''}`;
      cells.push(`<td${span}>${content}</td>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<table>${rows.join('')}</table>`;
}

/** Convierte un XLSX (bytes) a HTML semántico: una tabla por hoja. */
export async function parseXlsx(data: Uint8Array): Promise<OfficeDocument> {
  const zip = await loadZip(data);
  const workbook = await readXmlFile(zip, 'xl/workbook.xml');
  if (!workbook) throw new Error('El archivo XLSX no contiene el libro (xl/workbook.xml).');
  const rels = await readRels(zip, 'xl/_rels/workbook.xml.rels');
  const sheetsNode = childNamed(workbook, 'sheets');
  const sheetNodes = sheetsNode ? childrenNamed(sheetsNode, 'sheet') : [];
  if (!sheetNodes.length) throw new Error('El libro XLSX no contiene hojas.');
  const sharedStrings = await loadSharedStrings(zip);
  const parts: string[] = [];

  for (const sheetNode of sheetNodes) {
    const rid = attr(sheetNode, 'r:id');
    const target = rid ? rels.get(rid) : undefined;
    if (!target) continue;
    const sheetPath = resolveTarget('xl', target);
    const sheet = await readXmlFile(zip, sheetPath);
    if (!sheet) continue;
    const grid = parseSheetGrid(sheet, sharedStrings);
    const table = gridToTable(grid, sheetHyperlinks(sheet, await readRels(zip, `${sheetPath.split('/').slice(0, -1).join('/')}/_rels/${sheetPath.split('/').pop()}.rels`)));
    if (!table) continue;
    if (parts.length) parts.push('<hr>');
    const name = attr(sheetNode, 'name') ?? '';
    if (name) parts.push(`<h2>${escapeHtml(name)}</h2>`);
    parts.push(table);
  }

  const html = parts.join('');
  if (!html.trim()) throw new Error('El libro XLSX no contiene celdas con contenido.');
  return { html };
}

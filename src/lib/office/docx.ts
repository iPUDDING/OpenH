import type JSZip from 'jszip';
import { attr, childNamed, childrenNamed, descendantsNamed, type XmlNode } from './xml';
import { escapeHtml } from '../text';
import { createMediaLoader, imageHtml, loadZip, readRels, readXmlFile, resolveTarget, type OfficeDocument } from './shared';

interface DocxContext {
  zip: JSZip;
  rels: Map<string, string>;
  numbering: Map<string, Map<number, string>>;
  loadMedia: (path: string) => Promise<string | null>;
}

function isOn(rPr: XmlNode | undefined, tag: string): boolean {
  const element = rPr ? childNamed(rPr, tag) : undefined;
  if (!element) return false;
  const value = attr(element, 'w:val');
  return value === undefined || !['false', '0', 'off', 'none'].includes(value.toLowerCase());
}

/** Texto plano de un párrafo (para cajas de texto). */
function plainParagraphText(paragraph: XmlNode): string {
  return descendantsNamed(paragraph, 'w:t').map((node) => node.text).join(' ').trim();
}

async function runHtml(run: XmlNode, ctx: DocxContext): Promise<string> {
  const rPr = childNamed(run, 'w:rPr');
  const bold = isOn(rPr, 'w:b');
  const italic = isOn(rPr, 'w:i');
  const underline = (() => {
    const element = rPr ? childNamed(rPr, 'w:u') : undefined;
    if (!element) return false;
    const value = attr(element, 'w:val');
    return value === undefined || value.toLowerCase() !== 'none';
  })();
  const strike = isOn(rPr, 'w:strike');
  let inner = '';
  for (const child of run.children) {
    if (child.tag === 'w:t') inner += escapeHtml(child.text);
    else if (child.tag === 'w:tab') inner += ' ';
    else if (child.tag === 'w:br' || child.tag === 'w:cr') inner += '<br>';
    else if (child.tag === 'w:noBreakHyphen') inner += '-';
    else if (child.tag === 'w:softHyphen') inner += '';
    else if (child.tag === 'w:drawing' || child.tag === 'w:pict' || child.tag === 'w:object') {
      for (const blip of descendantsNamed(child, 'a:blip')) {
        const embed = attr(blip, 'r:embed') ?? attr(blip, 'r:link');
        if (!embed) continue;
        const target = ctx.rels.get(embed);
        if (target) inner += await imageHtml(ctx.loadMedia, resolveTarget('word', target));
      }
      for (const box of descendantsNamed(child, 'w:txbxContent')) {
        for (const paragraph of descendantsNamed(box, 'w:p')) {
          const text = plainParagraphText(paragraph);
          if (text) inner += `${escapeHtml(text)} `;
        }
      }
    }
  }
  if (!inner) return '';
  if (strike) inner = `<s>${inner}</s>`;
  if (underline) inner = `<u>${inner}</u>`;
  if (italic) inner = `<em>${inner}</em>`;
  if (bold) inner = `<strong>${inner}</strong>`;
  return inner;
}

async function hyperlinkHtml(link: XmlNode, ctx: DocxContext): Promise<string> {
  let inner = '';
  for (const run of childrenNamed(link, 'w:r')) inner += await runHtml(run, ctx);
  if (!inner) return '';
  const rid = attr(link, 'r:id');
  const anchor = attr(link, 'w:anchor');
  if (rid) {
    const target = ctx.rels.get(rid);
    if (target && /^(https?:|mailto:)/i.test(target)) {
      return `<a href="${escapeHtml(target)}" target="_blank" rel="noreferrer noopener">${inner}</a>`;
    }
    return inner;
  }
  if (anchor) return `<a href="#${escapeHtml(anchor)}">${inner}</a>`;
  return inner;
}

interface ParagraphInfo {
  html: string;
  headingLevel: number | null;
  list: { numId: string; ilvl: number } | null;
  empty: boolean;
}

async function paragraphInfo(paragraph: XmlNode, ctx: DocxContext): Promise<ParagraphInfo> {
  const pPr = childNamed(paragraph, 'w:pPr');
  const style = pPr ? attr(childNamed(pPr, 'w:pStyle'), 'w:val') : undefined;
  let headingLevel: number | null = null;
  if (style) {
    const match = /^heading\s*([1-6])$/i.exec(style) ?? /^heading([1-6])$/i.exec(style);
    if (match) headingLevel = Number(match[1]);
    else if (/^title$/i.test(style)) headingLevel = 1;
    else if (/^subtitle$/i.test(style)) headingLevel = 2;
  }
  if (headingLevel === null && pPr) {
    const outline = attr(childNamed(pPr, 'w:outlineLvl'), 'w:val');
    if (outline !== undefined) {
      const level = Number(outline);
      if (Number.isFinite(level) && level >= 0 && level < 6) headingLevel = level + 1;
    }
  }
  let list: ParagraphInfo['list'] = null;
  const numPr = pPr ? childNamed(pPr, 'w:numPr') : undefined;
  if (numPr) {
    const numId = attr(childNamed(numPr, 'w:numId'), 'w:val') ?? '0';
    const ilvl = Number(attr(childNamed(numPr, 'w:ilvl'), 'w:val') ?? '0');
    if (numId !== '0') list = { numId, ilvl: Number.isFinite(ilvl) ? ilvl : 0 };
  }
  let inner = '';
  for (const child of paragraph.children) {
    if (child.tag === 'w:pPr') continue;
    if (child.tag === 'w:r') inner += await runHtml(child, ctx);
    else if (child.tag === 'w:hyperlink') inner += await hyperlinkHtml(child, ctx);
    else if (child.tag === 'w:ins') {
      for (const run of childrenNamed(child, 'w:r')) inner += await runHtml(run, ctx);
    } else if (child.tag === 'w:del') {
      continue; // Texto eliminado por control de cambios: no se lee.
    } else if (child.tag === 'w:smartTag' || child.tag === 'w:sdt') {
      const content = child.tag === 'w:sdt' ? childNamed(child, 'w:sdtContent') : child;
      if (content) for (const run of descendantsNamed(content, 'w:r')) inner += await runHtml(run, ctx);
    }
  }
  return { html: inner, headingLevel, list, empty: !inner.trim() };
}

function listTag(ctx: DocxContext, numId: string, ilvl: number): 'ul' | 'ol' {
  const format = ctx.numbering.get(numId)?.get(ilvl) ?? 'bullet';
  return format === 'bullet' ? 'ul' : 'ol';
}

async function tableHtml(table: XmlNode, ctx: DocxContext): Promise<string> {
  const rows: string[] = [];
  let firstRow = true;
  for (const row of childrenNamed(table, 'w:tr')) {
    const cells: string[] = [];
    for (const cell of childrenNamed(row, 'w:tc')) {
      const tcPr = childNamed(cell, 'w:tcPr');
      const gridSpan = Number(attr(tcPr ? childNamed(tcPr, 'w:gridSpan') : undefined, 'w:val') ?? '1');
      const colspan = Number.isFinite(gridSpan) && gridSpan > 1 ? ` colspan="${gridSpan}"` : '';
      let inner = await blocksHtml(cell.children, ctx);
      // Una celda con un solo párrafo no necesita el <p> envolvente.
      const singleParagraph = /^<p>([\s\S]*)<\/p>$/.exec(inner);
      if (singleParagraph) inner = singleParagraph[1];
      const tag = firstRow ? 'th' : 'td';
      cells.push(`<${tag}${colspan}>${inner}</${tag}>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
    firstRow = false;
  }
  return `<table>${rows.join('')}</table>`;
}

async function blocksHtml(children: XmlNode[], ctx: DocxContext): Promise<string> {
  const parts: string[] = [];
  const stack: Array<{ ilvl: number; tag: 'ul' | 'ol' }> = [];
  const closeListLevel = () => {
    const level = stack.pop();
    if (level) parts.push(`</li></${level.tag}>`);
  };
  const closeAllLists = () => {
    while (stack.length) closeListLevel();
  };

  for (const child of children) {
    if (child.tag === 'w:p') {
      const info = await paragraphInfo(child, ctx);
      if (info.list) {
        const { numId, ilvl } = info.list;
        const tag = listTag(ctx, numId, ilvl);
        while (stack.length && stack.at(-1)!.ilvl > ilvl) closeListLevel();
        if (stack.length && stack.at(-1)!.ilvl === ilvl) {
          parts.push(`</li><li>${info.html}`);
        } else {
          let current = stack.at(-1)?.ilvl ?? -1;
          while (current < ilvl) {
            current += 1;
            stack.push({ ilvl: current, tag });
            parts.push(`<${tag}><li>`);
          }
          parts.push(info.html);
        }
        continue;
      }
      closeAllLists();
      if (info.empty) continue;
      parts.push(info.headingLevel ? `<h${info.headingLevel}>${info.html}</h${info.headingLevel}>` : `<p>${info.html}</p>`);
    } else if (child.tag === 'w:tbl') {
      closeAllLists();
      parts.push(await tableHtml(child, ctx));
    }
    // w:sectPr y otros elementos de bloque no aportan contenido legible.
  }
  closeAllLists();
  return parts.join('');
}

async function readNumbering(zip: JSZip): Promise<Map<string, Map<number, string>>> {
  const result = new Map<string, Map<number, string>>();
  const root = await readXmlFile(zip, 'word/numbering.xml');
  if (!root) return result;
  const abstract = new Map<string, Map<number, string>>();
  for (const item of childrenNamed(root, 'w:abstractNum')) {
    const id = attr(item, 'w:abstractNumId') ?? '';
    const levels = new Map<number, string>();
    for (const level of childrenNamed(item, 'w:lvl')) {
      const ilvl = Number(attr(level, 'w:ilvl') ?? '0');
      levels.set(ilvl, attr(childNamed(level, 'w:numFmt'), 'w:val') ?? 'bullet');
    }
    abstract.set(id, levels);
  }
  for (const num of childrenNamed(root, 'w:num')) {
    const numId = attr(num, 'w:numId') ?? '';
    const abstractId = attr(childNamed(num, 'w:abstractNumId'), 'w:val') ?? '';
    const levels = abstract.get(abstractId);
    if (levels) result.set(numId, levels);
  }
  return result;
}

/** Convierte un DOCX (bytes) a HTML semántico para el visor y la lectura TTS. */
export async function parseDocx(data: Uint8Array): Promise<OfficeDocument> {
  const zip = await loadZip(data);
  const document = await readXmlFile(zip, 'word/document.xml');
  if (!document) throw new Error('El archivo DOCX no contiene el documento principal (word/document.xml).');
  const rels = await readRels(zip, 'word/_rels/document.xml.rels');
  const numbering = await readNumbering(zip);
  const ctx: DocxContext = { zip, rels, numbering, loadMedia: createMediaLoader(zip) };
  const body = childNamed(document, 'w:body') ?? document;
  const html = await blocksHtml(body.children, ctx);
  if (!html.trim()) throw new Error('El documento DOCX no contiene texto legible.');
  return { html };
}

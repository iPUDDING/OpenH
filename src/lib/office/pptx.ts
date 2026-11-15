import type JSZip from 'jszip';
import { attr, childNamed, childrenNamed, descendantsNamed, type XmlNode } from './xml';
import { escapeHtml } from '../text';
import { createMediaLoader, imageHtml, loadZip, readRels, readXmlFile, resolveTarget, type OfficeDocument } from './shared';

interface PptxContext {
  loadMedia: (path: string) => Promise<string | null>;
}

function isOn(rPr: XmlNode | undefined, tag: string): boolean {
  const element = rPr ? childNamed(rPr, tag) : undefined;
  if (!element) return false;
  const value = attr(element, 'val');
  return value === undefined || !['0', 'false', 'off'].includes(value.toLowerCase());
}

/** Texto de un párrafo de diapositiva (`a:p`) con formato básico. */
async function paragraphRunsHtml(paragraph: XmlNode): Promise<string> {
  let inner = '';
  for (const child of paragraph.children) {
    if (child.tag === 'a:r') {
      const textNode = childNamed(child, 'a:t');
      if (!textNode) continue;
      let text = escapeHtml(textNode.text);
      if (!text) continue;
      const rPr = childNamed(child, 'a:rPr');
      if (isOn(rPr, 'a:i')) text = `<em>${text}</em>`;
      if (isOn(rPr, 'a:b')) text = `<strong>${text}</strong>`;
      inner += text;
    } else if (child.tag === 'a:br') {
      inner += '<br>';
    } else if (child.tag === 'a:fld') {
      const textNode = childNamed(child, 'a:t');
      if (textNode) inner += escapeHtml(textNode.text);
    }
  }
  return inner;
}

/** Agrupa `<li>` consecutivos en una sola lista. */
function groupListItems(parts: string[]): string {
  const grouped: string[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) grouped.push(`<ul>${items.join('')}</ul>`);
    items = [];
  };
  for (const part of parts) {
    if (part.startsWith('<li>')) items.push(part);
    else {
      flush();
      grouped.push(part);
    }
  }
  flush();
  return grouped.join('');
}

async function shapeHtml(shape: XmlNode): Promise<string> {
  const nvPr = childNamed(childNamed(shape, 'p:nvSpPr'), 'p:nvPr');
  const placeholder = nvPr ? childNamed(nvPr, 'p:ph') : undefined;
  const type = placeholder ? (attr(placeholder, 'type') ?? 'body') : 'body';
  const txBody = childNamed(shape, 'p:txBody');
  if (!txBody) return '';
  const parts: string[] = [];
  for (const paragraph of childrenNamed(txBody, 'a:p')) {
    const pPr = childNamed(paragraph, 'a:pPr');
    const level = Number(attr(pPr, 'lvl') ?? '0');
    const text = await paragraphRunsHtml(paragraph);
    if (!text.trim()) continue;
    if (type === 'title' || type === 'ctrTitle') parts.push(`<h1>${text}</h1>`);
    else if (type === 'subTitle') parts.push(`<h2>${text}</h2>`);
    else if (Number.isFinite(level) && level > 0) parts.push(`<li>${text}</li>`);
    else parts.push(`<p>${text}</p>`);
  }
  return groupListItems(parts);
}

async function tableHtml(frame: XmlNode): Promise<string> {
  const table = descendantsNamed(frame, 'a:tbl')[0];
  if (!table) return '';
  const rows: string[] = [];
  let firstRow = true;
  for (const row of childrenNamed(table, 'a:tr')) {
    const cells: string[] = [];
    for (const cell of childrenNamed(row, 'a:tc')) {
      const txBody = childNamed(cell, 'a:txBody');
      const paragraphs: string[] = [];
      if (txBody) {
        for (const paragraph of childrenNamed(txBody, 'a:p')) {
          const text = await paragraphRunsHtml(paragraph);
          if (text.trim()) paragraphs.push(text);
        }
      }
      const tag = firstRow ? 'th' : 'td';
      cells.push(`<${tag}>${paragraphs.join(' ')}</${tag}>`);
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
    firstRow = false;
  }
  return `<table>${rows.join('')}</table>`;
}

async function picHtml(pic: XmlNode, ctx: PptxContext, slideDir: string, rels: Map<string, string>): Promise<string> {
  const blip = descendantsNamed(pic, 'a:blip')[0];
  const embed = blip ? (attr(blip, 'r:embed') ?? attr(blip, 'r:link')) : undefined;
  if (!embed) return '';
  const target = rels.get(embed);
  if (!target) return '';
  const cNvPr = descendantsNamed(pic, 'p:cNvPr')[0];
  const alt = cNvPr ? (attr(cNvPr, 'descr') ?? attr(cNvPr, 'name') ?? '') : '';
  return imageHtml(ctx.loadMedia, resolveTarget(slideDir, target), alt);
}

async function spTreeHtml(node: XmlNode, ctx: PptxContext, slideDir: string, rels: Map<string, string>): Promise<string> {
  const parts: string[] = [];
  for (const child of node.children) {
    if (child.tag === 'p:sp') parts.push(await shapeHtml(child));
    else if (child.tag === 'p:pic') parts.push(await picHtml(child, ctx, slideDir, rels));
    else if (child.tag === 'p:graphicFrame') parts.push(await tableHtml(child));
    else if (child.tag === 'p:grpSp') parts.push(await spTreeHtml(child, ctx, slideDir, rels));
    // p:cxnSp (conectores), p:contentPart y gráficos: sin texto legible directo.
  }
  return parts.filter(Boolean).join('');
}

/** Texto de las notas del orador de una diapositiva (si existen). */
async function notesHtml(zip: JSZip, slideDir: string, rels: Map<string, string>): Promise<string> {
  const target = [...rels.values()].find((value) => value.includes('notesSlide'));
  if (!target) return '';
  const notes = await readXmlFile(zip, resolveTarget(slideDir, target));
  if (!notes) return '';
  const paragraphs: string[] = [];
  for (const shape of descendantsNamed(notes, 'p:sp')) {
    const txBody = childNamed(shape, 'p:txBody');
    if (!txBody) continue;
    for (const paragraph of childrenNamed(txBody, 'a:p')) {
      const text = (await paragraphRunsHtml(paragraph)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push(text);
    }
  }
  if (!paragraphs.length) return '';
  return `<blockquote>${paragraphs.map(escapeHtml).join(' ')}</blockquote>`;
}

/** Convierte un PPTX (bytes) a HTML semántico para el visor y la lectura TTS. */
export async function parsePptx(data: Uint8Array): Promise<OfficeDocument> {
  const zip = await loadZip(data);
  const presentation = await readXmlFile(zip, 'ppt/presentation.xml');
  if (!presentation) throw new Error('El archivo PPTX no contiene la presentación (ppt/presentation.xml).');
  const rels = await readRels(zip, 'ppt/_rels/presentation.xml.rels');
  const list = childNamed(presentation, 'p:sldIdLst');
  const slideIds = list ? childrenNamed(list, 'p:sldId') : [];
  if (!slideIds.length) throw new Error('La presentación PPTX no contiene diapositivas.');
  const ctx: PptxContext = { loadMedia: createMediaLoader(zip) };
  const parts: string[] = [];
  for (const slideId of slideIds) {
    const rid = attr(slideId, 'r:id');
    const target = rid ? rels.get(rid) : undefined;
    if (!target) continue;
    const slidePath = resolveTarget('ppt', target);
    const slide = await readXmlFile(zip, slidePath);
    if (!slide) continue;
    const slideDir = slidePath.split('/').slice(0, -1).join('/');
    const slideName = slidePath.split('/').pop() ?? '';
    const slideRels = await readRels(zip, `${slideDir}/_rels/${slideName}.rels`);
    const spTree = childNamed(childNamed(slide, 'p:cSld'), 'p:spTree') ?? slide;
    const html = await spTreeHtml(spTree, ctx, slideDir, slideRels);
    const notes = await notesHtml(zip, slideDir, slideRels);
    const combined = `${html}${notes}`;
    if (!combined.trim()) continue;
    if (parts.length) parts.push('<hr>');
    parts.push(combined);
  }
  const html = parts.join('');
  if (!html.trim()) throw new Error('La presentación PPTX no contiene texto legible.');
  return { html };
}

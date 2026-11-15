/**
 * Parser XML mínimo para OOXML (DOCX/PPTX).
 * Solo necesita lo que generan Word/PowerPoint: elementos, atributos, texto,
 * CDATA, comentarios y referencias de entidades. No resuelve entidades
 * externas (sin XXE) y se usa únicamente para extraer texto y relaciones.
 */

export interface XmlNode {
  /** Nombre con prefijo, tal como aparece (`w:p`, `a:t`, `r:id`). */
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Texto directo concatenado (con entidades decodificadas). */
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[entity] ?? whole;
  });
}

const NAME_CHAR = /[A-Za-z0-9_:.\-]/;

function isNameStart(char: string): boolean {
  return /[A-Za-z_:]/.test(char);
}

/** Analiza un documento XML y devuelve su elemento raíz. */
export function parseXml(xml: string): XmlNode {
  let index = 0;
  const length = xml.length;
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;

  const appendText = (raw: string) => {
    if (!raw) return;
    const decoded = decodeEntities(raw);
    const current = stack.at(-1);
    if (current) current.text += decoded;
  };

  while (index < length) {
    const lt = xml.indexOf('<', index);
    if (lt === -1) {
      appendText(xml.slice(index));
      break;
    }
    if (lt > index) appendText(xml.slice(index, lt));
    index = lt;

    if (xml.startsWith('<!--', index)) {
      const end = xml.indexOf('-->', index + 4);
      if (end === -1) throw new Error('XML inválido: comentario sin cerrar.');
      index = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', index)) {
      const end = xml.indexOf(']]>', index + 9);
      if (end === -1) throw new Error('XML inválido: CDATA sin cerrar.');
      appendText(xml.slice(index + 9, end));
      index = end + 3;
      continue;
    }
    if (xml.startsWith('<?', index)) {
      const end = xml.indexOf('?>', index + 2);
      if (end === -1) throw new Error('XML inválido: instrucción sin cerrar.');
      index = end + 2;
      continue;
    }
    if (xml.startsWith('<!', index)) {
      const end = xml.indexOf('>', index + 2);
      if (end === -1) throw new Error('XML inválido: declaración sin cerrar.');
      index = end + 1;
      continue;
    }
    if (xml.startsWith('</', index)) {
      const end = xml.indexOf('>', index + 2);
      if (end === -1) throw new Error('XML inválido: cierre sin terminar.');
      const closing = xml.slice(index + 2, end).trim();
      const current = stack.at(-1);
      if (!current || current.tag !== closing) {
        throw new Error(`XML inválido: cierre inesperado </${closing}>.`);
      }
      stack.pop();
      index = end + 1;
      continue;
    }

    // Apertura de elemento.
    let cursor = index + 1;
    if (cursor >= length || !isNameStart(xml[cursor])) throw new Error('XML inválido: nombre de elemento esperado.');
    const nameStart = cursor;
    while (cursor < length && NAME_CHAR.test(xml[cursor])) cursor += 1;
    const tag = xml.slice(nameStart, cursor);
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    let closed = false;
    while (cursor < length) {
      while (cursor < length && /\s/.test(xml[cursor])) cursor += 1;
      if (xml.startsWith('/>', cursor)) {
        selfClosing = true;
        closed = true;
        cursor += 2;
        break;
      }
      if (xml[cursor] === '>') {
        closed = true;
        cursor += 1;
        break;
      }
      if (!isNameStart(xml[cursor])) throw new Error(`XML inválido: atributo esperado en <${tag}>.`);
      const attrStart = cursor;
      while (cursor < length && NAME_CHAR.test(xml[cursor])) cursor += 1;
      const attrName = xml.slice(attrStart, cursor);
      while (cursor < length && /\s/.test(xml[cursor])) cursor += 1;
      if (xml[cursor] !== '=') throw new Error(`XML inválido: '=' esperado tras ${attrName}.`);
      cursor += 1;
      while (cursor < length && /\s/.test(xml[cursor])) cursor += 1;
      const quote = xml[cursor];
      if (quote !== '"' && quote !== "'") throw new Error(`XML inválido: comilla esperada en ${attrName}.`);
      cursor += 1;
      const valueStart = cursor;
      const valueEnd = xml.indexOf(quote, cursor);
      if (valueEnd === -1) throw new Error(`XML inválido: valor sin cerrar en ${attrName}.`);
      attrs[attrName] = decodeEntities(xml.slice(valueStart, valueEnd));
      cursor = valueEnd + 1;
    }
    if (!closed) throw new Error(`XML inválido: <${tag}> sin cerrar.`);
    const node: XmlNode = { tag, attrs, children: [], text: '' };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node);
    else if (!root) root = node;
    if (!selfClosing) stack.push(node);
    index = cursor;
  }

  if (stack.length) throw new Error(`XML inválido: <${stack.at(-1)!.tag}> sin cerrar.`);
  if (!root) throw new Error('XML inválido: sin elemento raíz.');
  return root;
}

/** Hijos directos con el nombre dado (p. ej. `w:p`). */
export function childrenNamed(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter((child) => child.tag === tag);
}

/** Primer hijo directo con el nombre dado. */
export function childNamed(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return node?.children.find((child) => child.tag === tag);
}

/** Todos los descendientes con el nombre dado, en orden de documento. */
export function descendantsNamed(node: XmlNode, tag: string): XmlNode[] {
  const found: XmlNode[] = [];
  const walk = (current: XmlNode) => {
    for (const child of current.children) {
      if (child.tag === tag) found.push(child);
      walk(child);
    }
  };
  walk(node);
  return found;
}

/** Atributo por nombre (p. ej. `w:val`, `r:id`, `r:embed`). */
export function attr(node: XmlNode | undefined, name: string): string | undefined {
  return node?.attrs[name];
}

/** ¿El nodo tiene un hijo con el nombre dado? */
export function hasChild(node: XmlNode | undefined, tag: string): boolean {
  return Boolean(node && childNamed(node, tag));
}

import JSZip from 'jszip';
import { parseXml, type XmlNode } from './xml';
import { escapeHtml } from '../text';

/** Documento Office convertido a HTML semántico listo para mostrar y leer. */
export interface OfficeDocument {
  html: string;
}

export async function loadZip(data: Uint8Array): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(data);
  } catch {
    throw new Error('El archivo no es un paquete Office válido (ZIP).');
  }
}

export async function readXmlFile(zip: JSZip, path: string): Promise<XmlNode | null> {
  const file = zip.file(path);
  if (!file) return null;
  const text = await file.async('string');
  return parseXml(text);
}

/** Mapa `r:id` → destino desde un archivo `.rels`. */
export async function readRels(zip: JSZip, path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const root = await readXmlFile(zip, path);
  if (!root) return map;
  for (const rel of root.children) {
    const id = rel.attrs.Id;
    const target = rel.attrs.Target;
    if (id && target) map.set(id, target);
  }
  return map;
}

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff',
};

/** Cargador de medios con caché: ruta en el ZIP → data URI (o null si no es renderizable). */
export function createMediaLoader(zip: JSZip): (path: string) => Promise<string | null> {
  const cache = new Map<string, Promise<string | null>>();
  return (path: string) => {
    let pending = cache.get(path);
    if (!pending) {
      pending = (async () => {
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        const mime = IMAGE_MIME[ext];
        if (!mime) return null; // EMF/WMF y otros no se pueden mostrar en el navegador.
        const file = zip.file(path);
        if (!file) return null;
        const bytes = await file.async('uint8array');
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return `data:${mime};base64,${btoa(binary)}`;
      })();
      cache.set(path, pending);
    }
    return pending;
  };
}

export async function imageHtml(
  loadMedia: (path: string) => Promise<string | null>,
  path: string,
  alt = '',
): Promise<string> {
  const uri = await loadMedia(path);
  return uri ? `<img src="${uri}" alt="${escapeHtml(alt)}" loading="lazy">` : '';
}

/** Resuelve un destino de relación contra el directorio de la parte que lo contiene. */
export function resolveTarget(baseDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = [...baseDir.split('/').filter(Boolean), ...target.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part && part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

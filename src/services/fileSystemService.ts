import { convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { documentKindFromName } from '@/store/useAppStore';
import { basename, dirname } from '@/lib/utils';
import type { OpenedDocument } from '@/types';

const MAX_BROWSER_FILE_SIZE = 150 * 1024 * 1024;

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function decodeText(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data);
}

async function fromNativePath(path: string): Promise<OpenedDocument> {
  const name = basename(path);
  const kind = documentKindFromName(name);
  if (kind !== 'pdf' && !/\.(md|markdown|txt)$/i.test(name)) {
    throw new Error('Formato no compatible. Abre un archivo .md, .markdown, .txt o .pdf.');
  }
  const data = await readFile(path);
  return kind === 'pdf'
    ? { name, path, kind, data }
    : { name, path, kind, text: decodeText(data) };
}

export async function openDocumentDialog(): Promise<OpenedDocument | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      directory: false,
      title: 'Abrir documento',
      filters: [{ name: 'Documentos', extensions: ['md', 'markdown', 'txt', 'pdf'] }],
    });
    return typeof selected === 'string' ? fromNativePath(selected) : null;
  }

  return new Promise<OpenedDocument | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf';
    input.onchange = async () => {
      try {
        resolve(input.files?.[0] ? await openBrowserFile(input.files[0]) : null);
      } catch (error) {
        reject(error);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function openDocumentPath(path: string): Promise<OpenedDocument> {
  if (!isTauri()) throw new Error('Este archivo debe volver a seleccionarse en la versión de navegador.');
  return fromNativePath(path);
}

export async function openBrowserFile(file: File): Promise<OpenedDocument> {
  if (file.size > MAX_BROWSER_FILE_SIZE) throw new Error('El archivo supera el límite de 150 MB.');
  const kind = documentKindFromName(file.name);
  if (kind !== 'pdf' && !/\.(md|markdown|txt)$/i.test(file.name)) {
    throw new Error('Formato no compatible. Abre un archivo .md, .markdown, .txt o .pdf.');
  }
  if (kind === 'pdf') return { name: file.name, kind, data: new Uint8Array(await file.arrayBuffer()) };
  return { name: file.name, kind, text: await file.text() };
}

export interface SaveOptions {
  suggestedName: string;
  extensions: string[];
  filterName?: string;
}

export async function saveBinaryFile(data: Blob | Uint8Array | string, options: SaveOptions): Promise<boolean> {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data instanceof Uint8Array
      ? data
      : new Uint8Array(await data.arrayBuffer());

  if (isTauri()) {
    const path = await save({
      title: 'Guardar archivo',
      defaultPath: options.suggestedName,
      filters: [{ name: options.filterName ?? 'Archivo', extensions: options.extensions }],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }

  const blob = new Blob([bytes], { type: data instanceof Blob ? data.type : 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.suggestedName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function importWorkspaceDialog(): Promise<string | null> {
  const validate = (content: string) => {
    if (content.length > 5_000_000) throw new Error('La copia supera el límite de 5 MB.');
    return content;
  };
  if (isTauri()) {
    const selected = await open({ multiple: false, directory: false, title: 'Restaurar copia de OpenHub', filters: [{ name: 'Copia de OpenHub', extensions: ['json'] }] });
    if (typeof selected !== 'string') return null;
    return validate(decodeText(await readFile(selected)));
  }
  return new Promise<string | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try { resolve(input.files?.[0] ? validate(await input.files[0].text()) : null); }
      catch (error) { reject(error); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function resolveMarkdownAsset(source: string, documentPath?: string): string {
  if (!isTauri() || /^(data|blob|https?):/i.test(source)) return source;
  let path = source.replace(/^file:\/\//i, '');
  if (!/^([a-z]:[\\/]|\/)/i.test(path)) {
    if (!documentPath) return source;
    const base = dirname(documentPath);
    path = `${base}${base.includes('\\') ? '\\' : '/'}${path}`;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return source;
  }
}

import type { DocumentKind } from '@/types';
import { parseDocx } from './docx';
import { parsePptx } from './pptx';
import { parseXlsx } from './xlsx';
import type { OfficeDocument } from './shared';

export type { OfficeDocument };

export function isOfficeKind(kind: DocumentKind): kind is 'docx' | 'pptx' | 'xlsx' {
  return kind === 'docx' || kind === 'pptx' || kind === 'xlsx';
}

/** Convierte un DOCX/PPTX/XLSX (bytes) a HTML semántico. */
export async function parseOfficeDocument(kind: 'docx' | 'pptx' | 'xlsx', data: Uint8Array): Promise<OfficeDocument> {
  if (kind === 'docx') return parseDocx(data);
  if (kind === 'pptx') return parsePptx(data);
  return parseXlsx(data);
}

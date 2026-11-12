import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { parseWorkspaceBackup } from './workspace';

const backup = (data: unknown) => JSON.stringify({ app: 'OpenHub', version: 1, exportedAt: '2026-11-11T00:00:00.000Z', data });
beforeEach(() => useAppStore.setState({ readerFontSize: 100, readerLineHeight: 1.75, readerWidth: 768, recents: [], pronunciationRules: [] }));

describe('copia de seguridad local', () => {
  it('acepta solo el formato y versión propios', () => {
    expect(() => parseWorkspaceBackup('{}')).toThrow('válida');
    expect(() => parseWorkspaceBackup(JSON.stringify({ app: 'Otro', version: 1, data: {} }))).toThrow('válida');
    expect(() => parseWorkspaceBackup(JSON.stringify({ app: 'OpenHub', version: 99, data: {} }))).toThrow('versión');
  });
  it('normaliza valores numéricos fuera de rango', () => {
    const result = parseWorkspaceBackup(backup({ readerFontSize: 999, readerLineHeight: -2, readerWidth: 10 }));
    expect(result.readerFontSize).toBe(200);
    expect(result.readerLineHeight).toBe(1.4);
    expect(result.readerWidth).toBe(600);
  });
  it('rechaza recientes mal formados y normaliza los válidos', () => {
    const result = parseWorkspaceBackup(backup({ recents: [{ id: 42 }, null, { id: '1', name: 'nota.md', kind: 'markdown', content: '# Hola', openedAt: 123 }] }));
    expect(result.recents).toEqual([{ id: '1', name: 'nota.md', kind: 'markdown', content: '# Hola', openedAt: 123, path: undefined }]);
  });
  it('descarta reglas de pronunciación inválidas y respeta desactivadas', () => {
    const result = parseWorkspaceBackup(backup({ pronunciationRules: [{ id: '1', from: 'Kubernetes', to: 'ku ber ne tes', enabled: false }, { from: 'sin id', to: 'x' }, { id: '2', from: '', to: 'vacío' }] }));
    expect(result.pronunciationRules).toEqual([{ id: '1', from: 'Kubernetes', to: 'ku ber ne tes', enabled: false }]);
  });
  it('conserva los valores actuales para campos opcionales ausentes', () => {
    const current = { readerFontSize: 100, readerLineHeight: 1.75, readerWidth: 768, recents: [{ id: 'actual', name: 'actual.md', kind: 'markdown' as const, openedAt: 1 }], pronunciationRules: [{ id: 'r', from: 'a', to: 'b', enabled: true }] };
    useAppStore.setState(current);
    expect(parseWorkspaceBackup(backup({ readerFontSize: 120 }))).toMatchObject({ ...current, readerFontSize: 120 });
  });
});

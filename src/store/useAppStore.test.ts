import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (name: string) => values.get(name) ?? null,
  setItem: (name: string, value: string) => { values.set(name, value); },
  removeItem: (name: string) => { values.delete(name); },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
});
const { useAppStore } = await import('./useAppStore');

beforeEach(() => useAppStore.setState({
  recents: [],
  viewerZoom: 1,
  markdownContent: '',
  markdownName: 'Sin título.md',
  markdownPath: undefined,
  markdownId: undefined,
  activeDocumentId: undefined,
}));

describe('documentos recientes', () => {
  it('conserva un borrador vacío en lugar de recuperar contenido anterior', () => {
    const state = useAppStore.getState();
    state.addRecent({ name: 'borrador.md', kind: 'markdown', content: 'Texto antiguo' });
    state.addRecent({ name: 'borrador.md', kind: 'markdown', content: '' });
    expect(useAppStore.getState().recents).toHaveLength(1);
    expect(useAppStore.getState().recents[0].content).toBe('');
  });

  it('actualiza la fecha y evita duplicados por nombre/ruta', () => {
    const state = useAppStore.getState();
    state.addRecent({ name: 'nota.md', path: 'C:\\docs\\nota.md', kind: 'markdown', content: 'Uno' });
    const first = useAppStore.getState().recents[0].openedAt;
    state.addRecent({ name: 'nota.md', path: 'C:\\docs\\nota.md', kind: 'markdown', content: 'Dos' });
    expect(useAppStore.getState().recents).toHaveLength(1);
    expect(useAppStore.getState().recents[0].content).toBe('Dos');
    expect(useAppStore.getState().recents[0].openedAt).toBeGreaterThanOrEqual(first);
  });

  it('limita el historial a doce elementos', () => {
    const state = useAppStore.getState();
    for (let index = 0; index < 15; index += 1) state.addRecent({ name: `${index}.md`, kind: 'markdown', content: '' });
    expect(useAppStore.getState().recents).toHaveLength(12);
    expect(useAppStore.getState().recents[0].name).toBe('14.md');
  });

  it('renombra un borrador dentro de la app sin colisionar con otro borrador posterior', () => {
    const state = useAppStore.getState();
    state.setMarkdown('Contenido 1', 'Texto 1.md', undefined, 'draft:Texto 1.md');
    state.addRecent({ id: 'draft:Texto 1.md', name: 'Texto 1.md', kind: 'markdown', content: 'Contenido 1' });
    state.setActiveDocumentId('draft:Texto 1.md');

    const renamed = state.renameRecent('draft:Texto 1.md', '  Apuntes de clase.md  ');
    expect(renamed).toEqual({ oldId: 'draft:Texto 1.md', id: 'draft:Apuntes de clase.md', name: 'Apuntes de clase.md', path: undefined });
    expect(useAppStore.getState().markdownName).toBe('Apuntes de clase.md');
    expect(useAppStore.getState().markdownId).toBe('draft:Apuntes de clase.md');
    expect(useAppStore.getState().activeDocumentId).toBe('draft:Apuntes de clase.md');

    state.addRecent({ id: 'draft:Texto 1.md', name: 'Texto 1.md', kind: 'markdown', content: 'Nuevo' });
    expect(useAppStore.getState().recents).toHaveLength(2);
    expect(useAppStore.getState().recents.map((item) => item.name)).toEqual(['Texto 1.md', 'Apuntes de clase.md']);
  });

  it('renombra archivos con ruta sin cambiar su path real y conserva el alias al reabrir o guardar', () => {
    const diskPath = 'C:\\Users\\srmax\\Downloads\\RESUMEN.md';
    const state = useAppStore.getState();
    state.setMarkdown('# Texto', 'RESUMEN.md', diskPath, diskPath);
    state.addRecent({ name: 'RESUMEN.md', path: diskPath, kind: 'markdown', content: '# Texto' });

    const renamed = state.renameRecent(diskPath, 'Resumen Terapéutica');
    expect(renamed).toEqual({ oldId: diskPath, id: diskPath, name: 'Resumen Terapéutica', path: diskPath });
    expect(useAppStore.getState().recents[0]).toMatchObject({ id: diskPath, path: diskPath, name: 'Resumen Terapéutica', customName: true });

    state.addRecent({ name: 'RESUMEN.md', path: diskPath, kind: 'markdown', content: '# Actualizado' });
    expect(useAppStore.getState().recents[0].name).toBe('Resumen Terapéutica');
    expect(useAppStore.getState().recents[0].path).toBe(diskPath);
  });

  it('rechaza nombres vacíos y evita colisión si dos borradores terminan con el mismo nombre', () => {
    const state = useAppStore.getState();
    state.addRecent({ id: 'draft:Texto 1.md', name: 'Texto 1.md', kind: 'markdown', content: 'A' });
    state.addRecent({ id: 'draft:Texto 2.md', name: 'Texto 2.md', kind: 'markdown', content: 'B' });

    expect(state.renameRecent('draft:Texto 1.md', '   ')).toBeNull();
    state.renameRecent('draft:Texto 1.md', 'Compartido');
    const second = state.renameRecent('draft:Texto 2.md', 'Compartido');
    expect(second?.id).not.toBe('draft:Compartido');
    expect(useAppStore.getState().recents).toHaveLength(2);
  });

  it('normaliza viewerZoom dentro del rango permitido', () => {
    const state = useAppStore.getState();
    state.setViewerZoom(5);
    expect(useAppStore.getState().viewerZoom).toBe(3);
    state.setViewerZoom(0.1);
    expect(useAppStore.getState().viewerZoom).toBe(0.5);
    state.setViewerZoom(Number.NaN);
    expect(useAppStore.getState().viewerZoom).toBe(1);
    state.setViewerZoom(1.25);
    expect(useAppStore.getState().viewerZoom).toBe(1.25);
  });
});

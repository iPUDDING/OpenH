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

beforeEach(() => useAppStore.setState({ recents: [] }));

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
});

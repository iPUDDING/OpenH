import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clamp } from '@/lib/utils';
import type {
  Bookmark,
  DocNote,
  DocumentKind,
  PaperTheme,
  PomodoroSettings,
  PronunciationRule,
  RecentDocument,
  Theme,
  ToolId,
  TtsSettings,
  ViewerMode,
} from '@/types';

export const DEFAULT_MARKMAP = `# Mi mapa mental\n\n## Ideas principales\n\n### Primera idea\n- Detalle importante\n- Siguiente acción\n\n### Segunda idea\n- **Concepto clave**\n- Otro enfoque\n\n## Recursos\n\n- [Documentación](https://tauri.app)\n`;

export type RecentInput = Omit<RecentDocument, 'id' | 'openedAt'> & { id?: string };

export interface RenamedRecentResult {
  oldId: string;
  id: string;
  name: string;
  path?: string;
}

export interface AppState {
  activeTool: ToolId;
  theme: Theme;
  autoScroll: boolean;
  readerFontSize: number;
  readerLineHeight: number;
  readerWidth: number;
  viewerZoom: number;
  recents: RecentDocument[];
  viewerMode: ViewerMode;
  markdownContent: string;
  markdownName: string;
  markdownPath?: string;
  markdownId?: string;
  activeDocumentId?: string;
  ttsText: string;
  tts: TtsSettings;
  pronunciationRules: PronunciationRule[];
  markmapContent: string;
  pomodoro: PomodoroSettings;
  paperTheme: PaperTheme;
  readingPositions: Record<string, number>;
  bookmarks: Record<string, Bookmark[]>;
  notes: Record<string, DocNote[]>;
  keybindings: Record<string, string>;
  setActiveTool: (tool: ToolId) => void;
  setTheme: (theme: Theme) => void;
  setAutoScroll: (enabled: boolean) => void;
  setReaderPreferences: (preferences: Partial<{ readerFontSize: number; readerLineHeight: number; readerWidth: number }>) => void;
  setViewerZoom: (zoom: number) => void;
  setActiveDocumentId: (id?: string) => void;
  addRecent: (document: RecentInput) => void;
  renameRecent: (id: string, name: string) => RenamedRecentResult | null;
  removeRecent: (id: string) => void;
  clearRecents: () => void;
  setViewerMode: (mode: ViewerMode) => void;
  setMarkdown: (content: string, name?: string, path?: string, id?: string) => void;
  setTtsText: (text: string) => void;
  setTtsSettings: (settings: Partial<TtsSettings>) => void;
  setPronunciationRules: (rules: PronunciationRule[]) => void;
  setMarkmapContent: (content: string) => void;
  setPomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  setPaperTheme: (paperTheme: PaperTheme) => void;
  setReadingPosition: (documentId: string, position: number) => void;
  addBookmark: (documentId: string, bookmark: Bookmark) => void;
  removeBookmark: (documentId: string, bookmarkId: string) => void;
  addNote: (documentId: string, note: DocNote) => void;
  removeNote: (documentId: string, noteId: string) => void;
  setKeybinding: (action: string, combo: string) => void;
  resetKeybindings: () => void;
}

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  palette: 'ctrl+k',
  fullscreen: 'f11',
  toggleHeader: 'ctrl+shift+h',
  open: 'ctrl+o',
  tool1: 'alt+1',
  tool2: 'alt+2',
  tool3: 'alt+3',
  tool4: 'alt+4',
};

const initialTts: TtsSettings = { voiceURI: '', rate: 1, pitch: 1, volume: 1 };

export function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.round(clamp(value, 0.5, 3) * 100) / 100;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTool: 'viewer',
      theme: 'system',
      autoScroll: true,
      readerFontSize: 100,
      readerLineHeight: 1.75,
      readerWidth: 768,
      viewerZoom: 1,
      recents: [],
      viewerMode: 'preview',
      markdownContent: '',
      markdownName: 'Sin título.md',
      ttsText: 'Bienvenido a OpenHub.\n\nEscribe o pega aquí el texto que quieras escuchar. Puedes moverte entre párrafos, ajustar la voz y conservar tu trabajo entre sesiones.',
      tts: initialTts,
      pronunciationRules: [],
      markmapContent: DEFAULT_MARKMAP,
      pomodoro: { workMinutes: 25, breakMinutes: 5 },
      paperTheme: 'white',
      readingPositions: {},
      bookmarks: {},
      notes: {},
      keybindings: { ...DEFAULT_KEYBINDINGS },
      setActiveTool: (activeTool) => set({ activeTool }),
      setTheme: (theme) => set({ theme }),
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setReaderPreferences: (preferences) => set(preferences),
      setViewerZoom: (viewerZoom) => set({ viewerZoom: normalizeZoom(viewerZoom) }),
      setActiveDocumentId: (activeDocumentId) => set({ activeDocumentId }),
      addRecent: (document) => set((state) => {
        const id = document.id || document.path || `draft:${document.name}`;
        const previous = state.recents.find((item) => item.id === id);
        const content = document.kind === 'markdown' && document.content !== undefined && document.content.length <= 2_000_000
          ? document.content
          : previous?.content;
        const customName = document.customName ?? previous?.customName;
        const name = previous?.customName && !document.customName ? previous.name : document.name;
        const next: RecentDocument = {
          ...document,
          id,
          name,
          content,
          ...(customName ? { customName: true } : {}),
          openedAt: Date.now(),
        };
        return { recents: [next, ...state.recents.filter((item) => item.id !== id)].slice(0, 12) };
      }),
      renameRecent: (id, rawName) => {
        const name = rawName.trim().slice(0, 260);
        if (!name) return null;
        let resolved: RenamedRecentResult | null = null;
        set((state) => {
          const target = state.recents.find((item) => item.id === id);
          if (!target) return state;
          let nextId = target.id;
          if (!target.path) {
            const candidate = `draft:${name}`;
            const taken = state.recents.some((item) => item.id !== id && item.id === candidate);
            nextId = taken ? `draft:${name}:${Date.now().toString(36)}` : candidate;
          }
          resolved = { oldId: target.id, id: nextId, name, path: target.path };
          const recents = state.recents.map((item) => (
            item.id === id
              ? { ...item, id: nextId, name, customName: true }
              : item
          ));
          const matchesActiveMarkdown = state.markdownId === id
            || (target.path ? state.markdownPath === target.path : !state.markdownPath && !state.markdownId && state.markdownName === target.name);
          return {
            recents,
            ...(state.activeDocumentId === id ? { activeDocumentId: nextId } : {}),
            ...(matchesActiveMarkdown ? { markdownName: name, markdownId: nextId } : {}),
          };
        });
        return resolved;
      },
      removeRecent: (id) => set((state) => ({ recents: state.recents.filter((item) => item.id !== id) })),
      clearRecents: () => set({ recents: [] }),
      setViewerMode: (viewerMode) => set({ viewerMode }),
      setMarkdown: (markdownContent, markdownName = 'Sin título.md', markdownPath, markdownId) => set((state) => ({
        markdownContent,
        markdownName,
        markdownPath,
        markdownId: markdownId ?? (markdownPath || (state.markdownName === markdownName && state.markdownPath === markdownPath ? state.markdownId : `draft:${markdownName}`)),
      })),
      setTtsText: (ttsText) => set({ ttsText }),
      setTtsSettings: (settings) => set((state) => ({ tts: { ...state.tts, ...settings } })),
      setPronunciationRules: (pronunciationRules) => set({ pronunciationRules }),
      setMarkmapContent: (markmapContent) => set({ markmapContent }),
      setPomodoroSettings: (settings) => set((state) => ({ pomodoro: { ...state.pomodoro, ...settings } })),
      setPaperTheme: (paperTheme) => set({ paperTheme }),
      setReadingPosition: (documentId, position) => set((state) => {
        const clamped = Math.round(Math.min(1, Math.max(0, position)) * 1000) / 1000;
        if (state.readingPositions[documentId] === clamped) return state;
        return { readingPositions: { ...state.readingPositions, [documentId]: clamped } };
      }),
      addBookmark: (documentId, bookmark) => set((state) => ({
        bookmarks: { ...state.bookmarks, [documentId]: [...(state.bookmarks[documentId] ?? []), bookmark].slice(-50) },
      })),
      removeBookmark: (documentId, bookmarkId) => set((state) => ({
        bookmarks: { ...state.bookmarks, [documentId]: (state.bookmarks[documentId] ?? []).filter((item) => item.id !== bookmarkId) },
      })),
      addNote: (documentId, note) => set((state) => ({
        notes: { ...state.notes, [documentId]: [...(state.notes[documentId] ?? []), note].slice(-100) },
      })),
      removeNote: (documentId, noteId) => set((state) => ({
        notes: { ...state.notes, [documentId]: (state.notes[documentId] ?? []).filter((item) => item.id !== noteId) },
      })),
      setKeybinding: (action, combo) => set((state) => ({ keybindings: { ...state.keybindings, [action]: combo } })),
      resetKeybindings: () => set({ keybindings: { ...DEFAULT_KEYBINDINGS } }),
    }),
    {
      name: 'openhub-store',
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        autoScroll: state.autoScroll,
        readerFontSize: state.readerFontSize,
        readerLineHeight: state.readerLineHeight,
        readerWidth: state.readerWidth,
        viewerZoom: state.viewerZoom,
        recents: state.recents,
        viewerMode: state.viewerMode,
        markdownContent: state.markdownContent,
        markdownName: state.markdownName,
        markdownPath: state.markdownPath,
        markdownId: state.markdownId,
        ttsText: state.ttsText,
        tts: state.tts,
        pronunciationRules: state.pronunciationRules,
        markmapContent: state.markmapContent,
        pomodoro: state.pomodoro,
        paperTheme: state.paperTheme,
        readingPositions: state.readingPositions,
        bookmarks: state.bookmarks,
        notes: state.notes,
        keybindings: state.keybindings,
      }),
    },
  ),
);

export function documentKindFromName(name: string): DocumentKind {
  const lower = name.toLocaleLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return 'markdown';
}

/** ¿El formato se lee como binario (PDF/DOCX/PPTX) en lugar de texto? */
export function isBinaryDocumentKind(kind: DocumentKind): boolean {
  return kind === 'pdf' || kind === 'docx' || kind === 'pptx' || kind === 'xlsx';
}

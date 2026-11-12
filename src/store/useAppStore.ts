import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DocumentKind,
  PomodoroSettings,
  PronunciationRule,
  RecentDocument,
  Theme,
  ToolId,
  TtsSettings,
  ViewerMode,
} from '@/types';

export const DEFAULT_MARKMAP = `# Mi mapa mental\n\n## Ideas principales\n\n### Primera idea\n- Detalle importante\n- Siguiente acción\n\n### Segunda idea\n- **Concepto clave**\n- Otro enfoque\n\n## Recursos\n\n- [Documentación](https://tauri.app)\n`;

export interface AppState {
  activeTool: ToolId;
  theme: Theme;
  autoScroll: boolean;
  readerFontSize: number;
  readerLineHeight: number;
  readerWidth: number;
  recents: RecentDocument[];
  viewerMode: ViewerMode;
  markdownContent: string;
  markdownName: string;
  markdownPath?: string;
  ttsText: string;
  tts: TtsSettings;
  pronunciationRules: PronunciationRule[];
  markmapContent: string;
  pomodoro: PomodoroSettings;
  setActiveTool: (tool: ToolId) => void;
  setTheme: (theme: Theme) => void;
  setAutoScroll: (enabled: boolean) => void;
  setReaderPreferences: (preferences: Partial<{ readerFontSize: number; readerLineHeight: number; readerWidth: number }>) => void;
  addRecent: (document: Omit<RecentDocument, 'id' | 'openedAt'>) => void;
  removeRecent: (id: string) => void;
  clearRecents: () => void;
  setViewerMode: (mode: ViewerMode) => void;
  setMarkdown: (content: string, name?: string, path?: string) => void;
  setTtsText: (text: string) => void;
  setTtsSettings: (settings: Partial<TtsSettings>) => void;
  setPronunciationRules: (rules: PronunciationRule[]) => void;
  setMarkmapContent: (content: string) => void;
  setPomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
}

const initialTts: TtsSettings = { voiceURI: '', rate: 1, pitch: 1, volume: 1 };

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTool: 'viewer',
      theme: 'system',
      autoScroll: true,
      readerFontSize: 100,
      readerLineHeight: 1.75,
      readerWidth: 768,
      recents: [],
      viewerMode: 'preview',
      markdownContent: '',
      markdownName: 'Sin título.md',
      ttsText: 'Bienvenido a OpenHub.\n\nEscribe o pega aquí el texto que quieras escuchar. Puedes moverte entre párrafos, ajustar la voz y conservar tu trabajo entre sesiones.',
      tts: initialTts,
      pronunciationRules: [],
      markmapContent: DEFAULT_MARKMAP,
      pomodoro: { workMinutes: 25, breakMinutes: 5 },
      setActiveTool: (activeTool) => set({ activeTool }),
      setTheme: (theme) => set({ theme }),
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setReaderPreferences: (preferences) => set(preferences),
      addRecent: (document) => set((state) => {
        const id = document.path || `draft:${document.name}`;
        const previous = state.recents.find((item) => item.id === id);
        const content = document.kind === 'markdown' && document.content !== undefined && document.content.length <= 2_000_000
          ? document.content
          : previous?.content;
        const next: RecentDocument = { ...document, content, id, openedAt: Date.now() };
        return { recents: [next, ...state.recents.filter((item) => item.id !== id)].slice(0, 12) };
      }),
      removeRecent: (id) => set((state) => ({ recents: state.recents.filter((item) => item.id !== id) })),
      clearRecents: () => set({ recents: [] }),
      setViewerMode: (viewerMode) => set({ viewerMode }),
      setMarkdown: (markdownContent, markdownName = 'Sin título.md', markdownPath) => set({ markdownContent, markdownName, markdownPath }),
      setTtsText: (ttsText) => set({ ttsText }),
      setTtsSettings: (settings) => set((state) => ({ tts: { ...state.tts, ...settings } })),
      setPronunciationRules: (pronunciationRules) => set({ pronunciationRules }),
      setMarkmapContent: (markmapContent) => set({ markmapContent }),
      setPomodoroSettings: (settings) => set((state) => ({ pomodoro: { ...state.pomodoro, ...settings } })),
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
        recents: state.recents,
        viewerMode: state.viewerMode,
        markdownContent: state.markdownContent,
        markdownName: state.markdownName,
        markdownPath: state.markdownPath,
        ttsText: state.ttsText,
        tts: state.tts,
        pronunciationRules: state.pronunciationRules,
        markmapContent: state.markmapContent,
        pomodoro: state.pomodoro,
      }),
    },
  ),
);

export function documentKindFromName(name: string): DocumentKind {
  return name.toLocaleLowerCase().endsWith('.pdf') ? 'pdf' : 'markdown';
}

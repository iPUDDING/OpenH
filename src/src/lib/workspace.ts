import { useAppStore } from '@/store/useAppStore';
import { clamp } from './utils';
import type { PronunciationRule, RecentDocument } from '@/types';

const APP_ID = 'OpenHub';
const BACKUP_VERSION = 1;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, fallback: string, max = 3_000_000): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}
function recentDocuments(value: unknown, fallback: RecentDocument[]): RecentDocument[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter(object).flatMap((item) => {
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !['pdf', 'markdown'].includes(String(item.kind))) return [];
    return [{
      id: item.id.slice(0, 1000),
      name: item.name.slice(0, 260),
      kind: item.kind === 'pdf' ? 'pdf' as const : 'markdown' as const,
      path: typeof item.path === 'string' ? item.path.slice(0, 2000) : undefined,
      openedAt: number(item.openedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
      content: typeof item.content === 'string' ? item.content.slice(0, 2_000_000) : undefined,
      ...(item.customName === true ? { customName: true } : {}),
    }];
  }).slice(0, 12);
}
function pronunciationRules(value: unknown, fallback: PronunciationRule[]): PronunciationRule[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter(object).flatMap((item) => {
    if (typeof item.id !== 'string' || typeof item.from !== 'string' || typeof item.to !== 'string') return [];
    return [{ id: item.id.slice(0, 100), from: item.from.slice(0, 200), to: item.to.slice(0, 200), enabled: item.enabled !== false }];
  }).filter((rule) => rule.from.trim() && rule.to.trim()).slice(0, 200);
}

export function createWorkspaceBackup(): string {
  const state = useAppStore.getState();
  return JSON.stringify({
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
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
    },
  }, null, 2);
}

export function parseWorkspaceBackup(json: string) {
  const parsed: unknown = JSON.parse(json);
  if (!object(parsed) || parsed.app !== APP_ID || parsed.version !== BACKUP_VERSION || !object(parsed.data)) {
    throw new Error('La copia no es válida o pertenece a una versión incompatible de OpenHub.');
  }
  const data = parsed.data;
  const current = useAppStore.getState();
  return {
    theme: ['light', 'dark', 'system'].includes(String(data.theme)) ? data.theme as typeof current.theme : current.theme,
    autoScroll: typeof data.autoScroll === 'boolean' ? data.autoScroll : current.autoScroll,
    readerFontSize: number(data.readerFontSize, current.readerFontSize, 80, 200),
    readerLineHeight: number(data.readerLineHeight, current.readerLineHeight, 1.4, 2.2),
    readerWidth: number(data.readerWidth, current.readerWidth, 600, 1100),
    viewerZoom: number(data.viewerZoom, current.viewerZoom, 0.5, 3),
    recents: recentDocuments(data.recents, current.recents),
    viewerMode: data.viewerMode === 'split' ? 'split' as const : data.viewerMode === 'preview' ? 'preview' as const : current.viewerMode,
    markdownContent: text(data.markdownContent, current.markdownContent),
    markdownName: text(data.markdownName, current.markdownName, 260),
    markdownPath: typeof data.markdownPath === 'string' ? data.markdownPath : current.markdownPath,
    markdownId: typeof data.markdownId === 'string' ? data.markdownId : current.markdownId,
    ttsText: text(data.ttsText, current.ttsText),
    tts: object(data.tts) ? {
      voiceURI: text(data.tts.voiceURI, current.tts.voiceURI, 500),
      rate: number(data.tts.rate, current.tts.rate, 0.5, 2.5),
      pitch: number(data.tts.pitch, current.tts.pitch, 0.5, 1.5),
      volume: number(data.tts.volume, current.tts.volume, 0, 1),
    } : current.tts,
    pronunciationRules: pronunciationRules(data.pronunciationRules, current.pronunciationRules),
    markmapContent: text(data.markmapContent, current.markmapContent),
    pomodoro: object(data.pomodoro) ? {
      workMinutes: number(data.pomodoro.workMinutes, current.pomodoro.workMinutes, 5, 60),
      breakMinutes: number(data.pomodoro.breakMinutes, current.pomodoro.breakMinutes, 1, 30),
    } : current.pomodoro,
  };
}

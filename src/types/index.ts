export type ToolId = 'viewer' | 'tts' | 'markmap' | 'settings';
export type Theme = 'light' | 'dark' | 'system';
export type DocumentKind = 'markdown' | 'pdf';
export type ViewerMode = 'preview' | 'split';

export interface RecentDocument {
  id: string;
  name: string;
  path?: string;
  kind: DocumentKind;
  openedAt: number;
  /** Solo Markdown pequeño: permite reabrir borradores también en navegador. */
  content?: string;
}

export interface TtsSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
}

export interface OpenedDocument {
  name: string;
  path?: string;
  kind: DocumentKind;
  text?: string;
  data?: Uint8Array;
}

export interface SpeechSegment {
  id: string;
  text: string;
  /** Texto visible original cuando la pronunciación altera el texto hablado. */
  sourceText?: string;
  /** Fronteras de caracteres hablados → originales (longitud text.length + 1). */
  offsetMap?: number[];
  pronunciationRanges?: Array<{ spokenStart: number; spokenEnd: number; sourceStart: number; sourceEnd: number }>;
}

export interface PronunciationRule {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
}

export interface WordRange {
  start: number;
  end: number;
  text: string;
}

export interface SpeechPosition {
  segmentId: string;
  segmentIndex: number;
  word: WordRange | null;
}

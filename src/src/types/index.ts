export type ToolId = 'viewer' | 'tts' | 'markmap' | 'settings';
export type Theme = 'light' | 'dark' | 'system';
export type DocumentKind = 'markdown' | 'pdf' | 'docx' | 'pptx' | 'xlsx';
export type ViewerMode = 'preview' | 'split';

export interface RecentDocument {
  id: string;
  name: string;
  path?: string;
  kind: DocumentKind;
  openedAt: number;
  /** Solo Markdown pequeño: permite reabrir borradores también en navegador. */
  content?: string;
  /** Indica si el usuario asignó un nombre visible personalizado dentro de OpenHub. */
  customName?: boolean;
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
  id?: string;
  name: string;
  path?: string;
  kind: DocumentKind;
  text?: string;
  data?: Uint8Array;
  customName?: boolean;
}

/** Fórmula LaTeX detectada en el texto visible, con su lectura en español. */
export interface MathSpeechRange {
  /** Inicio/fin en el texto visible (glifos renderizados). */
  start: number;
  end: number;
  /** Código TeX original (anotación de KaTeX o delimitadores `$…$`). */
  tex: string;
  /** Lectura natural en español de la fórmula. */
  spoken: string;
}

export interface SpeechSegment {
  id: string;
  text: string;
  /** Texto visible original cuando la pronunciación altera el texto hablado. */
  sourceText?: string;
  /** Fronteras de caracteres hablados → originales (longitud text.length + 1). */
  offsetMap?: number[];
  pronunciationRanges?: Array<{ spokenStart: number; spokenEnd: number; sourceStart: number; sourceEnd: number }>;
  /** Fórmulas LaTeX del segmento (coordenadas del texto visible). */
  mathRanges?: MathSpeechRange[];
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

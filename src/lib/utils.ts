import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** ¿Un evento de teclado coincide con una combinación como "ctrl+shift+h"? */
export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return false;
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  const ctrl = event.ctrlKey || event.metaKey;
  if (mods.has('ctrl') !== ctrl) return false;
  if (mods.has('shift') !== event.shiftKey) return false;
  if (mods.has('alt') !== event.altKey) return false;
  if (key === 'f11') return event.key === 'F11';
  return event.key.toLowerCase() === key;
}

/** Convierte un evento de teclado en combinación legible ("ctrl+shift+h"). */
export function comboFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  const key = event.key.toLowerCase();
  if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') return '';
  parts.push(key === ' ' ? 'space' : key);
  return parts.join('+');
}

/** Formato legible de una combinación para mostrar en la interfaz. */
export function formatCombo(combo: string): string {
  return combo.split('+').map((part) => {
    if (part === 'ctrl') return 'Ctrl';
    if (part === 'shift') return 'Shift';
    if (part === 'alt') return 'Alt';
    if (part === 'space') return 'Espacio';
    if (part.startsWith('f')) return part.toUpperCase();
    return part.toUpperCase();
  }).join(' + ');
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Duración precisa para el tiempo de lectura: `mm:ss` (o `h:mm:ss`).
 * Sustituye al antiguo redondeo a minutos enteros, que ocultaba los segundos
 * y hacía saltar el "tiempo restante" de a un minuto por vez.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00';
  const safe = Math.ceil(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return index >= 0 ? filePath.slice(0, index) : '';
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
  const candidate = cleaned || 'openhub';
  const windowsReserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(candidate);
  return `${windowsReserved ? '_' : ''}${candidate}`.slice(0, 120).replace(/[. ]+$/g, '') || 'openhub';
}

export function isProbablyMobile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

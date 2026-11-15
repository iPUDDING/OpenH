import { describe, expect, it } from 'vitest';
import { comboFromEvent, formatClock, formatCombo, formatDuration, matchesCombo } from './utils';

function fakeEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: 'k',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...partial,
  } as KeyboardEvent;
}

describe('formato de duración', () => {
  it('muestra segundos exactos en lugar de minutos redondeados', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(-3)).toBe('00:00');
    expect(formatDuration(30)).toBe('00:30');
    expect(formatDuration(90)).toBe('01:30');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(Number.NaN)).toBe('00:00');
  });

  it('mantiene el formato de reloj para el Pomodoro', () => {
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(0)).toBe('00:00');
  });
});

describe('combinaciones de teclado', () => {
  it('detecta coincidencias con modificadores exactos', () => {
    expect(matchesCombo(fakeEvent({ key: 'k', ctrlKey: true }), 'ctrl+k')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'k', metaKey: true }), 'ctrl+k')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'k' }), 'ctrl+k')).toBe(false);
    expect(matchesCombo(fakeEvent({ key: 'h', ctrlKey: true, shiftKey: true }), 'ctrl+shift+h')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'h', ctrlKey: true }), 'ctrl+shift+h')).toBe(false);
    expect(matchesCombo(fakeEvent({ key: '1', altKey: true }), 'alt+1')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'F11' }), 'f11')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'o', ctrlKey: true }), 'ctrl+o')).toBe(true);
    expect(matchesCombo(fakeEvent({ key: 'o', ctrlKey: true }), '')).toBe(false);
  });

  it('convierte eventos en combinación y la formatea', () => {
    expect(comboFromEvent(fakeEvent({ key: 'k', ctrlKey: true }))).toBe('ctrl+k');
    expect(comboFromEvent(fakeEvent({ key: 'H', ctrlKey: true, shiftKey: true }))).toBe('ctrl+shift+h');
    expect(comboFromEvent(fakeEvent({ key: 'Control' }))).toBe('');
    expect(formatCombo('ctrl+shift+h')).toBe('Ctrl + Shift + H');
    expect(formatCombo('alt+1')).toBe('Alt + 1');
    expect(formatCombo('f11')).toBe('F11');
  });
});

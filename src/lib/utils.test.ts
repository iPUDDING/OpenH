import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './utils';

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

import { describe, expect, it } from 'vitest';
import { resolvePackageVersion } from './useAppVersion';

describe('versión de OpenHub', () => {
  it('usa la versión válida del paquete', () => {
    expect(resolvePackageVersion({ version: '1.0.37' })).toBe('1.0.37');
  });

  it('tolera que tauri-action presente package.json sin version', () => {
    expect(resolvePackageVersion({})).toBe('1.0.7');
  });

  it('descarta valores vacíos o de otro tipo', () => {
    expect(resolvePackageVersion({ version: '  ' })).toBe('1.0.7');
    expect(resolvePackageVersion({ version: null })).toBe('1.0.7');
  });
});

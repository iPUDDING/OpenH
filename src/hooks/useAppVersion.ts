import { useEffect, useState } from 'react';
import packageMetadata from '../../package.json';

export function resolvePackageVersion(metadata: Record<string, unknown>): string {
  return typeof metadata.version === 'string' && metadata.version.trim() ? metadata.version : '1.0.7';
}

const packageVersion = resolvePackageVersion(packageMetadata);

/** La versión web usa el paquete; en escritorio refleja el bundle Tauri compilado por CI. */
export function useAppVersion(): string {
  const [version, setVersion] = useState(packageVersion);
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let mounted = true;
    void import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then((current) => {
      if (mounted) setVersion(current);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  return version;
}

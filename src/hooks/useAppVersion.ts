import { useEffect, useState } from 'react';
import packageMetadata from '../../package.json';

/** La versión web es la del paquete; en escritorio refleja el bundle Tauri compilado por CI. */
export function useAppVersion(): string {
  const [version, setVersion] = useState(packageMetadata.version);
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

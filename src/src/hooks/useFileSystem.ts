import { useCallback, useState } from 'react';
import {
  openBrowserFile,
  openDocumentDialog,
  openDocumentPath,
  saveBinaryFile,
  type SaveOptions,
} from '@/services/fileSystemService';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operación de archivos.';
}

export function useFileSystem() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (error) {
      setError(errorMessage(error));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const openDialog = useCallback(() => run(openDocumentDialog), [run]);
  const openPath = useCallback((path: string) => run(() => openDocumentPath(path)), [run]);
  const openFile = useCallback((file: File) => run(() => openBrowserFile(file)), [run]);
  const saveFile = useCallback((data: Blob | Uint8Array | string, options: SaveOptions) => run(() => saveBinaryFile(data, options)), [run]);

  return { busy, error, clearError: () => setError(null), openDialog, openPath, openFile, saveFile };
}

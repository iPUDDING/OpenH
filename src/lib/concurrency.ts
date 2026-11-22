function createAbortError(): Error {
  const error = new Error('La operación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

/**
 * Ejecuta un mapper con concurrencia acotada y conserva el orden de entrada.
 * Al abortar o fallar una tarea, deja de asignar trabajo nuevo y espera a que
 * terminen las tareas ya iniciadas antes de resolver o rechazar.
 */
export async function mapConcurrentOrdered<T, TResult>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number, signal?: AbortSignal) => Promise<TResult> | TResult,
  signal?: AbortSignal,
): Promise<TResult[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new RangeError('La concurrencia debe ser un entero positivo.');
  }
  if (signal?.aborted) throw signal.reason ?? createAbortError();
  if (items.length === 0) return [];

  const results = new Array<TResult>(items.length);
  const workerCount = Math.min(concurrency, items.length);
  let nextIndex = 0;
  let hasFailure = false;
  let failure: unknown;

  const worker = async () => {
    while (!hasFailure) {
      if (signal?.aborted) {
        hasFailure = true;
        failure = signal.reason ?? createAbortError();
        return;
      }
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await mapper(items[index], index, signal);
      } catch (error) {
        if (!hasFailure) {
          hasFailure = true;
          failure = error;
        }
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (hasFailure) throw failure;
  if (signal?.aborted) throw signal.reason ?? createAbortError();
  return results;
}

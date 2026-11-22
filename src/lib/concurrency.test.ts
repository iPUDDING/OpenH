import { describe, expect, it, vi } from 'vitest';
import { mapConcurrentOrdered } from './concurrency';

describe('mapConcurrentOrdered', () => {
  it('limits parallel tasks and preserves input order when tasks finish out of order', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapConcurrentOrdered([0, 1, 2, 3, 4, 5], 3, async (item) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, (5 - item) * 2));
      running -= 1;
      return `page-${item + 1}`;
    });

    expect(peak).toBe(3);
    expect(result).toEqual(['page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6']);
  });

  it('returns an empty list without calling the mapper', async () => {
    const mapper = vi.fn((value: number) => value);
    await expect(mapConcurrentOrdered([], 2, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it('stops scheduling queued work when aborted', async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const reason = new Error('cancelled by test');

    const work = mapConcurrentOrdered([0, 1, 2, 3, 4], 2, async (item) => {
      started.push(item);
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (item === 0) controller.abort(reason);
      return item;
    }, controller.signal);

    await expect(work).rejects.toBe(reason);
    expect(started).toEqual([0, 1]);
  });

  it('rejects a non-positive or fractional concurrency', async () => {
    await expect(mapConcurrentOrdered([1], 0, (value) => value)).rejects.toThrow(RangeError);
    await expect(mapConcurrentOrdered([1], 1.5, (value) => value)).rejects.toThrow(RangeError);
  });
});

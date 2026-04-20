import { logger } from '@/utils/log';

type AsyncFn = () => Promise<void>;

/**
 * Per-key sequential processing lock.
 *
 * Enqueue an async function to run sequentially per key.
 * Different keys run in parallel; same key runs in order.
 */
const exclusiveQueue = new Map<string, Promise<void>>();

export function runExclusive(key: string, fn: AsyncFn): void {
  const previous = exclusiveQueue.get(key) ?? Promise.resolve();
  const current = previous
    .then(fn)
    .catch(() => {})
    .finally(() => {
      if (exclusiveQueue.get(key) === current) exclusiveQueue.delete(key);
    });
  exclusiveQueue.set(key, current);
}

/**
 * In-process guard that prevents a cron job from running if its previous
 * invocation is still in progress. Each lock is identified by a name.
 *
 * Returns a wrapper that skips execution if the previous run hasn't finished.
 *
 * Note: This is not a distributed lock. If you have multiple server instances, they may still run the same cron job concurrently.
 * TODO: Remember this when scaling
 */
const activeLocks = new Set<string>();

export function withCronLock(name: string, fn: AsyncFn, opts?: { onError: (error: unknown) => void }): () => void {
  return () => {
    if (activeLocks.has(name)) {
      logger.warn(`[cron-lock] Skipping "${name}" — previous run still in progress`);
      return;
    }

    activeLocks.add(name);
    fn()
      .catch((error) => {
        if (opts?.onError) opts.onError(error);
      })
      .finally(() => {
        activeLocks.delete(name);
      });
  };
}

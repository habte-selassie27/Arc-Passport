/**
 * Simple concurrency limiter for RPC calls.
 * Ensures only N requests hit the RPC at once — prevents the rate-limit
 * stampede when multiple indexers/scans run simultaneously.
 */

let inflight = 0;
const queue: (() => void)[] = [];
const MAX_CONCURRENT = 1;

export async function rpcGate<T>(fn: () => Promise<T>): Promise<T> {
  if (inflight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  inflight++;
  try {
    return await fn();
  } finally {
    inflight--;
    if (queue.length > 0) queue.shift()!();
  }
}

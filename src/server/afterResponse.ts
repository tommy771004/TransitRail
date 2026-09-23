import { waitUntil } from "@vercel/functions";

/**
 * Let bookkeeping finish after the response instead of before it.
 *
 * Search awaited its audit row and its expected-miss error row before replying,
 * so every answer carried a database round trip the passenger gained nothing
 * from. The write still starts at once; only the reply stops waiting for it.
 * On Vercel, `waitUntil` keeps the instance alive until the write settles — a
 * bare unawaited promise can be frozen with the function. Elsewhere it is a
 * no-op and the long-running server simply finishes the promise.
 */
export function afterResponse(task: Promise<unknown>): void {
  waitUntil(task.catch((error) => {
    console.error("[after-response] Deferred task failed:", error);
  }));
}

// Bound reads even when an adapter ignores AbortSignal. Committers must check
// the signal before publishing a result; writes never use this retry helper.
/** @param {(signal: AbortSignal) => Promise<any> | any} read
 * @param {{signal?: AbortSignal, timeoutMs?: number}} options */
export async function boundedRead(read, { signal, timeoutMs = 60000 } = {}) {
 const controller = new AbortController();
 let timer, rejectAbort;
 const abort = () => controller.abort(signal?.reason || new DOMException('Read cancelled.', 'AbortError'));
 const aborted = new Promise((_, reject) => {
  rejectAbort = () => reject(controller.signal.reason);
  controller.signal.addEventListener('abort', rejectAbort, {once:true});
 });
 if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, {once:true});
 timer = setTimeout(() => controller.abort(new DOMException('Read timed out after 60 seconds.', 'TimeoutError')), timeoutMs);
 try { return await Promise.race([aborted, Promise.resolve().then(() => { controller.signal.throwIfAborted(); return read(controller.signal); })]); }
 finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); controller.signal.removeEventListener('abort', rejectAbort); if(!controller.signal.aborted)controller.abort(); }
}

// Automatic retries are limited to reads. Rollout writes require explicit reconciliation.
export function createReadRequest({ onState, timeoutMs = 60000, retryMs = 60000, sourceRetryMs = 5000, loadingDelayMs = 300 }) {
  let generation = 0, retryTimer, timeoutTimer, loadingTimer, activeController, disposed = false;
  const clear = () => {
    clearTimeout(retryTimer);
    clearTimeout(timeoutTimer);
    clearTimeout(loadingTimer);
    activeController?.abort();
  };
  function run(read, label = 'Loading data') {
    clear();
    const current = ++generation;
    let sourceRecovery = false;
    async function attempt() {
      if (disposed || current !== generation) return;
      activeController = new AbortController();
      const controller = activeController;
      let attemptTimer, delayedLoadingTimer;
      onState({ phase: 'pending', label });
      delayedLoadingTimer = loadingTimer = setTimeout(() => {
        if (!disposed && current === generation) onState({ phase: 'loading', label });
      }, loadingDelayMs);
      try {
        const timeout = new Promise((_, reject) => {
          attemptTimer = timeoutTimer = setTimeout(() => {
            controller.abort();
            reject(new Error('Response timed out'));
          }, timeoutMs);
        });
        const result = await Promise.race([Promise.resolve().then(() => read(controller.signal)), timeout]);
        clearTimeout(attemptTimer);
        clearTimeout(delayedLoadingTimer);
        if (!disposed && current === generation) onState({ phase: 'ready', result, label, sourceRecovered: sourceRecovery });
      } catch (error) {
        clearTimeout(attemptTimer);
        clearTimeout(delayedLoadingTimer);
        controller.abort();
        if (disposed || current !== generation) return;
        const sourceUnavailable = error?.code === 'SOURCE_UNAVAILABLE';
        sourceRecovery ||= sourceUnavailable;
        const delay = sourceRecovery ? sourceRetryMs : retryMs;
        onState({ phase: 'failed', label, sourceUnavailable, recoveringSource: sourceRecovery, timedOut: error?.message === 'Response timed out', retryAt: Date.now() + delay });
        retryTimer = setTimeout(attempt, delay);
      }
    }
    return attempt();
  }
  return {
    run,
    cancel() { ++generation; clear(); if (!disposed) onState({ phase: 'idle' }); },
    destroy() { disposed = true; ++generation; clear(); }
  };
}

export function mountRequestOverlay(root, timings = {}) {
  const host = root.querySelector('#dm-request-state');
  const main = root.querySelector('.dm-main');
  let retryDisplay;
  let busy = false;
  const controller = createReadRequest({ ...timings, onState(state) {
    clearInterval(retryDisplay);
    const waiting = state.phase === 'loading';
    busy = waiting || state.phase === 'pending' || state.phase === 'failed';
    main.setAttribute('aria-busy', String(waiting));
    root.classList.toggle('dm-waiting', waiting);
    // Leave editor DOM and unsaved values intact beneath the overlay.
    for (const element of main.children) if (element !== host) element.inert = waiting;
    if (waiting) {
      host.innerHTML = '<div class="dm-loading-shade" role="status" aria-live="polite"><div class="dm-loading-box"><span class="dm-spinner" aria-hidden="true"></span><strong>Waiting for a response…</strong><span>Timeout after 60 seconds</span></div></div>';
    } else if (state.phase === 'failed') {
      host.innerHTML = `<div class="dm-request-failure" role="alert">${state.timedOut ? 'No response within 60 seconds.' : 'The data request failed.'} Existing data and drafts are preserved. <span class="dm-retry-countdown"></span></div>`;
      const update = () => { host.querySelector('.dm-retry-countdown').textContent = `Retrying in ${Math.max(0, Math.ceil((state.retryAt - Date.now()) / 1000))} seconds.`; };
      update(); retryDisplay = setInterval(update, 1000);
    } else host.innerHTML = '';
    if (state.phase === 'ready') timings.onReady?.(state.result);
    timings.onState?.(state);
  }});
  return {
    read: controller.run,
    get busy() { return busy; },
    cancel: controller.cancel,
    destroy() { controller.destroy(); clearInterval(retryDisplay); host.innerHTML = ''; root.classList.remove('dm-waiting'); main.removeAttribute('aria-busy'); for (const element of main.children) element.inert = false; }
  };
}

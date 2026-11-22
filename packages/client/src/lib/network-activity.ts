// How many of the app's own server requests are loading right now. The background preload queue
// (lib/background-preload.ts) waits for none before it starts, so it never competes with a tap's data.
let inFlight = 0;

export function requestsInFlight(): number {
  return inFlight;
}

/** Counts `promise` as a request in flight until it settles. Returns the same promise. */
export function trackRequest<T>(promise: Promise<T>): Promise<T> {
  inFlight += 1;
  return promise.finally(() => {
    inFlight -= 1;
  });
}

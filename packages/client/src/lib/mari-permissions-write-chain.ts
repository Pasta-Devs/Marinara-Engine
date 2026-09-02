// #5725: ONE serialization point for every Permissions Mode write, shared by
// the Mari panel's per-chat picker and Settings -> Application's global
// default selector. All writes append to a single chain (click order =
// persist order, so the last selection wins server-side), and a Mari run
// awaits the WHOLE chain before POSTing /prompt - the server resolves the
// mode per run, so a pending write from EITHER surface must land first.
// Module-level state is deliberate: the two writers live in unrelated
// component trees, and there is exactly one workspace per app instance.

let chain: Promise<void> = Promise.resolve();

/**
 * Append a Permissions Mode write to the shared chain. Returns the caller's
 * own link (rejections propagate to the caller); the chain itself swallows
 * them so one failed write never blocks later writes or runs.
 */
export function enqueueMariPermissionsModeWrite(write: () => Promise<void>): Promise<void> {
  const link = chain.then(write);
  chain = link.then(
    () => undefined,
    () => undefined,
  );
  return link;
}

/** Settles when every Permissions Mode write enqueued so far has finished. */
export function awaitMariPermissionsModeWrites(): Promise<void> {
  return chain;
}

type ConnectionState = {
  foregroundActive: number;
  backgroundActive: boolean;
  lastForegroundFinishedAt: number;
};

const states = new Map<string, ConnectionState>();
export const BACKGROUND_CONNECTION_IDLE_MS = 30_000;

function stateFor(connectionId: string): ConnectionState {
  const existing = states.get(connectionId);
  if (existing) return existing;
  const state = { foregroundActive: 0, backgroundActive: false, lastForegroundFinishedAt: 0 };
  states.set(connectionId, state);
  return state;
}

export async function withForegroundConnection<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
  const release = beginForegroundConnection(connectionId);
  try {
    return await operation();
  } finally {
    release();
  }
}

export function beginForegroundConnection(connectionId: string): () => void {
  const state = stateFor(connectionId);
  state.foregroundActive += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.foregroundActive -= 1;
    state.lastForegroundFinishedAt = Date.now();
  };
}

export function tryBackgroundConnection(
  connectionId: string,
  at: Date,
): { acquired: false } | { acquired: true; release: () => void } {
  const state = stateFor(connectionId);
  if (
    state.backgroundActive ||
    state.foregroundActive > 0 ||
    at.getTime() - state.lastForegroundFinishedAt < BACKGROUND_CONNECTION_IDLE_MS
  ) {
    return { acquired: false };
  }
  state.backgroundActive = true;
  return {
    acquired: true,
    release: () => {
      state.backgroundActive = false;
    },
  };
}

export function resetConnectionAdmissionForTests(): void {
  states.clear();
}

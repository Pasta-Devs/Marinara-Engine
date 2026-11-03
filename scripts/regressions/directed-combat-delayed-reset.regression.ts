/**
 * A fight command that fails without the fight moving on clears its error 8 s later, so the screen
 * can drive the fight again. That delayed clear belongs to the command that failed: one sent since
 * (a Retry, autoplay's next `continue`, a boss's window driven) must keep being followed while it is
 * in flight. Clearing it used to detach the newer command from the screen, which then sent another
 * `continue` and its queued switches at a stale revision.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock } from "node:test";

const stored = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});

const require = createRequire(new URL("../../packages/client/package.json", import.meta.url));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { QueryClient, QueryClientProvider } =
  await import("../../packages/client/node_modules/@tanstack/react-query/build/modern/index.js");
const { useDirectedCombat } = await import("../../packages/client/src/hooks/use-directed-combat.js");
const { api } = await import("../../packages/client/src/lib/api-client.js");

const flush = () => new Promise((resolve) => setImmediate(resolve));
const client = new QueryClient();
const input = { chatId: "chat-1", anchor: "anchor-1", style: "ruleset" as const, party: [], enemies: [] };
client.setQueryData(["directed-combat", input.chatId, input.anchor], {
  id: "fight-1",
  instanceId: "instance-1",
  revision: 4,
});

let combat: ReturnType<typeof useDirectedCombat>;
function Probe() {
  combat = useDirectedCombat(input);
  return null;
}
renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));

const originalPost = api.post;
const originalGet = api.get;
const cache = client.getMutationCache();
/** How often the screen was taken off a command: a reset takes the observer off the one it follows. */
const detachments = (mutation: unknown) => {
  let count = 0;
  const unsubscribe = cache.subscribe((event) => {
    if (event.type === "observerRemoved" && event.mutation === mutation) count += 1;
  });
  return () => {
    unsubscribe();
    return count;
  };
};
/** Send a command that fails while the fight on the server stays where it was. */
const fail = async () => {
  api.post = (async () => {
    throw new Error("socket hang up");
  }) as typeof api.post;
  combat!.send({ type: "continue" });
  for (let turn = 0; turn < 5; turn++) await flush();
  const failed = cache.getAll().at(-1)!;
  assert.equal(failed.state.status, "error", "the command failed");
  return failed;
};
mock.timers.enable({ apis: ["setTimeout"] });
try {
  api.get = (async () => ({
    session: { id: "fight-1", instanceId: "instance-1", revision: 4 },
  })) as typeof api.get;

  // Alone, a failure's error is cleared after the pause, so the screen drives the fight again.
  {
    const failed = await fail();
    const cleared = detachments(failed);
    mock.timers.tick(8000);
    await flush();
    assert.equal(cleared(), 1, "the error is cleared after the pause");
  }

  // A newer command sent within the pause, still on its way when the pause ends, stays followed.
  {
    await fail();
    api.post = (() => new Promise(() => {})) as typeof api.post;
    combat!.send({ type: "continue" });
    await flush();
    const inFlight = cache.getAll().at(-1)!;
    assert.equal(inFlight.state.status, "pending");
    const detached = detachments(inFlight);
    mock.timers.tick(8000);
    await flush();
    assert.equal(inFlight.state.status, "pending");
    assert.equal(detached(), 0, "the failed command's delayed clear leaves the newer one followed");
  }
} finally {
  mock.timers.reset();
  api.post = originalPost;
  api.get = originalGet;
  client.clear();
}

console.info("directed combat delayed reset regressions passed.");

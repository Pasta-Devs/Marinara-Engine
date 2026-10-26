import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import { createRequire } from "node:module";
import { UI_PERSISTENCE } from "../../packages/client/src/lib/ui-persistence.js";

const stored = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});

try {
  const { useUIStore, pickPersistedUIState } = await import("../../packages/client/src/stores/ui.store.js");
  const require = createRequire(new URL("../../packages/client/package.json", import.meta.url));
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { QueryClient, QueryClientProvider } =
    await import("../../packages/client/node_modules/@tanstack/react-query/build/modern/index.js");
  const { useTestConnection } = await import("../../packages/client/src/hooks/use-connections.js");
  const { api } = await import("../../packages/client/src/lib/api-client.js");
  const client = new QueryClient();
  let mutation: ReturnType<typeof useTestConnection>;
  function Probe() {
    mutation = useTestConnection("account-1");
    return null;
  }
  renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
  const originalPost = api.post;
  let succeeds = false;
  api.post = (async () => ({
    success: succeeds,
    message: "401: Invalid API key",
    latencyMs: 1,
    modelName: null,
  })) as typeof api.post;
  try {
    await mutation!.mutateAsync("model-1");
    assert.equal(useUIStore.getState().connectionTestFailures["account-1"], "401: Invalid API key");
    assert.equal(
      pickPersistedUIState(useUIStore.getState()).connectionTestFailures["account-1"],
      "401: Invalid API key",
    );
    await wait(1100);
    const saved = JSON.parse(stored.get(UI_PERSISTENCE.name)!) as {
      state: { connectionTestFailures: Record<string, string> };
    };
    assert.equal(saved.state.connectionTestFailures["account-1"], "401: Invalid API key");

    useUIStore.setState({ connectionTestFailures: {} });
    await useUIStore.persist.rehydrate();
    assert.equal(
      useUIStore.getState().connectionTestFailures["account-1"],
      "401: Invalid API key",
      "failure survives reload",
    );
    succeeds = true;
    await mutation!.mutateAsync("model-1");
    assert.equal(useUIStore.getState().connectionTestFailures["account-1"], undefined);
    await wait(1100);
    const cleared = JSON.parse(stored.get(UI_PERSISTENCE.name)!) as {
      state: { connectionTestFailures: Record<string, string> };
    };
    assert.equal(cleared.state.connectionTestFailures["account-1"], undefined);
  } finally {
    api.post = originalPost;
    client.clear();
  }
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}
console.log("connection test failure persistence regression passed");

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
  const { useUIStore, pickPersistedUIState, pickSyncedSettings } =
    await import("../../packages/client/src/stores/ui.store.js");
  const { omitLocalOnlySettings } = await import("../../packages/client/src/hooks/use-settings-sync.js");
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
    assert.deepEqual(
      useUIStore.getState().connectionTestFailures,
      { "account-1": "401: Invalid API key" },
      "rehydration keeps a well-formed failure map",
    );
    succeeds = true;
    await mutation!.mutateAsync({ id: "model-1", apiKey: "unsaved-key" });
    assert.equal(
      useUIStore.getState().connectionTestFailures["account-1"],
      "401: Invalid API key",
      "successful draft cannot clear saved failure",
    );
    await mutation!.mutateAsync("model-1");
    assert.equal(useUIStore.getState().connectionTestFailures["account-1"], undefined);
    succeeds = false;
    await mutation!.mutateAsync({ id: "model-1", baseUrl: "http://draft.invalid" });
    assert.equal(
      useUIStore.getState().connectionTestFailures["account-1"],
      undefined,
      "failed draft cannot mark saved account",
    );
    api.post = (async () => ({ success: false, message: "", latencyMs: 1, modelName: null })) as typeof api.post;
    await mutation!.mutateAsync("model-1");
    assert.ok(
      useUIStore.getState().connectionTestFailures["account-1"],
      "empty provider message still records failure",
    );
    assert.equal("connectionTestFailures" in pickSyncedSettings(useUIStore.getState()), false);
    assert.equal(
      "connectionTestFailures" in omitLocalOnlySettings({ connectionTestFailures: { other: "failure" } }),
      false,
    );
    useUIStore.getState().setConnectionTestFailure("account-1", null);
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

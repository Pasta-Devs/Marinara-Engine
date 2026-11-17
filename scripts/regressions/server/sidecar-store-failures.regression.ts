// The client's local model store passes failed unload and delete requests (the chat model and the speech model) on
// to the caller, so the device page can show the error, instead of treating a failure as done.
import assert from "node:assert/strict";

const stored = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
});
const requests: string[] = [];
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  requests.push(`${init?.method ?? "GET"} ${url}`);
  return new Response(JSON.stringify({ error: "The model is busy" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
const { useSidecarStore } = await import("../../../packages/client/src/stores/sidecar.store.js");

useSidecarStore.setState({ status: "ready", modelDownloaded: true });
await assert.rejects(useSidecarStore.getState().unloadModel(), /busy/u);
await assert.rejects(useSidecarStore.getState().deleteModel(), /busy/u);
assert.equal(useSidecarStore.getState().modelDownloaded, true, "a failed delete keeps the model shown as downloaded");
useSidecarStore.setState({ speechModelDownloaded: true });
await assert.rejects(useSidecarStore.getState().deleteSpeechModel(), /busy/u);
assert.equal(useSidecarStore.getState().speechModelDownloaded, true, "a failed delete keeps the speech model shown");
assert.deepEqual(
  requests.filter((request) => !request.startsWith("GET")),
  ["POST /api/sidecar/unload", "DELETE /api/sidecar/model", "DELETE /api/sidecar/speech/model"],
);

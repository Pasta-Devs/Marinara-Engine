// Downloading a sprite in the Android app saves it through the app's file bridge, the same way other saves do,
// because the WebView has no browser download.
import assert from "node:assert/strict";

const saved: Array<{ base64: string; mimeType: string; filename: string }> = [];
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    btoa: (binary: string) => Buffer.from(binary, "binary").toString("base64"),
    MarinaraAndroid: {
      saveFile: (base64: string, mimeType: string, filename: string) => saved.push({ base64, mimeType, filename }),
    },
  },
});
const requested: string[] = [];
globalThis.fetch = (async (url: string) => {
  requested.push(url);
  return new Response(new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }));
}) as typeof fetch;
const { downloadSpriteFile } = await import("../../../packages/client/src/lib/sprite-download.js");

await downloadSpriteFile({ url: "/api/sprites/char-1/happy.png", expression: "happy" });
assert.deepEqual(requested, ["/api/sprites/char-1/happy.png"]);
assert.deepEqual(saved, [
  { base64: Buffer.from([1, 2, 3]).toString("base64"), mimeType: "image/png", filename: "happy.png" },
]);

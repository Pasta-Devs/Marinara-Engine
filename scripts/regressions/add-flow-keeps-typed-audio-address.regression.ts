import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// The Add flow stores a local voice source (PocketTTS) at the address the user typed, not the source default.
// Execute the address expression with the real self-hosted list without mounting React.
const modal = readFileSync(
  new URL(
    "../../packages/client/src/components/modals/create-connection/CreateConnectionModalContent.tsx",
    import.meta.url,
  ),
  "utf8",
);
const line = modal.split("\n").find((l) => l.includes("const mediaBaseUrl ="));
assert.ok(line, "mediaBaseUrl line missing");
const expr = modal.slice(modal.indexOf("const mediaBaseUrl ="), modal.indexOf("const rowProvider"));
const shared = readFileSync(
  new URL("../../packages/client/src/components/modals/create-connection/shared.tsx", import.meta.url),
  "utf8",
);
const selfHostedDefinition = shared.match(/export const SELF_HOSTED = new Set\(\[[\s\S]*?\]\);/u)?.[0];
assert.ok(selfHostedDefinition, "The shared self-hosted source list must exist");
const selfHosted = new Function(`${selfHostedDefinition.replace("export ", "")} return SELF_HOSTED;`)();
const mediaAddress = new Function(
  "account",
  "media",
  "SELF_HOSTED",
  ts.transpile(`const chatProvider = null; const chatBaseUrl = ""; ${expr} return mediaBaseUrl;`, {
    target: ts.ScriptTarget.ES2022,
  }),
);
const pocket = { source: "pockettts", defaultBaseUrl: "http://localhost:8000" };
assert.equal(
  mediaAddress({ baseUrl: "http://voice-server:8123" }, pocket, selfHosted),
  "http://voice-server:8123",
  "PocketTTS must keep the typed address through the shared self-hosted path",
);
assert.equal(mediaAddress({ baseUrl: "" }, pocket, selfHosted), pocket.defaultBaseUrl);
assert.equal(
  mediaAddress({ baseUrl: "http://unrelated:8123" }, { ...pocket, source: "elevenlabs" }, selfHosted),
  pocket.defaultBaseUrl,
  "Hosted media must keep its service endpoint",
);
assert.match(
  modal.replace(/\s+/g, " "),
  /withHttpScheme\( ?baseUrl\.trim\(\) ?\)/,
  "A typed address without a scheme must get one",
);
console.log("Typed PocketTTS address is kept.");

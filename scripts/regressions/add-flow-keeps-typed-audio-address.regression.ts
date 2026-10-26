import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The Add flow stores a local voice source (PocketTTS) at the address the user typed, not the source default.
// Source check: saveAndTest is too tied to React state to run headless.
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
assert.match(expr, /pockettts[\s\S]*account\.baseUrl/, "PocketTTS must keep the typed address");
console.log("Typed PocketTTS address is kept.");

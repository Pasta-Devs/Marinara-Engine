import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A chat without its own Model follows Main, so client gates must not read an empty chat.connectionId as "no model".
// Source checks: the wizard and the game surface are too large to render headless.
const read = (path: string) =>
  readFileSync(new URL(`../../packages/client/src/components/${path}`, import.meta.url), "utf8").replace(/\s+/g, " ");

assert.match(
  read("chat/ChatSetupWizard.tsx"),
  /const hasConnection = !!chat\.connectionId \|\|/,
  "Start chatting must work for a chat that follows Main",
);
assert.doesNotMatch(
  read("game/GameSurface.tsx"),
  /if \(!chat\.connectionId\) return null/,
  "The game world request must be built for a chat that follows Main",
);
console.log("Client gates follow Main.");

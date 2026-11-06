import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isConnectionFlagTrue } from "../../packages/client/src/lib/connection-filters.js";

const source = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
);
const condition = source.match(
  /if \(\s*(chat &&\s*!chat\.connectionId[\s\S]*?)\s*\) \{\s*toast\.error\(localizeUi\("ui\.chat\.chatinput\.itLooksLikeYouHavenTConnectedAnyModel"\)\)/,
)?.[1];
assert.ok(condition, "Read the composer's actual missing-Main guard");
const blocked = new Function(
  "chat",
  "sidecarUseAsMainDefault",
  "contextConnections",
  "isConnectionFlagTrue",
  `return Boolean(${condition.replace(/ as Array<\{ isDefault\?: unknown \}>/g, "")});`,
);
assert.equal(blocked({ connectionId: null }, true, [], isConnectionFlagTrue), false);
assert.equal(blocked({ connectionId: null }, false, [], isConnectionFlagTrue), true);
assert.equal(blocked({ connectionId: null }, false, [{ isDefault: "true" }], isConnectionFlagTrue), false);
assert.equal(blocked({ connectionId: "saved" }, false, [], isConnectionFlagTrue), false);
assert.match(
  source,
  /const sidecarUseAsMainDefault = useSidecarStore\(\(state\) => state\.config\.useAsMainDefault && state\.modelDownloaded\)/,
);
assert.match(source, /\}, \[\s*contextConnections,\s*sidecarUseAsMainDefault,/);
console.log("Composer accepts built-in Main and still blocks a missing Main.");

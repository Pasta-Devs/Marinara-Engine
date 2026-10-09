import assert from "node:assert/strict";
import { createSystemCommandDefinitions } from "../../packages/client/src/lib/command-center-system-commands.js";

// Slice 85: the four Home navigator windows are omnibar commands now, so they must stay reachable without Home.
const commands = createSystemCommandDefinitions({});
for (const [id, window] of [
  ["discord", "discord"],
  ["credits", "credits"],
  ["tutorial", "tutorial"],
  ["widgets", "widgets"],
] as const) {
  const command = commands.find((item) => item.id === id);
  assert.ok(command, `${id} is an omnibar command`);
  assert.equal(command.availability.status, "available", `${id} is always available`);
  assert.deepEqual(
    command.action,
    { kind: "navigate", target: { kind: "window", window } },
    `${id} navigates to ${window}`,
  );
  assert.ok(command.aliases?.length, `${id} has aliases to match a search`);
}
console.info("Omnibar Home commands: discord, credits, tutorial and widgets are reachable from the omnibar.");

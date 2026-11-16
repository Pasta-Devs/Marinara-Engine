// Slash commands: which quick posts run as commands, the arguments of a targeted hide, and the completions offered,
// including commands that need a capability package.
import assert from "node:assert/strict";
import {
  getSlashCompletions,
  matchSlashCommand,
  parseTargetedHideArguments,
  shouldExecuteQuickPostAsCommand,
} from "../../../packages/client/src/lib/slash-commands.js";

assert.equal(shouldExecuteQuickPostAsCommand("/illustrate"), true);
assert.equal(shouldExecuteQuickPostAsCommand("  /roll 1d20  "), true);
assert.equal(shouldExecuteQuickPostAsCommand("/not-a-real-command"), false);
assert.deepEqual(parseTargetedHideArguments("34-40", "roleplay"), {
  kind: "global",
  indices: [34, 35, 36, 37, 38, 39, 40],
});
assert.deepEqual(
  parseTargetedHideArguments('"Lady Maria" 12,18-20', "roleplay", [
    { id: "maria", name: "Lady Maria" },
    { id: "maukie", name: "Maukie" },
  ]),
  {
    kind: "targeted",
    character: { id: "maria", name: "Lady Maria" },
    indices: [12, 18, 19, 20],
  },
);
assert.deepEqual(
  parseTargetedHideArguments("mau 34", "roleplay", [
    { id: "maukie", name: "Maukie" },
    { id: "maurice", name: "Maurice" },
  ]),
  { kind: "error", reason: "ambiguous", targetName: "mau" },
);
const noCapabilityPackages = new Set<string>();
const illustratorCapabilityPackages = new Set(["illustrator"]);
const roleplayCommandsWithoutIllustrator = getSlashCompletions("/", {
  mode: "roleplay",
  availableCapabilityIds: noCapabilityPackages,
});
assert.equal(roleplayCommandsWithoutIllustrator[0]?.name, "help");
assert.equal(
  roleplayCommandsWithoutIllustrator.some((command) => command.name === "illustrate"),
  false,
);
assert.equal(
  roleplayCommandsWithoutIllustrator.some((command) => command.name === "selfie"),
  false,
);
assert.equal(
  getSlashCompletions("/", {
    mode: "roleplay",
    availableCapabilityIds: illustratorCapabilityPackages,
  }).some((command) => command.name === "illustrate"),
  true,
);
assert.equal(
  getSlashCompletions("/", {
    mode: "conversation",
    availableCapabilityIds: illustratorCapabilityPackages,
  }).some((command) => command.name === "selfie"),
  true,
);
assert.equal(
  getSlashCompletions("/", {
    mode: "conversation",
    availableCapabilityIds: illustratorCapabilityPackages,
  }).some((command) => command.name === "illustrate"),
  false,
);
assert.equal(
  matchSlashCommand("/illustrate", {
    mode: "roleplay",
    availableCapabilityIds: noCapabilityPackages,
  }),
  null,
);
assert.equal(
  matchSlashCommand("/illustrate", {
    mode: "roleplay",
    availableCapabilityIds: illustratorCapabilityPackages,
  })?.command.name,
  "illustrate",
);
assert.equal(
  shouldExecuteQuickPostAsCommand("/selfie", {
    mode: "conversation",
    availableCapabilityIds: noCapabilityPackages,
  }),
  false,
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The setup wizard's empty Connection choice names Main, matching the composer, not "None".
// Source check: the wizard is too large to render headless.
const wizard = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatSetupWizard.tsx", import.meta.url),
  "utf8",
);
const used =
  wizard.split("defaultLabel={followMainLabel(connectionOptions, localizeUi, sidecarUseAsMainDefault)}").length - 1;
assert.equal(used, 2, "Conversation and Roleplay wizards must label the empty Connection as following Main");
assert.doesNotMatch(wizard, /defaultLabel=\{localizeUi\("ui\.game\.gamesurfacecomponent\.none"\)\}/);
assert.equal(
  wizard.split(
    "const sidecarUseAsMainDefault = useSidecarStore((state) => state.config.useAsMainDefault && state.modelDownloaded);",
  ).length - 1,
  2,
  "Both wizards must read the built-in Main setting",
);
console.log("Wizard Connection names Main.");

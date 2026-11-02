import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #8690: desktop editors (model settings, characters, agents) unmount ChatArea, so the open setup wizard must
// live in the chat store, a remount must not re-apply saved defaults, and a backdrop click must not cancel setup.
const read = (path: string) => readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");
const chatArea = read("components/chat/ChatArea.tsx");
const wizard = read("components/chat/ChatSetupWizard.tsx");

assert.doesNotMatch(chatArea, /\[wizardOpen, setWizardOpen\] = useState/, "Local state dies with ChatArea");
assert.match(chatArea, /s\.setupWizardChatId === activeChatId/, "ChatArea must read the open wizard from the store");
assert.match(
  chatArea,
  /setupWizardChatId !== activeChatId\) setWizardOpen\(false\)/,
  "A remount on the same chat must keep its wizard open",
);
assert.match(wizard, /autoDefaultsBaselines\.has\(chat\.id\)/, "A remounted wizard must skip saved defaults");
assert.match(
  wizard,
  /autoDefaultsBaselines\.get\(chat\.id\) \?\?/,
  "A remounted wizard must reset to the pre-defaults chat, not the defaulted one",
);
assert.equal(
  wizard.split("<WizardBackdrop onClose=").length - 1,
  1,
  "Only the loading screen may close on a backdrop click",
);
console.log("Setup wizard survives editors.");

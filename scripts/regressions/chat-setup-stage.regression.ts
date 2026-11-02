import assert from "node:assert/strict";

const { backgroundLabel, presetChoiceSummary, shouldShowSetupStage, stageTagline, userMessageSent } =
  await import("../../packages/client/src/lib/chat-setup-stage.js");

const base = { chatId: "c1", mode: "roleplay", stageChatId: "c1", setupComplete: undefined, messages: [] };

// Shown only for the chat the new-chat flow marked, in roleplay or conversation, until setup ends.
assert.equal(shouldShowSetupStage(base), true);
assert.equal(shouldShowSetupStage({ ...base, mode: "conversation" }), true);
assert.equal(
  shouldShowSetupStage({ ...base, messages: [{ role: "assistant", chatId: "c1" }] }),
  true,
  "greeting is a preview",
);
assert.equal(shouldShowSetupStage({ ...base, mode: "game" }), false, "game keeps the wizard");
assert.equal(shouldShowSetupStage({ ...base, stageChatId: null }), false, "existing or reloaded chats never");
assert.equal(shouldShowSetupStage({ ...base, stageChatId: "c2" }), false);
assert.equal(shouldShowSetupStage({ ...base, setupComplete: true }), false, "Begin hides it");
assert.equal(
  shouldShowSetupStage({
    ...base,
    messages: [
      { role: "assistant", chatId: "c1" },
      { role: "user", chatId: "c1" },
    ],
  }),
  false,
  "the first send ends it",
);
// Right after a switch the list can still hold the previous chat's messages; they must not end this chat's setup.
assert.equal(shouldShowSetupStage({ ...base, messages: [{ role: "user", chatId: "old" }] }), true);
assert.equal(userMessageSent([{ role: "user", chatId: "old" }], "c1"), false);
assert.equal(shouldShowSetupStage({ ...base, chatId: null, stageChatId: null }), false);

assert.equal(stageTagline("Smuggler captain of the Gull. Three ways to meet her."), "Smuggler captain of the Gull.");
assert.equal(stageTagline("{{char}} is a smuggler."), null);
assert.equal(stageTagline("x".repeat(120)), null);
assert.equal(stageTagline(""), null);

assert.equal(backgroundLabel("/api/backgrounds/file/harbor-at-night.jpg?v=2"), "Harbor at night");
assert.equal(backgroundLabel(null), null);

const blocks = [
  {
    variableName: "tone",
    options: JSON.stringify([
      { id: "a", label: "An adventure", value: "adv" },
      { id: "b", label: "A novel", value: "nov" },
    ]),
  },
  { variableName: "pov", options: [{ id: "p3", label: "Third person", value: "3rd" }] },
];
assert.equal(presetChoiceSummary(blocks, { tone: "a", pov: ["3rd"] }), "An adventure, Third person");
assert.equal(presetChoiceSummary(blocks, {}), null);

console.log("chat-setup-stage regression passed");

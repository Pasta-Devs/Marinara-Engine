import assert from "node:assert/strict";
import {
  hasVisibleUserMessagePayload,
  isMessageHiddenFromUser,
  isVisibleGameMessage,
} from "../../packages/client/src/lib/chat-message-visibility";

assert.equal(hasVisibleUserMessagePayload("", []), false, "a spatial-only owner turn has no visible payload");
assert.equal(hasVisibleUserMessagePayload("   ", []), false, "whitespace is not visible transcript content");
assert.equal(hasVisibleUserMessagePayload("We enter the kitchen.", []), true, "user-authored text stays visible");
assert.equal(
  hasVisibleUserMessagePayload("", [{ type: "image", data: "data:image/png;base64,AA==" }]),
  true,
  "an attachment-only user turn stays visible",
);

assert.equal(
  isMessageHiddenFromUser({ role: "user", content: "", extra: {} }),
  true,
  "a persisted contentless user anchor is hidden",
);
assert.equal(
  isMessageHiddenFromUser({
    role: "user",
    content: "",
    extra: JSON.stringify({ attachments: [{ type: "image", data: "data:image/png;base64,AA==" }] }),
  }),
  false,
  "serialized attachment metadata keeps the user turn visible",
);
assert.equal(
  isMessageHiddenFromUser({ role: "assistant", content: "", extra: {} }),
  false,
  "the compatibility rule does not hide assistant rows",
);
assert.equal(
  isMessageHiddenFromUser({ role: "user", content: "", extra: { diceRollResult: { total: 20 } } }),
  false,
  "structured dice content keeps a user turn visible",
);
assert.equal(
  isMessageHiddenFromUser({ role: "user", content: "Visible", extra: { hiddenFromUser: true } }),
  true,
  "an explicit hidden marker still takes precedence",
);

for (const activity of [
  { command: { type: "whisper", character: "Bob", text: "Only Bob knows." }, raw: "[whisper]" },
  { command: { type: "notes", content: "Private intentions." }, raw: "[notes]" },
  {
    command: { type: "whisper", character: "", text: "" },
    raw: '[whisper: character="Bob" text="Unfinished',
    error: "roleplay.commands.errors.invalidPrivate",
  },
]) {
  const extra = { roleplayCommandActivity: [activity] };
  assert.equal(
    isMessageHiddenFromUser({ role: "user", content: "", extra: JSON.stringify(extra) }),
    false,
    "private command cards and recoverable errors are visible without public prose",
  );
  assert.equal(
    isMessageHiddenFromUser({ role: "user", content: "", extra: { ...extra, hiddenFromUser: true } }),
    true,
    "command activity cannot override explicit hiding",
  );
  assert.equal(isVisibleGameMessage({ role: "user", content: "", extra }), false);
}
for (const roleplayCommandActivity of [[], [null], [{ command: { type: "unknown" }, raw: "unknown" }]]) {
  assert.equal(
    isMessageHiddenFromUser({ role: "user", content: "", extra: { roleplayCommandActivity } }),
    true,
    "empty or malformed metadata must not create a blank user bubble",
  );
}

for (const role of ["assistant", "narrator", "user", "system"]) {
  assert.equal(isVisibleGameMessage({ role, content: "Visible", extra: "{}" }), true);
  assert.equal(isVisibleGameMessage({ role, content: "Visible", extra: { hiddenFromUser: true } }), false);
  assert.equal(isVisibleGameMessage({ role, content: "Visible", extra: JSON.stringify({ commandOnly: true }) }), false);
  assert.equal(isVisibleGameMessage({ role, content: "   ", extra: {} }), false);
  assert.equal(isVisibleGameMessage({ role, content: "Visible", extra: "malformed" }), true);
}

console.log("Spatial-only message visibility regression checks passed.");

import assert from "node:assert/strict";
import {
  hasVisibleUserMessagePayload,
  isMessageHiddenFromUser,
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

console.log("Spatial-only message visibility regression checks passed.");

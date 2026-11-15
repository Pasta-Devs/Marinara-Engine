import assert from "node:assert/strict";
import { resolveBeholderStateResponse } from "../../../packages/server/src/services/agents/beholder-state.js";

const persona = "Rissha";

function woundsAt(state: { characters: Array<{ name: string; body: Record<string, unknown> }> }, name: string) {
  const character = state.characters.find((entry) => entry.name === name);
  const slot = character?.body.head as { wounds?: Array<{ text: string; severity: string }> } | undefined;
  return slot?.wounds ?? [];
}

// A delta reporting a NEW wound must not erase co-located wounds it did not mention.
const priorSkull = {
  characters: [
    {
      name: "Hesperia",
      body: { head: { wounds: [{ text: "fractured skull", severity: "critical", bleeding: true }] } },
    },
  ],
};
const added = resolveBeholderStateResponse(
  {
    changed: true,
    delta: { Hesperia: { body: { head: { wounds: [{ text: "broken nose", severity: "serious" }] } } } },
  },
  priorSkull,
  persona,
);
assert.equal(added.valid, true);
assert.deepEqual(
  woundsAt(added.state, "Hesperia")
    .map((wound) => wound.text)
    .sort(),
  ["broken nose", "fractured skull"],
  "A new wound must be appended alongside existing co-located wounds",
);

// Re-describing an existing wound updates it in place instead of duplicating it.
const escalated = resolveBeholderStateResponse(
  {
    changed: true,
    delta: {
      Hesperia: { body: { head: { wounds: [{ text: "Fractured Skull", severity: "serious", bleeding: false }] } } },
    },
  },
  priorSkull,
  persona,
);
assert.equal(escalated.valid, true);
assert.equal(woundsAt(escalated.state, "Hesperia").length, 1, "Wound identity is case-insensitive; no duplicate entry");
assert.equal(
  woundsAt(escalated.state, "Hesperia")[0]?.severity,
  "serious",
  "A re-described wound must adopt the delta's updated severity",
);

// An empty array still clears the slot wholesale.
const cleared = resolveBeholderStateResponse(
  { changed: true, delta: { Hesperia: { body: { head: { wounds: [] } } } } },
  priorSkull,
  persona,
);
assert.equal(woundsAt(cleared.state, "Hesperia").length, 0, "An empty wounds array must clear the slot");

// changed:false leaves prior state untouched.
const unchanged = resolveBeholderStateResponse({ changed: false }, priorSkull, persona);
assert.equal(unchanged.valid, true);
assert.deepEqual(
  woundsAt(unchanged.state, "Hesperia").map((wound) => wound.text),
  ["fractured skull"],
);

// Overflow: a full slot whose OLDEST wound is re-described while a new wound arrives must
// keep both the refreshed entry and the new one, dropping an untouched older wound instead.
const fullSlot = {
  characters: [
    {
      name: "Hesperia",
      body: {
        head: {
          wounds: Array.from({ length: 12 }, (_, index) => ({
            text: `wound ${index}`,
            severity: "minor",
            bleeding: false,
          })),
        },
      },
    },
  ],
};
const overflowed = resolveBeholderStateResponse(
  {
    changed: true,
    delta: {
      Hesperia: {
        body: {
          head: {
            wounds: [
              { text: "wound 0", severity: "critical", bleeding: true },
              { text: "fresh gash", severity: "serious", bleeding: true },
            ],
          },
        },
      },
    },
  },
  fullSlot,
  persona,
);
const overflowWounds = woundsAt(overflowed.state, "Hesperia");
assert.equal(overflowWounds.length, 12, "The slot stays bounded at its capacity");
assert.equal(
  overflowWounds.find((wound) => wound.text === "wound 0")?.severity,
  "critical",
  "A re-described wound must survive overflow trimming with its updated severity",
);
assert.ok(
  overflowWounds.some((wound) => wound.text === "fresh gash"),
  "A newly appended wound must survive overflow trimming",
);

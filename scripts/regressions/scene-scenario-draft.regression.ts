import assert from "node:assert/strict";

const { parseSceneScenarioDraft } = await import("../../packages/server/src/routes/scene.routes.js");
const { composeScenarioText } = await import("../../packages/shared/src/utils/scenario-text.js");

const original = {
  premise: "A shared past.\n",
  direction: "Slow-burn romance.",
  opening: { characterId: "char-1", content: "The first message.\n" },
};
const valid = JSON.stringify({ premise: "A lasting premise", opening: "Hello there." });

assert.deepEqual(parseSceneScenarioDraft(valid, "char-1"), {
  draft: { premise: "A lasting premise", direction: "", opening: { characterId: "char-1", content: "Hello there." } },
});
assert.deepEqual(parseSceneScenarioDraft(`\`\`\`json\n${valid}\n\`\`\``, "char-1").draft?.premise, "A lasting premise");
assert.equal(parseSceneScenarioDraft("  ", "char-1").draft, null);
assert.equal(parseSceneScenarioDraft("{broken", "char-1").draft, null);
assert.match(parseSceneScenarioDraft(JSON.stringify({ premise: "Only premise" }), "char-1").error ?? "", /opening/i);

const openingRevision = parseSceneScenarioDraft(JSON.stringify({ opening: "A new opening." }), "char-2", {
  part: "opening",
  current: original,
});
assert.equal(openingRevision.draft?.premise, original.premise);
assert.equal(openingRevision.draft?.direction, original.direction);
assert.equal(openingRevision.draft?.opening.characterId, "char-2");

const premiseRevision = parseSceneScenarioDraft(JSON.stringify({ premise: "A new premise." }), "char-2", {
  part: "premise",
  current: original,
});
assert.deepEqual(premiseRevision.draft?.opening, original.opening);
assert.equal(premiseRevision.draft?.direction, "");

// Direction is optional: missing or empty both parse to "", and a given one is kept.
assert.equal(
  parseSceneScenarioDraft(JSON.stringify({ premise: "P", direction: "", opening: "O" }), "c").draft?.direction,
  "",
);
assert.equal(
  parseSceneScenarioDraft(JSON.stringify({ premise: "P", direction: "Keep it light.", opening: "O" }), "c").draft
    ?.direction,
  "Keep it light.",
);
const premiseWithDirection = parseSceneScenarioDraft(
  JSON.stringify({ premise: "New premise.", direction: "Slower pace." }),
  "char-2",
  { part: "premise", current: original },
);
assert.equal(premiseWithDirection.draft?.direction, "Slower pace.");
assert.deepEqual(premiseWithDirection.draft?.opening, original.opening);

// The saved scenario: premise only without a direction, a labelled block with one.
assert.equal(composeScenarioText("Facts.", ""), "Facts.");
assert.equal(composeScenarioText("Facts.", "  \n "), "Facts.");
assert.equal(
  composeScenarioText("Facts.", " Slow burn. "),
  "Facts.\n\n[Story direction — preferences for how the story may develop, not established facts: Slow burn.]",
);

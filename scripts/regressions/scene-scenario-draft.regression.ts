import assert from "node:assert/strict";

const { parseSceneScenarioDraft } = await import("../../packages/server/src/routes/scene.routes.js");

const original = {
  premise: "A shared past.\n",
  opening: { characterId: "char-1", content: "The first message.\n" },
};
const valid = JSON.stringify({ premise: "A lasting premise", opening: "Hello there." });

assert.deepEqual(parseSceneScenarioDraft(valid, "char-1"), {
  draft: { premise: "A lasting premise", opening: { characterId: "char-1", content: "Hello there." } },
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
assert.equal(openingRevision.draft?.opening.characterId, "char-2");

const premiseRevision = parseSceneScenarioDraft(JSON.stringify({ premise: "A new premise." }), "char-2", {
  part: "premise",
  current: original,
});
assert.deepEqual(premiseRevision.draft?.opening, original.opening);

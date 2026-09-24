import assert from "node:assert/strict";
import { injectIntoOutputFormatOrLastUser } from "../../packages/server/src/routes/generate/generate-route-utils.js";
import { mergeLorebookKeeperUpdateContent } from "../../packages/server/src/routes/generate/lorebook-keeper-utils.js";

// 1. `$` patterns in an injected block (for example from a character name) must be inserted literally.
{
  const messages = [
    { role: "system" as const, content: "BEFORE <output_format>\nRules\n</output_format> AFTER" },
    { role: "user" as const, content: "Hi" },
  ];
  const block = "Speak as Ca$$h and $' and $& and $`";
  injectIntoOutputFormatOrLastUser(messages, block);
  assert.equal(messages[0]!.content, `BEFORE <output_format>\nRules\n${block}\n</output_format> AFTER`);
}

// 2. Keeper merge keeps punctuation-only separator paragraphs in existing content.
{
  const existing = "Section one fact.\n\n---\n\nSection two fact.\n\n***\n\nSection three fact.";
  assert.equal(
    mergeLorebookKeeperUpdateContent({ existingContent: existing, replacementContent: undefined, newFacts: [] }),
    existing,
  );
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: existing,
      replacementContent: undefined,
      newFacts: ["Section two fact."],
    }),
    existing,
  );
  // The #488 duplicate paragraph cleanup still applies to real text.
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: "Mara hunts mages.\n\nMara hunts mages.",
      replacementContent: undefined,
      newFacts: [],
    }),
    "Mara hunts mages.",
  );
}

// 3. A fact that is only a substring of existing text is still novel.
{
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: "Mara is a mage hunter.",
      replacementContent: undefined,
      newFacts: ["Mara is a mage"],
    }),
    "Mara is a mage hunter.\n\n- Mara is a mage",
  );
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: "Her cloak is ashen.",
      replacementContent: undefined,
      newFacts: ["Ash"],
    }),
    "Her cloak is ashen.\n\n- Ash",
  );
  // Facts already present as a bullet, line or sentence are still recognised as known.
  const existing = "Mara lives in Vell. She owns a grey cat.\n\n- Mara fears fire";
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: existing,
      replacementContent: undefined,
      newFacts: ["mara fears fire", "She owns a grey cat", "- Mara lives in Vell."],
    }),
    existing,
  );
}

// 4. Review fix: a multi-sentence fact the keeper already appended as one bullet must not be
// appended again on the next pass, alone or together with other new facts.
{
  const multi = "Mara fears fire. She hides it well.";
  const first = mergeLorebookKeeperUpdateContent({
    existingContent: "Mara is a mage.",
    replacementContent: undefined,
    newFacts: [multi],
  });
  assert.equal(first, "Mara is a mage.\n\n- Mara fears fire. She hides it well.");
  assert.equal(
    mergeLorebookKeeperUpdateContent({ existingContent: first, replacementContent: undefined, newFacts: [multi] }),
    first,
  );
  // Appended together with another fact, the bullets share one paragraph; each line still matches.
  const grouped = mergeLorebookKeeperUpdateContent({
    existingContent: "Mara is a mage.",
    replacementContent: undefined,
    newFacts: [multi, "Mara owns a red boat. It leaks."],
  });
  assert.equal(grouped, "Mara is a mage.\n\n- Mara fears fire. She hides it well.\n- Mara owns a red boat. It leaks.");
  const regrouped = mergeLorebookKeeperUpdateContent({
    existingContent: grouped,
    replacementContent: undefined,
    newFacts: [multi, "Mara owns a red boat. It leaks.", "Mara sails at dawn."],
  });
  assert.equal(regrouped, grouped + "\n\n- Mara sails at dawn.");
  assert.equal(regrouped.split("Mara fears fire").length - 1, 1, "multi-sentence bullet must appear once");
  // Accepted trade-off (documented): a fact contained in a longer sentence is appended as its own bullet.
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: "Mara lives in Vell, a port town.",
      replacementContent: undefined,
      newFacts: ["Mara lives in Vell"],
    }),
    "Mara lives in Vell, a port town.\n\n- Mara lives in Vell",
  );
}

// 5. Review fix: a multi-sentence fact made of whole sentences inside a longer prose line is
// known, and a sentence that ends in a closing quote or bracket still splits from the next one.
{
  const prose = "Kora is a smith. Kora fears fire. She hides it well.";
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: prose,
      replacementContent: undefined,
      newFacts: ["Kora fears fire. She hides it well."],
    }),
    prose,
  );
  // Only some of its sentences known: still novel.
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: prose,
      replacementContent: undefined,
      newFacts: ["Kora fears fire. She fears water too."],
    }),
    prose + "\n\n- Kora fears fire. She fears water too.",
  );
  // Same check against a rewritten replacement body.
  assert.equal(
    mergeLorebookKeeperUpdateContent({
      existingContent: "Old text.",
      replacementContent: prose,
      newFacts: ["Kora is a smith. Kora fears fire."],
    }),
    prose,
  );
  const quoted = 'Kora said "no." Then left.';
  assert.equal(
    mergeLorebookKeeperUpdateContent({ existingContent: quoted, replacementContent: undefined, newFacts: ["Then left."] }),
    quoted,
  );
  const bracketed = "Kora whispered (softly.) Then ran.";
  assert.equal(
    mergeLorebookKeeperUpdateContent({ existingContent: bracketed, replacementContent: undefined, newFacts: ["Then ran."] }),
    bracketed,
  );
}

console.log("server-hunt-b18 regression passed");

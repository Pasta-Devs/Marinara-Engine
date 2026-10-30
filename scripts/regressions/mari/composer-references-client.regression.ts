import assert from "node:assert/strict";
import type { MariComposerReference } from "../../../packages/shared/src/types/chat.js";
import { activeToken } from "../../../packages/client/src/lib/composer-triggers.js";
import { rankCommands, removeCommandToken } from "../../../packages/client/src/lib/mari-commands.js";
import {
  addReference,
  applyReferencePick,
  buildEntryItems,
  buildReferenceItems,
  completedNameAt,
  linkCompletedReference,
  defaultActiveIndex,
  fieldRow,
  isFieldRow,
  isLinkRow,
  isSlashLinkable,
  rankFieldRows,
  REFERENCE_GROUP_ORDER,
  locateReferenceTokens,
  MAX_COMPOSER_REFERENCES,
  maskReferenceQuery,
  pruneReferences,
  rankReferenceItems,
  withoutFuzzyNoise,
  referenceFromResource,
  referenceMatchScore,
} from "../../../packages/client/src/lib/mari-composer-references.js";

const ref = (kind: MariComposerReference["kind"], id: string, label: string): MariComposerReference => ({
  kind,
  id,
  label,
});

// masking and ranking
assert.equal(maskReferenceQuery("@Jes"), "Jes");
assert.equal(maskReferenceQuery('@"Jes'), "Jes");
// The omnibar's scores: exact beats prefix beats whole word beats substring; a typo still matches, below 100.
assert.ok(referenceMatchScore("Jess", "jess")! > referenceMatchScore("Jessica", "jess")!);
assert.equal(referenceMatchScore("Jessica", "jes"), referenceMatchScore("Jessica", "@Jes"));
assert.ok(referenceMatchScore("Jessica", "jes")! > referenceMatchScore("Alice in Wonderland", "in")!);
assert.ok(referenceMatchScore("Alice in Wonderland", "in")! > referenceMatchScore("Alice in Wonderland", "land")!);
assert.ok(referenceMatchScore("Alice in Wonderland", "land")! >= 100);
assert.ok(referenceMatchScore("Jessica", "jsca")! < 100);
assert.equal(referenceMatchScore("Crème Brûlée", "creme"), referenceMatchScore("Creme Brulee", "creme"));
assert.equal(referenceMatchScore("Alice", "zzz"), null);
// names and queries the omnibar folds to nothing still match as plain text
assert.equal(referenceMatchScore("★", "★"), 100);
assert.equal(referenceMatchScore("Yes!!", "!!"), 100);
assert.equal(referenceMatchScore("Alice", "!!"), null);
assert.equal(referenceMatchScore("Alice", ""), 0);

const items = buildReferenceItems({
  characters: [
    { id: "c1", data: JSON.stringify({ name: "Xjessica" }), comment: null },
    { id: "c2", data: JSON.stringify({ name: "Jessica Rabbit" }), comment: null },
    { id: "c3", data: JSON.stringify({ name: "Bob" }), comment: null },
  ],
  personas: [{ id: "p1", name: "Jess" }],
  lorebooks: [{ id: "l1", name: "Jessica's World" }, { id: "l2", name: "  " }, { name: "no id" }],
  presets: [{ id: "r1", name: "Default" }],
});
assert.deepEqual(
  items.map((item) => item.key),
  ["character:c1", "character:c2", "character:c3", "persona:p1", "lorebook:l1", "preset:r1"],
);
const ranked = rankReferenceItems(items, "@jess");
// grouped in order, best match first inside a group (prefix beats substring)
assert.deepEqual(
  ranked.map((row) => row.key),
  ["character:c2", "character:c1", "persona:p1", "lorebook:l1"],
);
// the exact name wins the highlight
assert.equal(ranked[defaultActiveIndex(ranked)]!.key, "persona:p1");
// a typo is listed only while nothing matches literally
assert.deepEqual(
  rankReferenceItems(items, "jsca").map((row) => row.key),
  ["character:c1", "character:c2", "lorebook:l1"],
);
assert.deepEqual(
  rankReferenceItems(
    [...items, { key: "persona:p9", group: "persona", ref: ref("persona", "p9", "Jsca") }],
    "jsca",
  ).map((row) => row.key),
  ["persona:p9"],
);
assert.deepEqual(rankReferenceItems(items, "ice"), []);
assert.equal(rankReferenceItems(items, "Default").length, 1);
assert.equal(rankReferenceItems(items, "").length, 6);
assert.equal(defaultActiveIndex([]), 0);

// the open editor's row leads, and only kinds the resolver reads
const open = referenceFromResource({ kind: "character", id: "c3", label: "Bob" });
assert.deepEqual(open?.ref, ref("character", "c3", "Bob"));
assert.equal(open?.group, "open");
assert.equal(referenceFromResource({ kind: "connection", id: "x", label: "Conn" }), null);
assert.equal(referenceFromResource({ kind: "chat", id: "x", label: "Chat" }), null);
assert.equal(referenceFromResource({ kind: "character", id: "x" }), null);
assert.equal(referenceFromResource(null), null);
const withOpen = rankReferenceItems([open!, ...items], "");
assert.equal(withOpen[0]!.key, "open:character:c3");
assert.equal(defaultActiveIndex(withOpen), 0);
// a better match elsewhere wins the highlight over a weaker open row
const withOpenQuery = rankReferenceItems([open!, ...items], "jess");
assert.equal(withOpenQuery[defaultActiveIndex(withOpenQuery)]!.key, "persona:p1");

// a lorebook's entries carry its id as parentId
const entryItems = buildEntryItems({ id: "l1" }, [
  { id: "e1", name: "The Hat" },
  { id: "e2", name: "" },
]);
assert.deepEqual(
  entryItems.map((item) => item.ref),
  [{ kind: "lorebookEntry", id: "e1", label: "The Hat", parentId: "l1" }],
);

// a big lorebook: the unfiltered list stops at 30 entries; typing reaches the rest
const bigBook = buildEntryItems(
  { id: "l2" },
  Array.from({ length: 40 }, (_, i) => ({ id: `e${i + 1}`, name: `Entry ${i + 1}` })),
);
assert.equal(rankReferenceItems(bigBook, "").length, 30);
assert.deepEqual(
  rankReferenceItems(bigBook, "Entry 31").map((row) => row.ref.id),
  ["e31"],
);

// picking writes the token over the live @ token
const draft = "tell me about @Jes now";
const token = activeToken(draft, 18)!;
assert.deepEqual(applyReferencePick(draft, token, ref("character", "c2", "Jessica Rabbit")), {
  value: "tell me about @Jessica Rabbit now",
  caret: 30,
});
const atEnd = activeToken("hi @Je", 6)!;
assert.deepEqual(applyReferencePick("hi @Je", atEnd, ref("persona", "p1", "Jess")), { value: "hi @Jess ", caret: 9 });
// the caret lands outside the token, so the picker does not reopen
assert.equal(activeToken("hi @Jess ", 9), null);
assert.equal(activeToken("tell me about @Jessica Rabbit now", 28), null);
// a bare name is linked as one token: no quotes in the draft
const bareDraft = "ask @Fel Lock";
assert.deepEqual(
  applyReferencePick(bareDraft, activeToken(bareDraft, bareDraft.length)!, ref("character", "c4", "Fel Lock")),
  {
    value: "ask @Fel Lock ",
    caret: 14,
  },
);

// drop-on-edit: a pick lives while its token text does
const jess = ref("persona", "p1", "Jess");
const jessica = ref("character", "c2", "Jessica Rabbit");
const full = "hi @Jess and @Jessica Rabbit.";
assert.deepEqual(locateReferenceTokens(full, [jess, jessica]), [
  { start: 3, end: 8 },
  { start: 13, end: 28 },
]);
const picks = [jess, jessica];
assert.equal(pruneReferences(full, picks), picks);
assert.deepEqual(pruneReferences("hi @Jessi", picks), []);
assert.deepEqual(pruneReferences("hi @Jess2 and Jessica Rabbit", picks), []);
assert.deepEqual(pruneReferences("hi @Jess2 and @Jessica Rabbit", picks), [jessica]);
assert.deepEqual(pruneReferences("hi Jess and @Jessica Rabbit", picks), [jessica]);
assert.deepEqual(pruneReferences("(@Jess)", picks), [jess]);
assert.deepEqual(pruneReferences("me@Jess", picks), []);
assert.deepEqual(pruneReferences("", picks), []);
// the same name picked twice takes the occurrences in turn
const twin = ref("character", "c9", "Jess");
assert.deepEqual(locateReferenceTokens("@Jess @Jess", [jess, twin]), [
  { start: 0, end: 5 },
  { start: 6, end: 11 },
]);
assert.deepEqual(locateReferenceTokens("@Jess", [jess, twin]), [{ start: 0, end: 5 }, null]);
// a hand-typed token that was never picked is not a reference
assert.deepEqual(pruneReferences("see @docs/FAQ.md", []), []);

// second Tab in prose: the completed name becomes the reference
assert.deepEqual(completedNameAt("tell me about Jessica", ["Jessica", "Jessica Rabbit"]), {
  start: 14,
  label: "Jessica",
});
assert.deepEqual(completedNameAt("about Alice in Wonderland", ["Alice in Wonderland", "Alice"]), {
  start: 6,
  label: "Alice in Wonderland",
});
assert.equal(completedNameAt("@Jess", ["Jess"]), null);
assert.equal(completedNameAt("Jessy", ["Jess"]), null);
assert.equal(completedNameAt("say hi", ["Jessica"]), null);
const plainJess = ref("character", "c6", "Jessica");
assert.deepEqual(linkCompletedReference("tell me about Jessica", ["Jessica"], [plainJess]), {
  value: "tell me about @Jessica",
  caret: 22,
  ref: plainJess,
});
assert.equal(linkCompletedReference("about Jessica", ["Jessica"], [jessica]), null);
// the second Tab writes the reference's own token, so a name typed in another case stays linked
const typedLower = linkCompletedReference("about jessica", ["Jessica"], [plainJess])!;
assert.deepEqual(typedLower, { value: "about @Jessica", caret: 14, ref: plainJess });
assert.deepEqual(locateReferenceTokens(typedLower.value, [plainJess]), [{ start: 6, end: 14 }]);
// a label the token cleans up (quotes, doubled spaces) still finds its token after the link
const quoted = ref("character", "c7", 'The  "Duke"');
const linkedQuoted = linkCompletedReference('meet The  "Duke"', ['The  "Duke"'], [quoted])!;
assert.equal(linkedQuoted.value, "meet @The Duke");
assert.deepEqual(locateReferenceTokens(linkedQuoted.value, [quoted]), [{ start: 5, end: 14 }]);
// the ghost always completes the whole label, so a bare prefix is not a completion
assert.equal(linkCompletedReference("about Jess", ["Jessica"], [jessica]), null);
assert.equal(linkCompletedReference("nothing here", ["Jessica"], [jessica]), null);

// the cap and duplicates
assert.deepEqual(addReference([jess], jess), [jess]);
let many: readonly MariComposerReference[] = [];
for (let i = 0; i < MAX_COMPOSER_REFERENCES + 3; i++) many = addReference(many, ref("preset", `r${i}`, `P${i}`));
assert.equal(many.length, MAX_COMPOSER_REFERENCES);

// commands: one list, ranked by id and alias
const allCommands = ["new", "history", "skills", "memories", "context", "attach", "model", "permissions"] as const;
assert.deepEqual(
  rankCommands("", allCommands).map((command) => command.id),
  [...allCommands],
);
assert.equal(rankCommands("me", allCommands)[0]!.id, "memories");
assert.deepEqual(
  rankCommands("clear", allCommands).map((command) => command.id),
  ["new"],
);
assert.deepEqual(
  rankCommands("zzz", allCommands).map((command) => command.id),
  [],
);
// approvals only exists while it is available
assert.ok(!rankCommands("", allCommands).some((command) => command.id === "approvals"));
assert.ok(!rankCommands("approv", allCommands).some((command) => command.id === "approvals"));
assert.equal(rankCommands("approv", [...allCommands, "approvals"])[0]!.id, "approvals");

// skills and memories as rows: persistent memories are always in context, so they are not listed
const linkables = buildReferenceItems({
  skills: [
    { id: "s1", name: "Characters handbook", origin: "builtin", enabled: true },
    { id: "s2", name: "My skill", origin: "user", enabled: false },
    { id: "s3", name: "Other skill", origin: "user", enabled: true },
  ],
  memories: [
    { id: "m1", name: "Always known", persistent: true, enabled: true },
    { id: "m2", name: "Sometimes known", persistent: false, enabled: false },
  ],
});
assert.deepEqual(
  linkables.map((item) => [item.key, item.group, item.ref.label, item.state]),
  [
    ["skill:s1", "skill", "Characters handbook", "always"],
    ["skill:s2", "skill", "My skill", "off"],
    ["skill:s3", "skill", "Other skill", "on"],
    ["memory:m2", "memory", "Sometimes known", "off"],
  ],
);
assert.deepEqual(
  rankReferenceItems(linkables, "").map((row) => row.group),
  ["skill", "skill", "skill", "memory"],
);
// `/cha` picks the skill like an `@` pick: the query becomes `@Label `, caret after the space
const slashDraft = "/cha";
const slashToken = activeToken(slashDraft, slashDraft.length)!;
assert.equal(slashToken.trigger, "/");
assert.equal(rankReferenceItems(linkables, slashToken.query)[0]!.ref.label, "Characters handbook");
assert.deepEqual(applyReferencePick(slashDraft, slashToken, linkables[0]!.ref), {
  value: "@Characters handbook ",
  caret: 21,
});
// a command pick cuts the `/query` out and leaves the rest of the draft alone
const commandDraft = "look at this\n/hist";
const commandToken = activeToken(commandDraft, commandDraft.length)!;
assert.deepEqual(removeCommandToken(commandDraft, commandToken), { value: "look at this\n", caret: 13 });
const midDraft = "/hist and more";
assert.deepEqual(removeCommandToken(midDraft, activeToken(midDraft, 5)!), { value: " and more", caret: 0 });

// chats, agents and docs: groups after memory and before entries; a doc row carries its path
const more = buildReferenceItems({
  skills: [{ id: "s1", name: "Handbook", origin: "builtin" }],
  memories: [{ id: "m1", name: "Memo", enabled: true }],
  chats: [
    { id: "t1", name: "Trip planning" },
    { id: "t2", name: "  " },
  ],
  agents: [{ id: "a1", name: "Continuity" }, { name: "no id" }],
  docs: [
    { path: "docs/FAQ.md", title: "Frequently asked questions" },
    { path: "README.md", title: " " },
  ],
});
assert.deepEqual(
  rankReferenceItems(more, "").map((row) => row.key),
  ["skill:s1", "memory:m1", "chat:t1", "agent:a1", "doc:docs/FAQ.md", "doc:README.md"],
);
assert.deepEqual(REFERENCE_GROUP_ORDER.slice(-4), ["chat", "agent", "doc", "lorebookEntry"]);
const docRow = more.find((item) => item.key === "doc:docs/FAQ.md")!;
assert.deepEqual(docRow.ref, ref("doc", "docs/FAQ.md", "Frequently asked questions"));
assert.equal(docRow.detail, "docs/FAQ.md");
assert.equal(
  more.find((item) => item.key === "doc:README.md")!.ref.label,
  "README.md",
  "no title falls back to the path",
);
assert.equal(more.find((item) => item.key === "chat:t1")!.detail, undefined);
// `/` still lists only skills and memories to link
assert.deepEqual(
  more.filter(isSlashLinkable).map((item) => item.key),
  ["skill:s1", "memory:m1"],
);

// Faces: each kind's image as the omnibar reads it; a chat shows who is in it, badged with its mode.
const faced = buildReferenceItems({
  characters: [
    { id: "c1", data: { name: "Ann" }, avatarPath: "/a/ann.png" },
    { id: "c2", data: { name: "Bo" } },
  ],
  personas: [{ id: "p1", name: "Me", avatarPath: "/a/me.png" }],
  lorebooks: [{ id: "l1", name: "World", imagePath: "/a/world.png" }],
  presets: [{ id: "s1", name: "Plain" }],
  chats: [{ id: "h1", name: "Talk", mode: "roleplay", characterIds: ["c1", "c2", "gone"] }],
  agents: [{ id: "g1", name: "Agent", imagePath: "/a/agent.png" }],
  skills: [{ id: "k1", name: "Decisions", origin: "builtin" }],
});
const mediaOf = (key: string) => faced.find((item) => item.key === key)?.media;
assert.equal(mediaOf("character:c1")?.src, "/a/ann.png");
assert.equal(mediaOf("character:c2"), undefined);
assert.equal(mediaOf("persona:p1")?.src, "/a/me.png");
assert.equal(mediaOf("lorebook:l1")?.src, "/a/world.png");
assert.equal(mediaOf("preset:s1"), undefined);
assert.equal(mediaOf("agent:g1")?.src, "/a/agent.png");
assert.equal(mediaOf("skill:k1"), undefined);
assert.equal(mediaOf("chat:h1")?.src, "/a/ann.png");
// both characters are faces, the one without an avatar as a placeholder; an unknown id is not
assert.equal(mediaOf("chat:h1")?.faces?.length, 2);
assert.equal(mediaOf("chat:h1")?.faces?.[1]?.src, undefined);
assert.equal(mediaOf("chat:h1")?.chatMode, "roleplay");

// `/` lists commands and links together: a typo row of one kind drops beside a literal row of the other
assert.deepEqual(
  withoutFuzzyNoise([
    { key: "command:history", score: 207 },
    { key: "skill:k1", score: 40 },
  ]).map((row) => row.key),
  ["command:history"],
);
assert.equal(withoutFuzzyNoise([{ key: "skill:k1", score: 40 }]).length, 1);

// Docked beside an editor, a typed `@` query lists its fields; picking one is not a link.
{
  const fields = [
    { id: "description", label: "Description" },
    { id: "scenario", label: "Scenario" },
    { id: "first_mes", label: "First message" },
  ];
  assert.deepEqual(rankFieldRows(fields, "@"), [], "no field rows before a query is typed");
  const scen = rankFieldRows(fields, "@scen");
  assert.deepEqual(
    scen.map((row) => row.field.id),
    ["scenario"],
  );
  assert.equal(scen[0]!.key, "field:scenario");
  assert.ok(isFieldRow(scen[0]) && !isLinkRow(scen[0]), "a field row links nothing");
  assert.deepEqual(
    rankFieldRows(fields, "@first").map((row) => row.field.id),
    ["first_mes"],
  );
  const [character] = rankReferenceItems(
    buildReferenceItems({ characters: [{ id: "c1", data: { name: "Scenario Bot" } }] }),
    "scen",
  );
  assert.ok(character && isLinkRow(character), "a record row is a link");
  assert.deepEqual(fieldRow(fields[1]!, 0), { key: "field:scenario", group: "field", field: fields[1], score: 0 });
}

console.log("Composer references client regression passed");

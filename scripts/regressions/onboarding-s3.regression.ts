// Interactive onboarding — slice 3: card variables (#7434).
//
// A second list of questions whose answers become CHAT variables instead of
// persona text, so a card field can carry a permanent `{{relationshipToUser}}`
// that each chat fills in during setup. This pins the resolver, the relevance
// rule, the guard that suppresses an enabled-but-empty block, the id/cap
// handling for the second list, and the validator's card path.
import assert from "node:assert/strict";
import {
  characterExtensionsSchema,
  canBuildPersona,
  dropUnreadableOnboarding,
  findUnresolvedCardVariableUses,
  formatTextQuotes,
  getCardVariableChipNames,
  getNextCardVariable,
  getRelevantCardVariables,
  hasOnboardingContent,
  listNames,
  MAX_CARD_VARIABLES,
  MAX_CHAT_VARIABLE_VALUE_LENGTH,
  mergeCardVariables,
  ONBOARDING_MAX_QUESTIONS,
  resolveCardVariables,
  resolveCardQuestions,
  seedCardVariables,
  validateOnboarding,
  withUniqueOnboardingIds,
  type CharacterOnboarding,
  type OnboardingAnswers,
} from "../../packages/shared/src/index.js";

function onboarding(input: Record<string, unknown> = {}): CharacterOnboarding {
  const parsed = characterExtensionsSchema.parse({ onboarding: { enabled: true, ...input } }).onboarding;
  assert.ok(parsed);
  return parsed as CharacterOnboarding;
}
const option = (id: string, value: string, label = value) => ({ id, label, value });

// ── The fixture ──
// `relationshipToUser` and `tone` are read by the card's description.
// `formality` is reached ONLY from `tone`'s chosen option value, so it becomes
// relevant only after `tone` is answered — the engine reads option values lazily.
// `mood` is referenced nowhere and must never be asked.
const CARD_FIELDS = {
  description: "She greets {{relationshipToUser}} {{tone}}.",
  scenario: "A guildhall at dusk.",
};
const card = onboarding({
  cardVariables: [
    {
      id: "rel",
      variableName: "relationshipToUser",
      question: "Who are you to her?",
      options: [option("friend", "a childhood friend"), option("rival", "a rival")],
    },
    {
      id: "tone",
      variableName: "tone",
      question: "How does she address you?",
      options: [option("warm", "warmly, as {{formality}}")],
    },
    { id: "formality", variableName: "formality", question: "What does she call you?" },
    { id: "mood", variableName: "mood", question: "Your mood?" },
  ],
});
const names = (variables: Array<{ variableName: string }>) => variables.map((variable) => variable.variableName);
const answers = (input: Record<string, { optionIds?: string[]; text?: string }>) => input as OnboardingAnswers;

// ── The resolver: answers become chat variables ──
assert.deepEqual(
  resolveCardVariables(
    card,
    answers({
      relationshipToUser: { optionIds: ["friend"] },
      tone: { optionIds: ["warm"] },
      formality: { text: "my lady" },
    }),
  ),
  { relationshipToUser: "a childhood friend", tone: "warmly, as my lady", formality: "my lady" },
  "a picked option and free text both resolve",
);

// Option values are pre-resolved: the engine's `{{name}}` catch-all is a single
// pass (macro-engine.ts), so a value inserted with a macro still inside it would
// reach the prompt as a literal tag.
assert.equal(
  resolveCardVariables(
    card,
    answers({
      relationshipToUser: { optionIds: ["friend"] },
      tone: { optionIds: ["warm"] },
      formality: { text: "my lady" },
    }),
  ).tone,
  "warmly, as my lady",
  "a macro inside a chosen option value is resolved before the value is stored",
);

// A blank option value means "same as the label".
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [{ id: "r", variableName: "faction", question: "?", options: [option("c", "", "Crown")] }],
    }),
    answers({ faction: { optionIds: ["c"] } }),
  ),
  { faction: "Crown" },
  "a blank option value falls back to its label",
);

// Only answered questions are written, so a half-finished wizard stores nothing.
assert.deepEqual(
  resolveCardVariables(card, answers({ relationshipToUser: { optionIds: ["friend"] } })),
  { relationshipToUser: "a childhood friend" },
  "unanswered questions are omitted entirely",
);

// A value still holding a tag nothing will resolve is dropped, never stored:
// storing it would put a literal `{{...}}` into every prompt from then on.
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [{ id: "x", variableName: "leftover", question: "?", options: [option("o", "{{nope}}")] }],
    }),
    answers({ leftover: { optionIds: ["o"] } }),
  ),
  {},
  "an answer that does not resolve is dropped, never stored as a raw tag",
);

// A BASE macro is different, and this is the distinction review caught: the
// engine runs its built-in passes before the `{{name}}` catch-all, so `{{user}}`
// and `{{char}}` stay live and are filled in when the prompt is built. Treating
// every `{{tag}}` as unusable silently dropped a perfectly good answer like
// "{{user}}'s old friend" — the same rule the seeding path already applies.
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [
        { id: "u", variableName: "bond", question: "?", options: [option("o", "{{user}}'s old friend")] },
      ],
    }),
    answers({ bond: { optionIds: ["o"] } }),
  ),
  { bond: "{{user}}'s old friend" },
  "a base macro in an answer is kept, so it resolves per user when the prompt is built",
);
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [{ id: "c", variableName: "tie", question: "?", options: [option("o", "{{char}}'s rival")] }],
    }),
    answers({ tie: { optionIds: ["o"] } }),
  ),
  { tie: "{{char}}'s rival" },
  "{{char}} is a base macro too, and survives the same way",
);
// But a base macro mixed with a name nothing resolves still drops the answer:
// the unresolved half would reach the model raw.
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [
        { id: "m", variableName: "mixed", question: "?", options: [option("o", "{{user}} of {{nowhere}}")] },
      ],
    }),
    answers({ mixed: { optionIds: ["o"] } }),
  ),
  {},
  "a base macro does not excuse a second, unresolvable tag in the same value",
);

// The metadata route 400s a value above MAX_CHAT_VARIABLE_VALUE_LENGTH, and the
// rejection takes the WHOLE macroVariables patch with it, so one over-long answer
// would silently lose every other answer the player gave. Skipped here instead,
// exactly like an unusable name.
const overLong = "x".repeat(MAX_CHAT_VARIABLE_VALUE_LENGTH + 1);
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [
        { id: "long", variableName: "essay", question: "?" },
        { id: "ok", variableName: "kept", question: "?" },
      ],
    }),
    answers({ essay: { text: overLong }, kept: { text: "short" } }),
  ),
  { kept: "short" },
  "an over-long answer is dropped so it cannot reject the whole patch",
);
// The boundary itself is allowed: only longer than the cap is refused.
assert.deepEqual(
  resolveCardVariables(
    onboarding({ cardVariables: [{ id: "max", variableName: "atCap", question: "?" }] }),
    answers({ atCap: { text: "y".repeat(MAX_CHAT_VARIABLE_VALUE_LENGTH) } }),
  ),
  { atCap: "y".repeat(MAX_CHAT_VARIABLE_VALUE_LENGTH) },
  "a value exactly at the cap is still stored",
);
// The seeding path writes through patchMetadata rather than the route, so it
// needs the same guard or a long default would be stored anyway.
assert.deepEqual(
  seedCardVariables(
    onboarding({
      cardVariables: [{ id: "d", variableName: "defaulted", question: "?", options: [option("o", overLong)] }],
    }),
  ),
  {},
  "an over-long seeded default is skipped on the write-through path too",
);

// The modal merges every card's answers into one map, and it must keep only the
// names each card actually ASKS. `resolveCardVariables` also writes a
// declared-but-unasked name, because its answer map carries a default for every
// declared question — and a name no card field reads is never "relevant", so the
// clash warning cannot see it either. Merging it unfiltered let one card silently
// overwrite another card's real answer with its own first option.
const asks = (variables: Array<{ variableName: string }>) => new Set(variables.map((v) => v.variableName));

// One card that reads the name, one that declares it but reads nothing.
const readingCard = onboarding({
  cardVariables: [{ id: "r", variableName: "tone", question: "?", options: [option("o", "warm")] }],
  description: "She speaks {{tone}}.",
});
const silentCard = onboarding({
  cardVariables: [{ id: "s", variableName: "tone", question: "?", options: [option("s", "cold")] }],
});
const readingAnswers = answers({ tone: { optionIds: ["o"] } });
const silentAnswers = answers({ tone: { optionIds: ["s"] } });

// Unfiltered, the silent card wins by being last — the bug.
assert.deepEqual(
  {
    ...resolveCardVariables(readingCard, readingAnswers),
    ...resolveCardVariables(silentCard, silentAnswers),
  },
  { tone: "cold" },
  "unfiltered, the card that asks nothing still overwrites the card that does",
);
// Filtered to what each card asks, the reading card's answer survives.
assert.deepEqual(
  mergeCardVariables(
    [
      { onboarding: readingCard, answers: readingAnswers },
      { onboarding: silentCard, answers: silentAnswers },
    ],
    [
      asks(getRelevantCardVariables(readingCard, { description: "She speaks {{tone}}." }, readingAnswers)),
      asks(getRelevantCardVariables(silentCard, { description: "no tags" }, silentAnswers)),
    ],
  ),
  { tone: "warm" },
  "the merge keeps the answer from the card that asks, and drops the silent one",
);
// And a silent card alone contributes nothing at all.
assert.deepEqual(
  mergeCardVariables(
    [{ onboarding: silentCard, answers: silentAnswers }],
    [asks(getRelevantCardVariables(silentCard, { description: "no tags" }, silentAnswers))],
  ),
  {},
  "a card that reads nothing writes nothing",
);

// The server rejects a whole `macroVariables` patch over one bad name, which
// would lose every answer in it, so unusable names are skipped here instead.
assert.deepEqual(
  resolveCardVariables(
    onboarding({
      cardVariables: [
        { id: "bad", variableName: "if", question: "?" },
        { id: "dashes", variableName: "a-b", question: "?" },
        { id: "good", variableName: "kept", question: "?" },
      ],
    }),
    answers({ if: { text: "x" }, "a-b": { text: "y" }, kept: { text: "z" } }),
  ),
  { kept: "z" },
  "a reserved name and a name a bare {{tag}} cannot address are skipped, not stored",
);

// Own properties only: a question named after a prototype member must be inert.
assert.deepEqual(
  resolveCardVariables(
    onboarding({ cardVariables: [{ id: "p", variableName: "constructor", question: "?" }] }),
    Object.assign(Object.create(null) as OnboardingAnswers, { constructor: { text: "boom" } }),
  ),
  {},
  "a prototype-member name is refused rather than resolving to Object.prototype",
);

// ── Relevance: which card questions get asked ──
assert.deepEqual(
  names(getRelevantCardVariables(card, CARD_FIELDS, answers({}))),
  ["relationshipToUser", "tone"],
  "only the card variables the card's own fields read are asked",
);
assert.deepEqual(
  names(getRelevantCardVariables(card, CARD_FIELDS, answers({ relationshipToUser: { optionIds: ["friend"] } }))),
  ["relationshipToUser", "tone"],
  "an unanswered question's option values are not read yet, so `formality` waits",
);
assert.deepEqual(
  names(
    getRelevantCardVariables(
      card,
      CARD_FIELDS,
      answers({ relationshipToUser: { optionIds: ["friend"] }, tone: { optionIds: ["warm"] } }),
    ),
  ),
  ["relationshipToUser", "tone", "formality"],
  "a question reached from a CHOSEN option value becomes relevant once that answer exists",
);
assert.equal(
  names(getRelevantCardVariables(card, CARD_FIELDS, answers({}))).includes("mood"),
  false,
  "a card variable no field references is never asked",
);
assert.equal(
  names(getRelevantCardVariables(card, CARD_FIELDS, answers({}))).includes("formality"),
  false,
  "a question whose only reference is an option value is not asked before that answer",
);
// A name reachable only from a condition still counts.
assert.deepEqual(
  names(
    getRelevantCardVariables(
      onboarding({ cardVariables: [{ id: "k", variableName: "knowsHer", question: "Do you know her?" }] }),
      { description: "{{#if knowsHer}}You grew up together.{{/if}}" },
      answers({}),
    ),
  ),
  ["knowsHer"],
  "a variable used only inside a condition is still asked",
);
assert.equal(
  getNextCardVariable(card, CARD_FIELDS, answers({}))?.variableName,
  "relationshipToUser",
  "the first unanswered relevant question is next",
);
assert.equal(
  getNextCardVariable(
    card,
    CARD_FIELDS,
    answers({ relationshipToUser: { optionIds: ["friend"] }, tone: { optionIds: ["warm"] }, formality: { text: "x" } }),
  ),
  null,
  "no question is pending once every relevant one is answered",
);
assert.deepEqual(
  names(getRelevantCardVariables(onboarding({}), CARD_FIELDS, answers({}))),
  [],
  "a card with no card questions asks nothing",
);

// ── The guard for an enabled-but-empty block ──
assert.equal(hasOnboardingContent(onboarding()), false, "enabled but completely empty is nothing to offer");
assert.equal(
  hasOnboardingContent(onboarding({ description: "A wandering scholar." })),
  true,
  "field text with no questions is a valid ready-made persona, not empty",
);
assert.equal(
  hasOnboardingContent(onboarding({ cardVariables: [{ id: "a", variableName: "mood", question: "?" }] })),
  true,
  "a card question alone counts as content",
);
assert.equal(
  hasOnboardingContent(onboarding({ cardVariables: [{ id: "a", variableName: "", question: "?" }] })),
  false,
  "a question without a name is not content",
);

// ── Ids and the cap cover the card list too ──
const dupes = withUniqueOnboardingIds(
  onboarding({
    variables: [{ id: "same", variableName: "a", question: "?" }],
    cardVariables: [
      { id: "same", variableName: "b", question: "?" },
      { id: "same", variableName: "c", question: "?" },
    ],
  }),
);
assert.deepEqual(
  dupes.cardVariables.map((variable) => variable.id),
  ["same", "same_2"],
  "repeated ids get unique ones inside the card list",
);
assert.equal(dupes.variables[0]!.id, "same", "an id may repeat ACROSS the lists: they are never shown together");
assert.equal(dupes.cardVariables[0]!.variableName, "b", "the first use of an id keeps it");

const overCap = dropUnreadableOnboarding({
  onboarding: {
    enabled: true,
    cardVariables: Array.from({ length: ONBOARDING_MAX_QUESTIONS + 5 }, (_, index) => ({
      id: `q${index}`,
      variableName: `v${index}`,
    })),
  },
});
assert.equal(overCap.truncated, true, "an over-cap card list reports truncation");
assert.equal(
  (overCap.extensions.onboarding as CharacterOnboarding).cardVariables.length,
  ONBOARDING_MAX_QUESTIONS,
  "imports keep only the first questions of the card list too",
);
const intact = dropUnreadableOnboarding({
  onboarding: { enabled: true, description: "{{a}}", cardVariables: [{ id: "a", variableName: "a" }] },
});
assert.equal(intact.truncated, false, "a card list within the cap is not reported as truncated");

// ── The validator's card path ──
const issuesFor = (input: Record<string, unknown>, fields?: Record<string, string>) =>
  validateOnboarding(onboarding(input), fields);
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "a", variableName: "used", question: "?" }] }, { description: "{{used}}" }),
  [],
  "a card question its field uses is clean",
);
assert.deepEqual(
  issuesFor(
    { cardVariables: [{ id: "a", variableName: "never", question: "?" }] },
    { description: "no tags here" },
  ).map((issue) => issue.code),
  ["unused"],
  "a card question no card field uses is flagged as unused",
);
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "a", variableName: "if", question: "?" }] }, { description: "{{if}}" }).map(
    (issue) => issue.code,
  ),
  ["reservedName"],
  "a built-in macro name is refused for a card question too",
);
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "a", variableName: "a-b", question: "?" }] }, { description: "no tags" }).map(
    (issue) => issue.code,
  ),
  ["invalidName"],
  "a name a bare {{tag}} cannot address is flagged for a card question",
);
assert.equal(
  issuesFor({
    variables: [{ id: "a", variableName: "dup", question: "?" }],
    cardVariables: [{ id: "b", variableName: "dup", question: "?" }],
  }).filter((issue) => issue.code === "duplicateName").length > 0,
  true,
  "a name used in both lists is a duplicate: it would be one chat variable with two answers",
);
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "a", variableName: "player", question: "?" }] }, { description: "{{player}}" }),
  [],
  "`player` is only special for the persona list; as a card variable it is an ordinary name",
);
// The reported issue carries no list tag: the editor knows which list it is
// rendering, so the shared shape stays exactly as it was before this feature.
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "a", variableName: "never", question: "?" }] }, { description: "" }),
  [{ code: "unused", variableId: "a", name: "never" }],
  "a card issue has the same shape as a persona issue",
);
// Without the card's text there is nothing to match against, so `unused` is not
// reported: the editor always passes it, an import-time check may not.
assert.equal(
  validateOnboarding(onboarding({ cardVariables: [{ id: "a", variableName: "used", question: "?" }] })).some(
    (issue) => issue.code === "unused",
  ),
  false,
  "without card fields, card questions are not called unused",
);
// An id may repeat across the two lists (only within a list must it be unique),
// and `withUniqueOnboardingIds` leaves such a pair alone.
const sharedId = withUniqueOnboardingIds(
  onboarding({
    variables: [{ id: "a", variableName: "personaOnly", question: "?" }],
    cardVariables: [{ id: "a", variableName: "cardOnly", question: "?" }],
  }),
);
assert.equal(
  sharedId.variables[0]!.id === "a" && sharedId.cardVariables![0]!.id === "a",
  true,
  "an id repeated across the two lists is not renamed: they are never rendered together",
);
// So an issue carries `variableId` and `name` but no list tag — an identical id
// in both lists yields two issues that only the name tells apart. The editor
// routes by that pair; a future `list` field would replace the pairing.
assert.deepEqual(
  validateOnboarding(sharedId, { description: "", personality: "", backstory: "", appearance: "", scenario: "" }).map(
    (issue) => [issue.code, issue.variableId, issue.name],
  ),
  [
    ["unused", "a", "personaOnly"],
    ["unused", "a", "cardOnly"],
  ],
  "a shared id yields one issue per list, distinguishable by name alone",
);

// ── Which names each side knows ──
// A persona field keeps its `{{name}}` through persona creation, and a card
// answer is a chat variable, so the prompt resolves a card name written into a
// persona field (measured 2026-10-11). No warning there — it does work.
assert.deepEqual(
  issuesFor(
    {
      description: "She greets {{cardOnly}}.",
      variables: [{ id: "p", variableName: "personaOnly" }],
      cardVariables: [{ id: "c", variableName: "cardOnly" }],
    },
    CARD_FIELDS,
  ).filter((issue) => issue.code === "unknownName"),
  [],
  "a card name in a persona field is known: the chat's own answer resolves it there",
);
// The card's own text is deliberately not scanned for unknown names: a card
// field is the author's prose and only ever reaches the model, whereas
// `unknownName` reports a tag typed into one of the PERSONA question fields,
// where a leftover would be written into the persona the player gets.
// An option value belongs to its own list either way. A persona option value
// keeps its `{{cardName}}` through persona creation exactly like field text does,
// so the chat resolves it later — known, no warning.
assert.deepEqual(
  issuesFor({
    variables: [{ id: "p", variableName: "personaOnly", options: [option("a", "{{cardOnly}}")] }],
    cardVariables: [{ id: "c", variableName: "cardOnly" }],
  })
    .filter((issue) => issue.code === "unknownOptionName")
    .map((issue) => issue.name),
  [],
  "a card name in a persona option value is known: it survives into the persona and the chat resolves it",
);
// A card option value is different: it is resolved while the persona is built,
// from the card's own answers alone, so it knows card names only.
assert.deepEqual(
  issuesFor({
    cardVariables: [
      { id: "c", variableName: "cardOnly", options: [option("a", "{{cardLater}}")] },
      { id: "d", variableName: "cardLater" },
    ],
    variables: [{ id: "p", variableName: "personaOnly" }],
  })
    .filter((issue) => issue.code === "unknownOptionName")
    .map((issue) => issue.name),
  [],
  "a card option value may name another card question",
);
assert.deepEqual(
  issuesFor({
    cardVariables: [{ id: "c", variableName: "cardOnly", options: [option("a", "{{personaOnly}}")] }],
    variables: [{ id: "p", variableName: "personaOnly" }],
  })
    .filter((issue) => issue.code === "unknownOptionName")
    .map((issue) => issue.name),
  ["personaOnly"],
  "a persona name in a card option value is unknown: the card's own answers cannot fill it",
);
// The split decides `unused` the same way: only the field a question feeds
// counts as reading it.
const crossRead = {
  variables: [{ id: "p", variableName: "personaOnly" }],
  cardVariables: [
    { id: "c", variableName: "cardOnly" },
    { id: "d", variableName: "cardUnread" },
  ],
};
assert.deepEqual(
  issuesFor(crossRead, { description: "She greets {{cardOnly}} and {{personaOnly}}." })
    .filter((issue) => issue.code === "unused")
    .map((issue) => issue.name)
    .sort(),
  ["cardUnread", "personaOnly"],
  "a card field does not read a persona question, and reading one card name leaves the other card question unused",
);
assert.deepEqual(
  issuesFor(
    { ...crossRead, description: "{{cardOnly}}", personality: "Reads {{personaOnly}}." },
    { description: "nothing here" },
  )
    .filter((issue) => issue.code === "unused")
    .map((issue) => issue.name)
    .sort(),
  ["cardOnly", "cardUnread"],
  "a persona field does not read a card question, so neither card question is used",
);

// A card question reached ONLY from another card question's option value is used.
// The persona list already counted option values; the card list did not, so a
// follow-up question was flagged unused while the question that asks it was not.
assert.deepEqual(
  issuesFor(
    {
      cardVariables: [
        { id: "a", variableName: "pick", options: [{ id: "o", label: "One", value: "{{followUp}}" }] },
        { id: "b", variableName: "followUp" },
      ],
    },
    { description: "Reads {{pick}}." },
  )
    .filter((issue) => issue.code === "unused")
    .map((issue) => issue.name),
  [],
  "a card question referenced only by another card question's option is not reported unused",
);
// But a card question nothing reaches is still reported, so the fix did not
// simply silence the warning for the whole card list.
assert.deepEqual(
  issuesFor(
    {
      cardVariables: [
        { id: "a", variableName: "pick", options: [{ id: "o", label: "One", value: "{{followUp}}" }] },
        { id: "b", variableName: "followUp" },
        { id: "c", variableName: "nothingReadsMe" },
      ],
    },
    { description: "Reads {{pick}}." },
  )
    .filter((issue) => issue.code === "unused")
    .map((issue) => issue.name),
  ["nothingReadsMe"],
  "an unreachable card question is still reported unused",
);
// `player` is exempt on the persona list because it names the persona. As a card
// variable it is an ordinary chat name, so an unread one is worth the warning —
// the two lists must not share that exemption. Tested with a card-only `player`:
// declaring it on both lists trips the shared `duplicateName` rule first, since
// the two are answered in one window.
assert.deepEqual(
  issuesFor({ cardVariables: [{ id: "c", variableName: "player" }] }, { description: "nothing here" })
    .filter((issue) => issue.code === "unused")
    .map((issue) => issue.name),
  ["player"],
  "an unread card question named player is reported, unlike the exempt persona one",
);
assert.deepEqual(
  issuesFor({ variables: [{ id: "p", variableName: "player" }] }, { description: "nothing here" }).filter(
    (issue) => issue.code === "unused",
  ),
  [],
  "the persona list keeps its player exemption, so the card rule did not leak into it",
);

// ── The deferred greeting limitation is detectable ──
// A greeting is shown from the client's own macro context, which does not read
// chat variables, so a card variable there renders literally for now (see PR).
assert.deepEqual(
  [...findUnresolvedCardVariableUses(card, ["Hello, {{relationshipToUser}}.", "No tags here."])],
  ["relationshipToUser"],
  "a card variable used in a greeting is found, so the author can be warned",
);
assert.deepEqual(
  [...findUnresolvedCardVariableUses(card, ["{{somethingElse}}", "{{mood}}"])],
  ["mood"],
  "only names that are actually card variables are reported",
);
assert.deepEqual(
  [...findUnresolvedCardVariableUses(onboarding({}), ["{{anything}}"])],
  [],
  "no card questions, nothing to report",
);

// ── Default seeding for chats that never ask the questions (#7434, S3) ──
// The Roleplay wizard writes real answers, but a chat can also be created
// without it (Quick Start, the conversation wizard, start-from-card). Seeding
// the declared questions' defaults keeps the card's `{{name}}` from reaching
// the model as a literal tag.
const seeded = seedCardVariables(card);
assert.deepEqual(
  seeded,
  { relationshipToUser: "a childhood friend" },
  "a choice question seeds its first option; a free-text question seeds nothing at all",
);
assert.equal(
  seeded.relationshipToUser,
  resolveCardVariables(card, answers({ relationshipToUser: { optionIds: ["friend"] } })).relationshipToUser,
  "the seed is the same value the questions window starts on, not a second opinion",
);
// The option value itself carries a macro (`warmly, as {{formality}}`), and
// `formality` has no default, so `tone` cannot be seeded: writing it would put a
// literal tag in the prompt, which is the whole thing this exists to prevent.
const withUnresolvedDefault = onboarding({
  cardVariables: [{ id: "t", variableName: "tone", options: [option("warm", "warmly, as {{formality}}")] }],
});
assert.deepEqual(
  seedCardVariables(withUnresolvedDefault),
  {},
  "a default holding an unresolved macro is dropped rather than stored as a raw tag",
);
assert.deepEqual(
  seedCardVariables(onboarding({ cardVariables: [{ id: "n", variableName: "nickname" }] })),
  {},
  "a free-text question has no default, so the name stays absent",
);
assert.deepEqual(seedCardVariables(onboarding({})), {}, "no card questions, nothing seeded");
assert.deepEqual(seedCardVariables(null), {}, "a card without onboarding is safe to ask");
assert.deepEqual(seedCardVariables(undefined), {}, "an absent onboarding block is safe to ask");
// Names the chat route would refuse are skipped, because one bad name 400s the
// whole `macroVariables` patch and would take every seeded answer with it.
assert.deepEqual(
  seedCardVariables(
    onboarding({
      cardVariables: [
        { id: "r", variableName: "char", options: [option("a", "someone")] },
        { id: "o", variableName: "nickname", options: [option("a", "Sunny")] },
      ],
    }),
  ),
  { nickname: "Sunny" },
  "a reserved name is skipped and the storable one beside it still seeds",
);
// `__proto__` is refused outright: the engine only reads bare `{{name}}` tags,
// so a name the chat route would reject must not be seeded either. The point of
// the assertion is that the rejection is by NAME RULE, not by an assignment that
// could have reached Object.prototype on the way.
const protoSeed = seedCardVariables(
  onboarding({ cardVariables: [{ id: "p", variableName: "__proto__", options: [option("a", "polluted")] }] }),
);
assert.deepEqual(protoSeed, {}, "a question named __proto__ is not storable, so nothing seeds");
assert.equal(({} as Record<string, unknown>).polluted, undefined, "and never reaches Object.prototype");
assert.equal(Object.getPrototypeOf(protoSeed), Object.prototype, "the result is an ordinary object");
// The cap is the same one the write path enforces, so a card at the limit seeds
// exactly what it could have written.
const manyDefaults = onboarding({
  cardVariables: Array.from({ length: MAX_CARD_VARIABLES + 5 }, (_, index) => ({
    id: `v${index}`,
    variableName: `name${index}`,
    options: [option(`o${index}`, `value${index}`)],
  })),
});
assert.equal(Object.keys(seedCardVariables(manyDefaults)).length, MAX_CARD_VARIABLES, "seeding stops at the cap");

// `{{user}}` / `{{char}}` STAY LIVE. This file's convention (see
// `resolveFields`) is that both resolve to themselves, so a seeded value keeps
// them and the engine fills in the real name at generation time — per user,
// per chat, forever. A default that baked in today's name would be wrong.
assert.deepEqual(
  seedCardVariables(
    onboarding({ cardVariables: [{ id: "u", variableName: "ally", options: [option("a", "{{user}}'s old friend")] }] }),
  ),
  { ally: "{{user}}'s old friend" },
  "a user macro stays live in a seeded default",
);
assert.deepEqual(
  seedCardVariables(
    onboarding({
      cardVariables: [{ id: "s", variableName: "ally", options: [option("a", "one of {{char}}'s allies")] }],
    }),
  ),
  { ally: "one of {{char}}'s allies" },
  "a char macro stays live in a seeded default",
);
// A leftover tag naming another QUESTION is different: nothing will resolve it,
// so the prompt would show it raw and the name stays unseeded instead.
assert.deepEqual(
  seedCardVariables(
    onboarding({ cardVariables: [{ id: "d", variableName: "ally", options: [option("a", "with {{nowhere}}")] }] }),
  ),
  {},
  "a default naming a question with no default of its own is dropped",
);
// A default that merely mentions another question IS usable once that question
// has a default of its own: the two passes let it settle in either order.
const chainedDefaults = onboarding({
  cardVariables: [
    { id: "a", variableName: "rank", options: [option("a", "a captain")] },
    { id: "b", variableName: "title", options: [option("b", "{{rank}} of the guard")] },
  ],
});
assert.deepEqual(
  seedCardVariables(chainedDefaults),
  { rank: "a captain", title: "a captain of the guard" },
  "a default built from another question resolves once that question has a default",
);
// Order must not matter: the dependent question may be declared first.
assert.deepEqual(
  seedCardVariables(
    onboarding({
      cardVariables: [
        { id: "b", variableName: "title", options: [option("b", "{{rank}} of the guard")] },
        { id: "a", variableName: "rank", options: [option("a", "a captain")] },
      ],
    }),
  ),
  { title: "a captain of the guard", rank: "a captain" },
  "declaration order does not change what can be resolved",
);

// ── The card's own fields live on `extensions` (#7434 review) ──────────────
// A card field's `{{tag}}` is what MAKES its question relevant, so reading the
// field from the wrong level hides the question completely: the wizard passed
// `data.backstory`, which is undefined, and a question used only in the
// backstory was never asked. Pin both levels so the mapping cannot drift back.
const wiredCard = characterExtensionsSchema.parse({
  description: "Reads {{relationshipToUser}}.",
  extensions: { backstory: "Relationship to user: {{relationshipToUser}}." },
  onboarding: {
    enabled: true,
    cardVariables: [{ id: "rel", variableName: "relationshipToUser", question: "Who are you to her?" }],
  },
});
const wiredOnboarding = wiredCard.onboarding as CharacterOnboarding;
const wiredFields = {
  description: wiredCard.description,
  personality: wiredCard.personality,
  backstory: wiredCard.extensions.backstory,
  appearance: wiredCard.extensions.appearance,
  scenario: wiredCard.scenario,
};
assert.deepEqual(
  names(getRelevantCardVariables(wiredOnboarding, wiredFields, answers({}))),
  ["relationshipToUser"],
  "a question used in the card's extensions.backstory is relevant",
);
// The old, wrong mapping read the top level. It must find nothing, which is the
// regression this pins: the question silently vanishing from the window.
assert.deepEqual(
  names(
    getRelevantCardVariables(
      wiredOnboarding,
      { ...wiredFields, backstory: undefined, description: undefined },
      answers({}),
    ),
  ),
  [],
  "reading backstory from the top level finds nothing, which is the bug that was fixed",
);

// A card question resolves against the CARD's context. Resolving it with the
// persona's helper blanks its names and renders an empty heading (the second
// half of the same review), so pin that it does NOT come back blank.
const cardQuestionText = resolveCardQuestions(
  wiredOnboarding,
  answers({ relationshipToUser: { optionIds: ["friend"] } }),
  "Anastasia",
);
assert.equal(
  cardQuestionText.get("rel"),
  "Who are you to her?",
  "a card question with no placeholders resolves to its own text",
);
const placeholderCard = characterExtensionsSchema.parse({
  onboarding: {
    enabled: true,
    cardVariables: [{ id: "rel", variableName: "relationshipToUser", question: "What is {{char}} to you, {{user}}?" }],
  },
});
const placeholderText = resolveCardQuestions(
  placeholderCard.onboarding as CharacterOnboarding,
  answers({}),
  "Anastasia",
);
assert.equal(
  placeholderText.get("rel"),
  "What is Anastasia to you, {{user}}?",
  "{{char}} resolves to the card's name and an unanswered {{user}} stays live",
);

// ── `{{user}}` stays live in a card question's heading ─────────────────────
// A card question is asked BEFORE the player's name exists (and it may never
// exist, when no persona is created). Substituting an ellipsis printed
// "What is Raven's relationship to …", which the user reported as broken.
const userQuestion = onboarding({
  cardVariables: [
    { id: "rel", variableName: "relationshipToUser", question: "What is Raven's relationship to {{user}}?" },
  ],
}) as CharacterOnboarding;
assert.equal(
  resolveCardQuestions(userQuestion, {}, "Raven").get("rel"),
  "What is Raven's relationship to {{user}}?",
  "an unanswered {{user}} stays live rather than printing an ellipsis",
);
assert.equal(
  resolveCardQuestions(userQuestion, { player: { text: "Fel" } }, "Raven").get("rel"),
  "What is Raven's relationship to Fel?",
  "{{user}} resolves once the persona path supplied a name",
);
// A name from THIS card's own list is still blanked when unanswered: nothing
// will ever resolve it, so a raw tag would reach the heading.
assert.equal(
  resolveCardQuestions(
    onboarding({
      cardVariables: [
        { id: "a", variableName: "mood", question: "How is {{tone}} today?" },
        { id: "b", variableName: "tone", question: "Tone?" },
      ],
    }) as CharacterOnboarding,
    {},
    "Raven",
  ).get("a"),
  "How is … today?",
  "an unanswered question name is still blanked, not left as a tag",
);

// The user caught this one: with an EXISTING persona picked there is no name
// question to answer, so `{{user}}` printed raw in card headings while a persona
// question beside it resolved. The caller passes the known name in.
assert.equal(
  resolveCardQuestions(userQuestion, {}, "Raven", "Fel Lockheart").get("rel"),
  "What is Raven's relationship to Fel Lockheart?",
  "a pre-picked persona's name resolves {{user}} in a card heading",
);
// An explicit answer still wins over the passed-in name.
assert.equal(
  resolveCardQuestions(userQuestion, { player: { text: "Answered" } }, "Raven", "Ignored").get("rel"),
  "What is Raven's relationship to Answered?",
  "the in-window answer outranks the pre-picked persona name",
);
// Whitespace is not a name.
assert.equal(
  resolveCardQuestions(userQuestion, {}, "Raven", "   ").get("rel"),
  "What is Raven's relationship to {{user}}?",
  "a blank player name leaves the tag live rather than printing spaces",
);

// ── canBuildPersona: the persona template gate ────────────────────────────
// The "Create your persona" template must be offered only when the card can
// actually fill a persona in. The user's card had no persona questions and
// empty persona fields, and was still offered one.
assert.equal(
  canBuildPersona(
    onboarding({
      cardVariables: [{ id: "rel", variableName: "relationshipToUser", question: "Who?" }],
    }) as CharacterOnboarding,
  ),
  false,
  "a card with only card questions is NOT offered as a persona template",
);
assert.equal(
  canBuildPersona(
    onboarding({ variables: [{ id: "v", variableName: "mood", question: "Mood?" }] }) as CharacterOnboarding,
  ),
  true,
  "a card with persona questions IS offered",
);
assert.equal(
  canBuildPersona(onboarding({ description: "Ready-made persona text." }) as CharacterOnboarding),
  true,
  "a card shipping persona field text with no questions is still offered",
);
assert.equal(
  canBuildPersona(onboarding({}) as CharacterOnboarding),
  false,
  "an enabled but entirely empty block is not offered",
);
// The two predicates must stay distinct: the marker uses hasOnboardingContent,
// which stays true for a card-questions-only card.
assert.equal(
  hasOnboardingContent(
    onboarding({
      cardVariables: [{ id: "rel", variableName: "relationshipToUser", question: "Who?" }],
    }) as CharacterOnboarding,
  ),
  true,
  "a card-questions-only card still counts as onboarding content",
);

// The user caught this: the opening line's name list was derived from the
// card-QUESTION targets, so a participant without card questions vanished from
// it — and with no card questions at all the sentence lost its subject entirely
// ("  has a few questions"). The list is now every participant, independent of
// who has questions. Pinned here as the join rule the heading depends on.
assert.equal(listNames(["Raven"]), "Raven", "one participant is named plainly");
assert.equal(listNames(["Jessica", "Raven"]), "Jessica and Raven", "two are joined with and");
assert.equal(listNames(["A", "B", "C"]), "A, B and C", "three take the serial form without an Oxford comma");
assert.equal(listNames([]), "", "an empty list yields no stray text");

// ── Card-tab chips (#7434, S4) ──
// The Card tab offers the same "Available variables" chips the Onboarding tab
// does, so an author can insert a card question without leaving the tab. The rule
// lives in `getCardVariableChipNames`, which the editor itself calls — an inline
// copy here would keep passing after the editor's version changed.
//
// EVERY declared name is offered, used or not: an answer may legitimately be
// inserted into several fields, and a freshly written question must be
// insertable before it is used anywhere. A usage filter would hide the chip
// exactly when the author needs it, and the unused warning already covers the
// "nothing reads this" case.
const chipBlock = onboarding({
  cardVariables: [
    { id: "a", variableName: "relationshipToUser", question: "Who?" },
    { id: "b", variableName: "tone", question: "How?" },
    { id: "c", variableName: "unusedAnywhere", question: "Unused?" },
  ],
}) as CharacterOnboarding;

assert.deepEqual(
  getCardVariableChipNames(chipBlock),
  ["relationshipToUser", "tone", "unusedAnywhere"],
  "every declared card question is offered, including one used in no field yet",
);
// The disabled block is the whole point of the user's first gate: an off toggle
// means nothing is read, so nothing is offered even though names are declared.
assert.deepEqual(
  getCardVariableChipNames({ ...chipBlock, enabled: false }),
  [],
  "the onboarding toggle being off offers no chips, so a disabled block is not read",
);
assert.deepEqual(getCardVariableChipNames(null), [], "a card with no onboarding block at all offers no chips");
assert.deepEqual(
  getCardVariableChipNames(onboarding({ cardVariables: [] }) as CharacterOnboarding),
  [],
  "an enabled block with no card questions offers no chips",
);
// A blank name would render an unusable `{{}}` chip, and the validator already
// reports the empty name separately.
assert.deepEqual(
  getCardVariableChipNames(
    onboarding({
      cardVariables: [
        { id: "a", variableName: "  ", question: "Blank" },
        { id: "b", variableName: "kept", question: "Kept" },
      ],
    }) as CharacterOnboarding,
  ),
  ["kept"],
  "a blank name is not offered as a chip",
);
// One name declared twice must produce one chip, not two identical buttons.
assert.deepEqual(
  getCardVariableChipNames(
    onboarding({
      cardVariables: [
        { id: "a", variableName: "tone", question: "One" },
        { id: "b", variableName: "tone", question: "Two" },
      ],
    }) as CharacterOnboarding,
  ),
  ["tone"],
  "a duplicated name yields a single chip",
);

// ── Why a chip click must not re-format the author's text (#7434, S4) ──
// This pins the LIBRARY behaviour that made the bug possible, since that is the
// part a regression can reach: `formatTextQuotes` maps a field ONTO the active
// format, so it rewrites text whenever the two disagree. All five Card fields go
// through a setter that calls it, which is why inserting one tag used to rewrite
// every quote already in the field. The editor's own bypass is pinned by
// inspection, not here — it is a call-site choice, not a pure function.
// The consequence worth remembering: the bug is INVISIBLE when the field's text
// already matches the setting, which is why a hand test found nothing.
const straight = '- She said "hi" once';
const curly = "- She said \u201chi\u201d once";
const possessive = "her mother's life";

assert.equal(
  formatTextQuotes(possessive, "straight"),
  possessive,
  "a possessive apostrophe survives the straight format, so only the mismatch case moves",
);
assert.notEqual(
  formatTextQuotes(possessive, "typographic"),
  possessive,
  "the typographic format DOES rewrite an apostrophe, which is the surprise a chip click would cause",
);
assert.notEqual(
  formatTextQuotes(curly, "straight"),
  curly,
  "straight mode rewrites curly quotes, so the mismatch is real in both directions",
);
assert.equal(
  formatTextQuotes(straight, "straight"),
  straight,
  "matching style is a no-op, which is why a hand test on matching text shows nothing",
);

console.info("onboarding s3 (card variables) regressions passed.");

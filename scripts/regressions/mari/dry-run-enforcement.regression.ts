// #7949 run 2: a live 12b sent three app_data dry runs for one card edit and said it was done each time.
// The guard caught the first claim and passed the paraphrase ("now correctly reflects 1745"), the
// result's only warning sat ahead of the whole card echoed twice, and no handbook was read because the
// failure hint never fires on a write that succeeds wrongly. Each fix is pinned here.
import assert from "node:assert/strict";
import {
  APP_DATA_DRY_RUN_SENTINEL,
  auditWorkspaceCompletionClaim,
  compactMutationResult,
  type WorkspaceCommandResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  newRoundReviewState,
  reviewRoundClaim,
} from "../../../packages/server/src/services/professor-mari/workspace-round-review.js";
import { skillGateRefusal } from "../../../packages/server/src/services/professor-mari/workspace-commands.js";
import type { MariDbCommandResult } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const read: WorkspaceCommandResult = {
  id: "get",
  name: "app_data",
  input: { action: "character.get", characterId: "elsie" },
  output: 'Command: app_data character.get\n\nstdout:\n{"ok":true}',
  success: true,
};
const dryRun = (id: string): WorkspaceCommandResult => ({
  id,
  name: "app_data",
  input: { action: "character.update", characterId: "elsie", data: { description: "died in 1745" } },
  output: `${APP_DATA_DRY_RUN_SENTINEL}\nCommand: app_data character.update\n\nstdout:\n{"ok":true,"mode":"dry-run","saved":false}`,
  success: true,
});
const applied: WorkspaceCommandResult = {
  ...dryRun("applied"),
  input: { ...dryRun("x").input, apply: true },
  output: 'Command: app_data character.update\n\nstdout:\n{"ok":true,"mode":"apply","saved":true}',
};
const final = (visibleText: string, commands: unknown[] = []) =>
  ({ visibleText, commands, stop: commands.length === 0 }) as Parameters<typeof auditWorkspaceCompletionClaim>[0];

// The live final reply: no word the tripwire knows, so only the results can catch it.
const paraphrase =
  "I've verified the records, and Elsie's description now correctly reflects her death in 1745.\n\nWhy:\n* Confirmed the year is now 1745.";
const scope = [read, dryRun("d1"), dryRun("d2")];
assert.equal(auditWorkspaceCompletionClaim(final(paraphrase), scope).issue, "dry_run");
assert.equal(auditWorkspaceCompletionClaim(final("Done! Updated the description."), scope).issue, "dry_run");

// Honest endings are not this case: a question, or saying nothing was saved. ("was saved" still trips the
// older word check, which is its own matter.)
assert.equal(auditWorkspaceCompletionClaim(final("Here is the change. Want me to save it?"), scope).issue, null);
assert.notEqual(auditWorkspaceCompletionClaim(final("Preview only: nothing was saved yet."), scope).issue, "dry_run");
// ...unless something beside the "would" claims it was done.
assert.equal(
  auditWorkspaceCompletionClaim(final("Done — the entry would fire on any of those words."), scope).issue,
  "dry_run",
);
// A preview described as what it would do claims nothing was done.
assert.notEqual(
  auditWorkspaceCompletionClaim(final("The entry would fire on Vlad and the castle."), scope).issue,
  "dry_run",
);
// A denial beside it is not a claim either.
assert.notEqual(
  auditWorkspaceCompletionClaim(
    final("This is a preview — the entry would fire on 'guild'. No entry was created."),
    scope,
  ).issue,
  "dry_run",
);
// A plain denial needs no "would" to be honest...
assert.notEqual(auditWorkspaceCompletionClaim(final("No changes were made."), scope).issue, "dry_run");
// ...and a state claim beside a "would" is still a claim.
assert.equal(
  auditWorkspaceCompletionClaim(
    final("The card now reflects the new greeting; the entry would fire on 'guild'."),
    scope,
  ).issue,
  "dry_run",
);
// "is now" that hands the decision back is not a claim; the adverb on either side of a state verb is.
assert.notEqual(
  auditWorkspaceCompletionClaim(final("It is now up to you whether to apply; nothing was saved."), scope).issue,
  "dry_run",
);
for (const claim of [
  "The entry would fire on 'guild'; the card reads 1745 now.",
  "The entry would fire on 'guild', and the card already reflects the greeting.",
  "Nothing else was touched; the description is now 1745.",
  "Nothing was saved; the card has 1745 now.",
  "Nothing was saved; the card has 1745 already.",
  // No verb list decides these: "already" claims a finished state, and "now" before any present tense.
  "Nothing was saved; the entry fires on 'guild' already.",
  "Nothing was saved; the entry now triggers on 'guild'.",
]) {
  assert.equal(auditWorkspaceCompletionClaim(final(claim), scope).issue, "dry_run", claim);
}
// A waiting state describes the preview, not a saved value.
for (const handBack of [
  "Nothing was saved; the preview is now ready.",
  "Nothing was saved; the change is now pending your approval.",
  // Offering the save now is not claiming it.
  "Nothing was saved. I can apply it now if you'd like.",
]) {
  assert.notEqual(auditWorkspaceCompletionClaim(final(handBack), scope).issue, "dry_run", handBack);
}
// An applied write, or a round that still has commands, is not this case.
assert.notEqual(auditWorkspaceCompletionClaim(final(paraphrase), [...scope, applied]).issue, "dry_run");
assert.notEqual(auditWorkspaceCompletionClaim(final(paraphrase, [{}]), scope).issue, "dry_run");
// Only dry runs since the last audited claim count.
assert.notEqual(auditWorkspaceCompletionClaim(final(paraphrase), scope, { auditFrom: 3 }).issue, "dry_run");

const decision = reviewRoundClaim(newRoundReviewState(), {
  action: { ...final(paraphrase), protocolValid: true },
  commandResultsForContinuity: scope,
  truncated: false,
});
assert.equal(decision.kind, "repair");
assert.match(
  decision.kind === "repair" ? decision.prompt : "",
  /Every write since your last checked reply was a dry run, so those changes were not saved.*anything applied earlier still stands.*send the same call again with top-level "apply": true/,
);

// The preview keeps only what changed, two levels deep; an insert stays whole.
const card = (description: string) => ({
  id: "elsie",
  data: { name: "Elspeth", description, personality: "x".repeat(4000) },
  comment: "",
});
const compact = compactMutationResult({
  ok: true,
  mode: "dry-run",
  summary: {
    preview: [
      { table: "characters", id: "elsie", action: "replace", before: card("died 1746"), after: card("died 1745") },
      { table: "characters", id: "new", action: "insert", before: null, after: card("new") },
    ],
  },
} as unknown as MariDbCommandResult) as { summary: { preview: Array<Record<string, unknown>> } };
const [replace, insert] = compact.summary.preview;
assert.deepEqual(replace!.before, { data: { description: "died 1746" } });
assert.deepEqual(replace!.after, { data: { description: "died 1745" } });
assert.equal(replace!.unchangedFieldsOmitted, true);
assert.deepEqual(insert!.after, card("new"), "an insert keeps the whole new row");

// The handbook gate: a preview counts as a write.
const preview = skillGateRefusal("character.update", { action: "character.update", apply: false }, new Set<string>());
assert.match(String(preview), /builtin-characters/, "a preview counts as a write");

console.log("Professor Mari dry-run enforcement regression passed.");

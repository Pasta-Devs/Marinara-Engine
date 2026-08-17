// #4812: Prof Mari can now SEE and EDIT specific parts of a preset — sections, groups, and
// choice-blocks — through granular actions modeled on the lorebook entry actions, instead of only
// creating/replacing a whole preset. This drives the REAL MariDbService against a file-native store
// and asserts the read/update/add/delete surface plus the folded #4813 child-clobber guard.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { promptPresets } from "../../../packages/server/src/db/schema/prompts.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-preset-granular-"));
process.env.FILE_STORAGE_DIR = dir;

const drainKeep = async (mari: MariDbService) => {
  for (const approval of mari.getPendingApprovals()) await mari.keepAppliedReview(approval.id);
};
const sectionContent = async (mari: MariDbService, sectionId: string) =>
  ((await mari.executeAction({ action: "preset.getSection", sectionId })).output as { content?: string } | null)?.content;

try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);

    // Seed a preset with two sections (one grouped), a group, and a choice-block.
    const created = await mari.executeAction({
      action: "preset.create",
      data: {
        name: "Granular Preset",
        system_key: "marinara-universal-preset",
        groups: [{ name: "Formatting" }],
        sections: [
          { name: "Intro", content: "You are a helpful assistant.", role: "system" },
          { name: "Style", content: "Write in a terse voice.", role: "system", groupName: "Formatting" },
        ],
        choiceBlocks: [{ variableName: "POV", question: "Point of view?", options: ["first", "third"] }],
      },
      apply: true,
    });
    assert.equal(created.ok, true, "preset.create succeeds");
    await drainKeep(mari);
    const presetList = (await mari.executeAction({ action: "preset.list" })).output as Array<{ id: string; name: string }>;
    const presetId = presetList.find((preset) => preset.name === "Granular Preset")?.id;
    assert.ok(presetId, "the created preset is listed");
    const createdPreset = (await mari.executeAction({ action: "preset.get", presetId })).output as {
      systemKey?: string;
    };
    assert.equal(createdPreset.systemKey, "", "preset.create cannot claim an Engine-owned system key");

    // Raw DB writes must obey the same Engine-owned systemKey boundary.
    const rawPreset = (await mari.executeCli({ argv: ["db", "get", "prompt_presets", presetId] })).output as Record<
      string,
      unknown
    >;
    const rawInsertId = "raw-system-key-preset";
    const rawInsert = await mari.executeCli({
      argv: [
        "db",
        "insert",
        "prompt_presets",
        "--json",
        JSON.stringify({ ...rawPreset, id: rawInsertId, name: "Raw insert", systemKey: "claimed" }),
        "--apply",
      ],
    });
    assert.equal(rawInsert.ok, true);
    await drainKeep(mari);
    assert.equal(
      ((await mari.executeCli({ argv: ["db", "get", "prompt_presets", rawInsertId] })).output as {
        systemKey?: string;
      }).systemKey,
      "",
      "raw insert cannot claim systemKey",
    );

    await db.update(promptPresets).set({ systemKey: "engine-owned-regression" }).where(eq(promptPresets.id, presetId));
    const rawPatch = await mari.executeCli({
      argv: [
        "db",
        "patch",
        "prompt_presets",
        presetId,
        "--json",
        JSON.stringify({ description: "patched", systemKey: "claimed" }),
        "--apply",
      ],
    });
    assert.equal(rawPatch.ok, true);
    await drainKeep(mari);
    const afterPatch = (await mari.executeCli({ argv: ["db", "get", "prompt_presets", presetId] })).output as Record<string, unknown>;
    assert.equal(afterPatch.systemKey, "engine-owned-regression", "raw patch preserves systemKey");
    const rawReplace = await mari.executeCli({
      argv: [
        "db",
        "replace",
        "prompt_presets",
        presetId,
        "--json",
        JSON.stringify({ ...afterPatch, description: "replaced", systemKey: "claimed" }),
        "--apply",
      ],
    });
    assert.equal(rawReplace.ok, true);
    await drainKeep(mari);
    assert.equal(
      ((await mari.executeCli({ argv: ["db", "get", "prompt_presets", presetId] })).output as {
        systemKey?: string;
      }).systemKey,
      "engine-owned-regression",
      "raw replace preserves systemKey",
    );

    // (1) SEE: preset.sections lists every section with an id + content preview (the #4812 fix).
    const sections = (await mari.executeAction({ action: "preset.sections", presetId })).output as Array<{
      id: string;
      name: string;
      content: string;
      groupId: string | null;
    }>;
    assert.equal(sections.length, 2, "preset.sections lists every section");
    assert.ok(
      sections.every((section) => typeof section.id === "string" && section.id.length > 0),
      "each section row carries its id",
    );
    const intro = sections.find((section) => section.name === "Intro");
    const style = sections.find((section) => section.name === "Style");
    assert.ok(intro && style, "both seeded sections are present");
    assert.match(intro.content, /helpful assistant/, "the content preview is surfaced");
    assert.equal(await sectionContent(mari, intro.id), "You are a helpful assistant.", "getSection returns full content");

    const groups = (await mari.executeAction({ action: "preset.groups", presetId })).output as Array<{ id: string; name: string }>;
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.name, "Formatting");
    assert.equal(style.groupId, groups[0]?.id, "a grouped section reports its groupId");
    const choiceBlocks = (await mari.executeAction({ action: "preset.choiceBlocks", presetId })).output as Array<{
      id: string;
      variableName: string;
      optionCount: number;
    }>;
    assert.equal(choiceBlocks.length, 1);
    assert.equal(choiceBlocks[0]?.variableName, "POV");
    assert.equal(choiceBlocks[0]?.optionCount, 2);

    // (2) TARGETED EDIT: updateSection changes ONE section, routes through review, reverts on Restore.
    const beforeUpdate = new Set(mari.getPendingApprovals().map((approval) => approval.id));
    const updateResult = await mari.executeAction({
      action: "preset.updateSection",
      sectionId: intro.id,
      data: { content: "You are a terse assistant." },
      apply: true,
    });
    assert.equal(updateResult.approval?.status, "pending", "a section edit routes through the Keep/Restore review");
    const updateReview = mari.getPendingApprovals().find((approval) => !beforeUpdate.has(approval.id));
    assert.ok(updateReview);
    assert.equal(await sectionContent(mari, intro.id), "You are a terse assistant.", "the target section changed");
    assert.equal(await sectionContent(mari, style.id), "Write in a terse voice.", "other sections are untouched");
    await mari.restoreAppliedReview(updateReview.id);
    assert.equal(await sectionContent(mari, intro.id), "You are a helpful assistant.", "Restore reverts the section edit");

    // (3) ADD: addSection inserts a section AND appends its id to sectionOrder (else it is never assembled).
    const addResult = await mari.executeAction({
      action: "preset.addSection",
      presetId,
      data: { name: "Outro", content: "End politely." },
      apply: true,
    });
    assert.equal(addResult.approval?.status, "pending", "addSection routes through review");
    await drainKeep(mari);
    const afterAdd = (await mari.executeAction({ action: "preset.sections", presetId })).output as Array<{ id: string; name: string }>;
    assert.equal(afterAdd.length, 3, "the added section is present");
    const outro = afterAdd.find((section) => section.name === "Outro");
    const presetAfterAdd = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { sectionOrder: string[] };
    assert.ok(outro && presetAfterAdd.sectionOrder.includes(outro.id), "the added section id is appended to sectionOrder");

    // (4) DELETE section: removes the row AND prunes its id from sectionOrder — and Restore of that
    // two-change plan (section re-insert + sectionOrder revert) must put BOTH back.
    const orderBeforeDelete = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { sectionOrder: string[] };
    const beforeDelete = new Set(mari.getPendingApprovals().map((approval) => approval.id));
    await mari.executeAction({ action: "preset.deleteSection", sectionId: intro.id, apply: true });
    assert.equal((await mari.executeAction({ action: "preset.getSection", sectionId: intro.id })).ok, false, "the section is deleted");
    const presetAfterDelete = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { sectionOrder: string[] };
    assert.equal(presetAfterDelete.sectionOrder.includes(intro.id), false, "the deleted section id is pruned from sectionOrder");
    const deleteReview = mari.getPendingApprovals().find((approval) => !beforeDelete.has(approval.id));
    assert.ok(deleteReview, "the section deletion is reviewable");
    await mari.restoreAppliedReview(deleteReview.id);
    assert.equal((await mari.executeAction({ action: "preset.getSection", sectionId: intro.id })).ok, true, "Restore re-inserts the deleted section");
    const orderAfterRestore = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { sectionOrder: string[] };
    assert.deepEqual(orderAfterRestore.sectionOrder, orderBeforeDelete.sectionOrder, "Restore returns sectionOrder to its exact prior state (id back in its original position)");
    // Re-delete so the remaining checks observe the same end state as before.
    await mari.executeAction({ action: "preset.deleteSection", sectionId: intro.id, apply: true });
    await drainKeep(mari);

    // (5) DELETE group: orphans its member sections (kept, groupId -> null) and prunes it from groupOrder.
    await mari.executeAction({ action: "preset.deleteGroup", groupId: groups[0]!.id, apply: true });
    await drainKeep(mari);
    assert.equal((await mari.executeAction({ action: "preset.getGroup", groupId: groups[0]!.id })).ok, false, "the group is deleted");
    const presetAfterGroupDelete = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { groupOrder: string[] };
    assert.equal(presetAfterGroupDelete.groupOrder.includes(groups[0]!.id), false, "the deleted group id is pruned from groupOrder");
    const styleAfterGroupDelete = (await mari.executeAction({ action: "preset.getSection", sectionId: style.id })).output as {
      groupId: string | null;
    } | null;
    assert.ok(styleAfterGroupDelete, "the group's member section survives the group deletion");
    assert.equal(styleAfterGroupDelete.groupId, null, "the member section is orphaned, not deleted");

    // (5b) CLI PARITY: `mari presets` delegates to the same actions (a read + a write round-trip).
    const cliSections = await mari.executeCli({ argv: ["presets", "sections", presetId] });
    assert.equal(cliSections.ok, true, "`mari presets sections` returns via the CLI");
    assert.ok(Array.isArray(cliSections.output), "the CLI sections output is a list");
    const cliAdd = await mari.executeCli({
      argv: ["presets", "add-section", presetId, "--name", "CLI Section", "--content", "Added from the shell.", "--apply"],
    });
    assert.equal(cliAdd.approval?.status, "pending", "a CLI add-section applies through the same Keep/Restore review");
    await drainKeep(mari);
    const afterCli = (await mari.executeAction({ action: "preset.sections", presetId })).output as Array<{ name: string }>;
    assert.ok(
      afterCli.some((section) => section.name === "CLI Section"),
      "a section added via `mari presets add-section` is present",
    );

    // (5c) GROUP + CHOICE-BLOCK CRUD, plus the same-preset and cycle guards.
    const addedGroup = await mari.executeAction({ action: "preset.addGroup", presetId, data: { name: "Extra Group" }, apply: true });
    assert.equal(addedGroup.approval?.status, "pending", "addGroup routes through review");
    await drainKeep(mari);
    const groupsNow = (await mari.executeAction({ action: "preset.groups", presetId })).output as Array<{ id: string; name: string }>;
    const extraGroup = groupsNow.find((group) => group.name === "Extra Group");
    assert.ok(extraGroup, "addGroup created a group");
    const orderAfterAddGroup = (await mari.executeAction({ action: "preset.get", id: presetId })).output as { groupOrder: string[] };
    assert.ok(orderAfterAddGroup.groupOrder.includes(extraGroup.id), "the added group is appended to groupOrder");
    await mari.executeAction({ action: "preset.updateGroup", groupId: extraGroup.id, data: { name: "Renamed Group" }, apply: true });
    await drainKeep(mari);
    assert.equal(
      ((await mari.executeAction({ action: "preset.getGroup", groupId: extraGroup.id })).output as { name?: string } | null)?.name,
      "Renamed Group",
      "getGroup reflects an updateGroup rename",
    );
    const selfParent = await mari.executeAction({
      action: "preset.updateGroup",
      groupId: extraGroup.id,
      data: { parentGroupId: extraGroup.id },
      apply: true,
    });
    assert.equal(selfParent.ok, false, "a group cannot be its own parent");
    assert.match(String(selfParent.error ?? ""), /own parent|cycle/iu);
    // A multi-hop cycle must be rejected too: nest a child under extraGroup, then try to re-parent
    // extraGroup under that child (its own descendant). Neither group may change.
    await mari.executeAction({ action: "preset.addGroup", presetId, data: { name: "Child Group", parentGroupId: extraGroup.id }, apply: true });
    await drainKeep(mari);
    const childGroup = ((await mari.executeAction({ action: "preset.groups", presetId })).output as Array<{ id: string; name: string }>).find(
      (group) => group.name === "Child Group",
    );
    assert.ok(childGroup, "addGroup nested a child under extraGroup");
    const indirectCycle = await mari.executeAction({
      action: "preset.updateGroup",
      groupId: extraGroup.id,
      data: { parentGroupId: childGroup.id },
      apply: true,
    });
    assert.equal(indirectCycle.ok, false, "a group cannot be re-parented under its own descendant");
    assert.match(String(indirectCycle.error ?? ""), /cycle|own parent/iu);
    assert.equal(
      ((await mari.executeAction({ action: "preset.getGroup", groupId: childGroup.id })).output as { parentGroupId?: string | null } | null)
        ?.parentGroupId,
      extraGroup.id,
      "the rejected re-parent left the child's parent unchanged",
    );
    // Deleting a PARENT group un-nests (does not delete) its children: childGroup survives, parent -> null.
    await mari.executeAction({ action: "preset.deleteGroup", groupId: extraGroup.id, apply: true });
    await drainKeep(mari);
    assert.equal((await mari.executeAction({ action: "preset.getGroup", groupId: extraGroup.id })).ok, false, "the parent group is deleted");
    const childAfterParentDelete = (await mari.executeAction({ action: "preset.getGroup", groupId: childGroup.id })).output as {
      parentGroupId?: string | null;
    } | null;
    assert.ok(childAfterParentDelete, "the child group survives its parent's deletion");
    assert.equal(childAfterParentDelete.parentGroupId, null, "the child group is un-nested (parentGroupId -> null), not deleted");

    // A section can only join a group in its OWN preset.
    await mari.executeAction({ action: "preset.create", data: { name: "Other Preset", groups: [{ name: "Foreign" }] }, apply: true });
    await drainKeep(mari);
    const otherPresetId = ((await mari.executeAction({ action: "preset.list" })).output as Array<{ id: string; name: string }>).find(
      (preset) => preset.name === "Other Preset",
    )?.id;
    assert.ok(otherPresetId);
    const foreignGroup = ((await mari.executeAction({ action: "preset.groups", presetId: otherPresetId })).output as Array<{ id: string }>)[0];
    assert.ok(foreignGroup);
    const crossPreset = await mari.executeAction({ action: "preset.updateSection", sectionId: style.id, data: { groupId: foreignGroup.id }, apply: true });
    assert.equal(crossPreset.ok, false, "a section cannot be moved into a group from a different preset");
    assert.match(String(crossPreset.error ?? ""), /not a group in this section/iu);
    // The same cross-preset guard applies to the ADD paths, not only the update paths.
    const crossAddSection = await mari.executeAction({
      action: "preset.addSection",
      presetId,
      data: { name: "Foreign-filed", content: "x", groupId: foreignGroup.id },
      apply: true,
    });
    assert.equal(crossAddSection.ok, false, "addSection cannot file a new section under a group from a different preset");
    assert.match(String(crossAddSection.error ?? ""), /not a group in this preset/iu);
    const crossAddGroup = await mari.executeAction({
      action: "preset.addGroup",
      presetId,
      data: { name: "Foreign-parented", parentGroupId: foreignGroup.id },
      apply: true,
    });
    assert.equal(crossAddGroup.ok, false, "addGroup cannot nest a new group under a parent from a different preset");
    assert.match(String(crossAddGroup.error ?? ""), /not a group in this preset/iu);
    // The insert path rejects an invalid enum instead of silently coercing it (matching the patch path).
    const badRoleAdd = await mari.executeAction({
      action: "preset.addSection",
      presetId,
      data: { name: "Typo Role", content: "x", role: "sytem" },
      apply: true,
    });
    assert.equal(badRoleAdd.ok, false, "addSection rejects an unsupported role instead of coercing it to system");
    assert.match(String(badRoleAdd.error ?? ""), /role must be one of/iu);

    // Choice-block get / add / update (empty-options guard) / delete.
    assert.equal(
      ((await mari.executeAction({ action: "preset.getChoiceBlock", choiceBlockId: choiceBlocks[0]!.id })).output as { variableName?: string } | null)?.variableName,
      "POV",
      "getChoiceBlock returns the full block",
    );
    await mari.executeAction({
      action: "preset.addChoiceBlock",
      presetId,
      data: { variableName: "Tone", question: "Tone?", options: ["warm", "sharp"] },
      apply: true,
    });
    await drainKeep(mari);
    const tone = ((await mari.executeAction({ action: "preset.choiceBlocks", presetId })).output as Array<{ id: string; variableName: string }>).find(
      (block) => block.variableName === "Tone",
    );
    assert.ok(tone, "addChoiceBlock created a block");
    const emptyOptions = await mari.executeAction({ action: "preset.updateChoiceBlock", choiceBlockId: tone.id, data: { options: [] }, apply: true });
    assert.equal(emptyOptions.ok, false, "updateChoiceBlock refuses to empty a block's options");
    await mari.executeAction({ action: "preset.updateChoiceBlock", choiceBlockId: tone.id, data: { question: "What tone?" }, apply: true });
    await drainKeep(mari);
    assert.equal(
      ((await mari.executeAction({ action: "preset.getChoiceBlock", choiceBlockId: tone.id })).output as { question?: string } | null)?.question,
      "What tone?",
      "updateChoiceBlock changed the question",
    );
    await mari.executeAction({ action: "preset.deleteChoiceBlock", choiceBlockId: tone.id, apply: true });
    await drainKeep(mari);
    assert.equal((await mari.executeAction({ action: "preset.getChoiceBlock", choiceBlockId: tone.id })).ok, false, "deleteChoiceBlock removes the block");

    // (6) CLOBBER GUARD: a preset.create whose child section reuses an existing id is refused.
    const clobber = await mari.executeAction({
      action: "preset.create",
      data: { name: "Clobber", sections: [{ id: style.id, name: "Dupe", content: "x" }] },
      apply: true,
    });
    assert.equal(clobber.ok, false, "reusing an existing child-section id in a create is refused, not silently overwritten");
    assert.match(String(clobber.error ?? ""), /already exists/iu);
    // The guard must also catch a collision that lives only inside the plan (two children sharing an
    // id in one create): the committed-row lookup never sees it, so without the seen-set it would
    // pass a clean dry-run and abort late at apply.
    const dupeWithinPayload = await mari.executeAction({
      action: "preset.create",
      data: {
        name: "Dupe Within",
        sections: [
          { id: "shared-section-id", name: "A", content: "a" },
          { id: "shared-section-id", name: "B", content: "b" },
        ],
      },
      apply: true,
    });
    assert.equal(dupeWithinPayload.ok, false, "two children sharing one id in a single create are refused");
    assert.match(String(dupeWithinPayload.error ?? ""), /more than once|already exists/iu);
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Mari preset granular-edit regressions passed.");

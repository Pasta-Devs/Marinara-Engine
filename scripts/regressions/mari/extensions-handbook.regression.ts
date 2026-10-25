// #7827: the extensions handbook teaches a hash contract, and a wrong hash rule is worse than no
// handbook: it would tell Mari her edit is approved when the user must review it again, or the
// reverse. This executes the worked example against a temporary database and pins the three things
// the document claims: the create produces the documented hash, a description edit does not move it,
// and a css edit does.
import assert from "node:assert/strict";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { installedExtensions } from "../../../packages/server/src/db/schema/extensions.js";
import { withHandbook } from "./_handbook.js";

const PINNED_HASH = "sha256:677e787ceec71951f8e9fd14182ad7b3bc877b55cf0485b84948073de6242533";

await withHandbook("builtin-extensions", async ({ skill, commands, db, mari, run }) => {
  assert.equal(commands.length, 6, "the example is create, read, rename, read, restyle, read");
  assert.ok(skill.content.includes(PINNED_HASH), "the handbook quotes the pinned hash");

  const created = await run(0);
  assert.equal(created.ok, true, `personal_extension.create failed: ${String(created.error ?? "")}`);

  const drafted = await run(1);
  assert.equal(drafted.ok, true);
  assert.equal(drafted.output?.contentHash, PINNED_HASH, "the create produces the hash the handbook quotes");
  assert.equal(String(drafted.output?.enabled), "false", "a drafted extension starts disabled");
  assert.ok(
    drafted.output?.approvedHash == null || drafted.output.approvedHash === "",
    "nothing is approved before the user reviews it",
  );

  assert.equal((await run(2)).ok, true, "the description edit failed");

  const renamed = await run(3);
  assert.equal(renamed.output?.contentHash, PINNED_HASH, "changing the description does not move the hash");

  assert.equal((await run(4)).ok, true, "the css edit failed");

  const restyled = await run(5);
  assert.notEqual(restyled.output?.contentHash, PINNED_HASH, "changing css moves the hash and needs a new review");

  // An External Extension is refused, not adopted: an update would rewrite its source and keep its approval.
  const id = String(restyled.output?.id);
  await db.update(installedExtensions).set({ source: "external" }).where(eq(installedExtensions.id, id));
  const adopted = await mari.executeAction({ action: "personal_extension.update", id, name: "Renamed", apply: true });
  assert.equal(adopted.ok, false, "an external row cannot be edited through personal_extension.update");
  assert.match(String(adopted.error), /is an External Extension\. Nothing was changed/);
  assert.ok(
    skill.content.includes("is an External Extension. Nothing was changed."),
    "the handbook quotes the refusal",
  );

  // #8110: full_page_access is refused, not stored. A stored declaration hashed differently from what Settings
  // approves, and the startup trust check revoked each approval.
  const fullPage = /cannot request "full_page_access"; only External Extensions can\. Nothing was changed/;
  assert.ok(skill.content.includes(`cannot request "full_page_access"`), "the handbook quotes the full-page refusal");
  const rows = async (rowId: string) => db.select().from(installedExtensions).where(eq(installedExtensions.id, rowId));
  const fullPageCreate = await mari.executeAction({
    action: "personal_extension.create",
    id: "fpa",
    name: "FPA",
    runtime: "client",
    capabilities: ["full_page_access"],
    css: "body{}",
    apply: true,
  });
  assert.equal(fullPageCreate.ok, false, "a full_page_access draft is refused");
  assert.match(String(fullPageCreate.error), fullPage);
  assert.equal((await rows("fpa")).length, 0, "the refused create wrote nothing");

  const draftId = String(created.output?.id ?? drafted.output?.id);
  await db.update(installedExtensions).set({ source: "professor_mari" }).where(eq(installedExtensions.id, draftId));
  const [beforeEscalation] = await rows(draftId);
  const escalated = await mari.executeAction({
    action: "personal_extension.update",
    id: draftId,
    capabilities: ["full_page_access"],
    apply: true,
  });
  assert.equal(escalated.ok, false, "an update cannot add full_page_access");
  assert.match(String(escalated.error), fullPage);
  assert.equal(
    (await rows(draftId))[0]?.contentHash,
    beforeEscalation?.contentHash,
    "the refused update wrote nothing",
  );

  // A draft stored before the fix still carries the declaration: a metadata-only edit is refused until Mari resends
  // capabilities without it, and then her hash is the one Settings approves.
  await db
    .update(installedExtensions)
    .set({ capabilities: JSON.stringify(["full_page_access"]) })
    .where(eq(installedExtensions.id, draftId));
  const renamedStuck = await mari.executeAction({
    action: "personal_extension.update",
    id: draftId,
    name: "N",
    apply: true,
  });
  assert.equal(renamedStuck.ok, false, "a stored declaration must be removed before the draft is edited");
  assert.match(String(renamedStuck.error), fullPage);
  const repaired = await mari.executeAction({
    action: "personal_extension.update",
    id: draftId,
    capabilities: [],
    apply: true,
  });
  assert.equal(repaired.ok, true, `removing full_page_access failed: ${String(repaired.error ?? "")}`);
  const { createPersonalExtensionsStorage } =
    await import("../../../packages/server/src/services/extensions/personal-extension-storage.service.js");
  const settingsView = await createPersonalExtensionsStorage(db).getById(draftId);
  const mariView = await mari.executeAction({ action: "personal_extension.get", id: draftId });
  assert.equal(mariView.output?.contentHash, settingsView?.contentHash, "Mari reports the hash Settings approves");
});

console.log("Professor Mari extensions handbook regression passed.");

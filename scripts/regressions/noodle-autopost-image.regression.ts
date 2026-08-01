import assert from "node:assert/strict";
import {
  noodleAccountSchedulerPatchSchema,
  noodleAutoPostingSettingsSchema,
  noodleGeneratedNoodlerPostSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import { protectNoodlerGeneratedIdentity } from "../../packages/server/src/services/noodle/noodle-noodler-generation.service.js";
import {
  noodlerPostMediaUrl,
  readNoodlerMediaPath,
  resolveNoodlerMediaAbsolutePath,
} from "../../packages/server/src/services/noodle/noodle-noodler-media.js";

// NoodleR-owned image enablement is the single one-image policy on the autoPosting subtree.
const settings = noodleAutoPostingSettingsSchema.parse({ imagesEnabled: true });
assert.equal(settings.imagesEnabled, true);
assert.equal(noodleAutoPostingSettingsSchema.parse({}).imagesEnabled, false);
// The client patch carries only creator enablement and image preference.
assert.ok(noodleAccountSchedulerPatchSchema.parse({ autoPosting: { imagesEnabled: true } }));
// The removed per-run quota is rejected by the strict schema.
assert.throws(() => noodleAccountSchedulerPatchSchema.parse({ autoPosting: { maxImagesPerRun: 3 } }));

// The NoodleR generator surfaces its optional imagePrompt (no second text-model call) but
// never a poll.
const generated = noodleGeneratedNoodlerPostSchema.parse({
  title: "Studio day",
  content: "Behind the scenes.",
  imagePrompt: "a cozy studio corner",
  poll: null,
});
assert.equal(generated.imagePrompt, "a cozy studio corner");
assert.ok(!("poll" in generated));
assert.equal(noodleGeneratedNoodlerPostSchema.parse({ title: "x", content: "y" }).imagePrompt, null);

// Identity protection applies to the image prompt, not only post text.
const linked = { displayName: "Jane Doe", handle: "janedoe" };
assert.ok(!protectNoodlerGeneratedIdentity("portrait of @janedoe smiling", "secret", linked)!.includes("janedoe"));
assert.ok(!protectNoodlerGeneratedIdentity("portrait of Jane Doe smiling", "hinted", linked)!.includes("Jane Doe"));
// Open disclosure keeps the identity.
assert.ok(protectNoodlerGeneratedIdentity("portrait of @janedoe", "open", linked)!.includes("janedoe"));

// NoodleR media is only reachable through the access-checked endpoint namespace.
assert.equal(noodlerPostMediaUrl("post123"), "/api/noodle/noodler/posts/post123/media");
assert.equal(readNoodlerMediaPath({ metadata: { noodlerMediaPath: "noodler-media/acc/img.png" } }), "noodler-media/acc/img.png");
assert.equal(readNoodlerMediaPath({ metadata: { noodlerMediaPath: "some/other/img.png" } }), null);
assert.equal(readNoodlerMediaPath({ metadata: {} }), null);
// Traversal and non-namespaced paths never resolve to an on-disk file.
assert.equal(resolveNoodlerMediaAbsolutePath("noodler-media/../../etc/passwd"), null);
assert.equal(resolveNoodlerMediaAbsolutePath("gallery/chat/img.png"), null);
assert.ok(resolveNoodlerMediaAbsolutePath("noodler-media/acc/img.png")?.endsWith("noodler-media/acc/img.png"));

process.stdout.write("Noodle autopost image regression passed.\n");

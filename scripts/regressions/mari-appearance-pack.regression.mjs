import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  getMariAppearancePack,
  MARI_APPEARANCE_PACKS,
  MARI_ASSET_TIER,
  MARI_POSES,
  MARI_SPRITE_VERSION,
  MARI_STORY_STATES,
  mariAssetUrls,
  resolveMariRestStory,
  selectMariWorkAnimation,
} from "../../packages/client/src/lib/mari-work-animations.ts";

const pack = getMariAppearancePack("basic");
assert.equal(new Set(MARI_APPEARANCE_PACKS.map(({ id }) => id)).size, MARI_APPEARANCE_PACKS.length);
for (const state of MARI_STORY_STATES) {
  assert.equal(
    new Set(MARI_APPEARANCE_PACKS.map((appearance) => appearance.stories[state].src)).size,
    MARI_APPEARANCE_PACKS.length,
    "switching appearance must select a complete distinct story set",
  );
}
for (const stale of [undefined, null, "core", "expeditions", "removed-pack", {}, []]) {
  assert.equal(getMariAppearancePack(stale), pack, "old preferences must recover to a complete Basic pack");
}
const idle = { working: false, failed: false, cancelled: false, needsApproval: false, hasAppliedChanges: false };
assert.equal(resolveMariRestStory(idle), null, "ordinary replies must not claim applied changes");
assert.equal(resolveMariRestStory({ ...idle, hasAppliedChanges: true }), "success");
assert.equal(resolveMariRestStory({ ...idle, hasAppliedChanges: true, needsApproval: true }), "approval");
assert.equal(resolveMariRestStory({ ...idle, hasAppliedChanges: true, cancelled: true }), "cancelled");
assert.equal(resolveMariRestStory({ ...idle, hasAppliedChanges: true, failed: true }), "retry");
assert.equal(resolveMariRestStory({ ...idle, working: true, hasAppliedChanges: true }), null);

// M16: every URL is versioned and lives in its own pack's folder, so one pack never loads another's files.
const publicFile = (url) => new URL(`../../packages/client/public${url.split("?")[0]}`, import.meta.url);
for (const appearance of MARI_APPEARANCE_PACKS) {
  const urls = [
    ...Object.values(appearance.portraits),
    ...Object.values(appearance.stories).map(({ src }) => src),
    ...Object.values(appearance.poses),
  ];
  for (const url of urls) {
    assert.ok(url.startsWith(`/sprites/mari/${appearance.id}/`), `${url} must stay inside its pack folder`);
    assert.ok(url.endsWith(`?v=${MARI_SPRITE_VERSION}`), `${url} must carry the sprite version`);
  }
  for (const pose of MARI_POSES) assert.ok(readFileSync(publicFile(appearance.poses[pose])).length);
  const prefetch = mariAssetUrls(appearance, 2);
  const preload = mariAssetUrls(appearance, 1);
  assert.deepEqual(
    preload.sort(),
    [appearance.poses.profile, appearance.poses.greet].sort(),
    "tier 1 is first paint only",
  );
  assert.ok(prefetch.length > 0 && prefetch.every((url) => urls.includes(url)), "prefetch only the selected pack");
  assert.ok(!prefetch.some((url) => preload.includes(url)), "the idle prefetch never repeats the startup preload");
  assert.ok(!prefetch.includes(appearance.stories.research.src), "tier 3 stories are never prefetched");
  assert.ok(!prefetch.includes(appearance.poses.wave), "tier 3 poses are never prefetched");
}
for (const [group, keys] of [
  ["stories", MARI_STORY_STATES],
  ["poses", MARI_POSES],
  ["portraits", Object.keys(pack.portraits)],
]) {
  assert.deepEqual(Object.keys(MARI_ASSET_TIER[group]).sort(), [...keys].sort(), `every ${group} slot has one tier`);
}

const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const sharp = require("sharp");
for (const appearance of MARI_APPEARANCE_PACKS) {
  assert.equal(getMariAppearancePack(appearance.id), appearance, "registered packs must resolve without fallback");
  for (const url of Object.values(appearance.portraits)) {
    assert.ok(readFileSync(publicFile(url)).length);
  }
  // P5: the Home Mari widget draws the greet pose at exactly 1x with fixed 106x192 width/height.
  const greet = await sharp(publicFile(appearance.poses.greet).pathname).metadata();
  assert.deepEqual([greet.width, greet.height], [106, 192], `${appearance.id} greet pose must stay 106x192`);
  // 45b: six 96 px pull heads at native size; the circle crops them in CSS.
  const heads = await sharp(publicFile(appearance.portraits.pullHeads).pathname).metadata();
  assert.deepEqual([heads.format, heads.width, heads.height, heads.hasAlpha], ["webp", 576, 96, true]);
  assert.ok(mariAssetUrls(appearance, 2).includes(appearance.portraits.pullHeads), "the pull heads are prefetched");
  // Slice 85: every pack holds its own four-frame dangle sheet (4 cells of 300x450), never a shared idle story.
  assert.equal(
    appearance.portraits.drag,
    `/sprites/mari/${appearance.id}/portrait-drag.webp?v=${MARI_SPRITE_VERSION}`,
    "held sheet is per pack",
  );
  const held = await sharp(publicFile(appearance.portraits.drag).pathname).metadata();
  assert.deepEqual([held.format, held.width, held.height, held.hasAlpha], ["webp", 1200, 450, true]);
  // Slice 85 hover: the approved hover portrait is the idle portrait's size, so the swap moves nothing.
  const idle = await sharp(publicFile(appearance.portraits.idle).pathname).metadata();
  const hover = await sharp(publicFile(appearance.portraits.hover).pathname).metadata();
  assert.deepEqual(
    [hover.format, hover.width, hover.height],
    [idle.format, idle.width, idle.height],
    `${appearance.id} hover matches idle`,
  );
  // The held sheet, the hover and the live line's thinking sheet are fetched before first use.
  const warm = mariAssetUrls(appearance, 2);
  for (const url of [appearance.portraits.hover, appearance.portraits.drag, appearance.stories.thinking.src])
    assert.ok(warm.includes(url), `${appearance.id} prefetches ${url}`);
  for (const state of MARI_STORY_STATES) {
    const chosen = selectMariWorkAnimation({
      activity: "error image write",
      toolNames: ["bash"],
      packId: appearance.id,
      state,
    });
    assert.equal(chosen, appearance.stories[state], "explicit state must beat tool keywords");
    const image = sharp(publicFile(chosen.src).pathname);
    const metadata = await image.metadata();
    assert.equal(metadata.width, 512, "four equal cells");
    assert.equal(metadata.height, 192, "consistent scale across stories");
    assert.equal(metadata.hasAlpha, true);
    assert.equal((await image.stats()).isOpaque, false, "sprite must have real alpha");
  }
}
for (const [name, state] of [
  ["read", "research"],
  ["edit", "editing"],
  ["debug", "debugging"],
  ["image", "images"],
  ["plan", "planning"],
  ["bash", "waiting"],
]) {
  assert.equal(selectMariWorkAnimation({ activity: "", toolNames: [name], packId: "stale" }).id, state);
}
console.info(
  "Mari appearance pack: fallback, lifecycle outcomes, activity selection, per-pack isolation, loading tiers and all sprite assets passed.",
);

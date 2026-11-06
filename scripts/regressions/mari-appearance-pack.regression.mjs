import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  getMariAppearancePack,
  MARI_APPEARANCE_PACKS,
  MARI_ASSET_TIER,
  MARI_POSES,
  MARI_SPRITE_VERSION,
  MARI_STORY_STATES,
  mariAssetUrls,
  mariSeasonKey,
  resolveMariAppearancePack,
  resolveMariRestStory,
  selectMariWorkAnimation,
  visibleMariAppearancePacks,
} from "../../packages/client/src/lib/mari-work-animations.ts";
import { SEASONAL_THEMES, seasonalThemeFor, seasonYear } from "../../packages/client/src/lib/seasonal-themes.ts";

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
  for (const pose of MARI_POSES) {
      assert.ok(readFileSync(publicFile(appearance.poses[pose])).length);
  }
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
  for (const url of Object.values(appearance.portraits)) assert.ok(readFileSync(publicFile(url)).length);
  // P5: the Home Mari widget draws the greet pose at exactly 1x with fixed 106x192 width/height.
  const greet = await sharp(fileURLToPath(publicFile(appearance.poses.greet))).metadata();
  assert.deepEqual([greet.width, greet.height], [106, 192], `${appearance.id} greet pose must stay 106x192`);
  // 45b: six 96 px pull heads at native size; the circle crops them in CSS.
  const heads = await sharp(fileURLToPath(publicFile(appearance.portraits.pullHeads))).metadata();
  assert.deepEqual([heads.format, heads.width, heads.height, heads.hasAlpha], ["webp", 576, 96, true]);
  assert.ok(mariAssetUrls(appearance, 2).includes(appearance.portraits.pullHeads), "the pull heads are prefetched");
  // Slice 85: every pack holds its own four-frame dangle sheet (4 cells of 300x450), never a shared idle story.
  assert.equal(
    appearance.portraits.drag,
    `/sprites/mari/${appearance.id}/portrait-drag.webp?v=${MARI_SPRITE_VERSION}`,
    "held sheet is per pack",
  );
  const held = await sharp(fileURLToPath(publicFile(appearance.portraits.drag))).metadata();
  assert.deepEqual([held.format, held.width, held.height, held.hasAlpha], ["webp", 1200, 450, true]);
  // Slice 85 hover: the approved hover portrait is the idle portrait's size, so the swap moves nothing.
  const idle = await sharp(fileURLToPath(publicFile(appearance.portraits.idle))).metadata();
  const hover = await sharp(fileURLToPath(publicFile(appearance.portraits.hover))).metadata();
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
    const image = sharp(fileURLToPath(publicFile(chosen.src)));
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
// Dated packs follow their seasonal theme by the theme's own decision (`seasonalThemeFor`): its window, Settings →
// Disable seasonal ME themes, this year's greeting "Turn it off" and the `?seasonalPreview=` page. A pick of another
// pack while it is worn wins for that year only. The user's own pick is never overwritten.
const settings = {
  seasonalThemesDisabled: false,
  seasonalGreetingYears: {},
  seasonalThemeOffYears: {},
  seasonalPreview: null,
};
const worn = (now, changed = {}) => seasonalThemeFor({ ...settings, ...changed }, now).themeId;
const shown = (storedId, now, { optOut = "", changed } = {}) =>
  resolveMariAppearancePack(storedId, [], null, optOut, worn(now, changed), now).id;
const listed = (now, changed) => visibleMariAppearancePacks(worn(now, changed)).map(({ id }) => id);
const at = (iso) => new Date(iso);
const day = (iso) => at(`${iso}T12:00:00`);
assert.equal(getMariAppearancePack("raccoon").season, "halloween", "the raccoon pack belongs to Halloween");
for (const [id, season] of [
  ["party", "newyearseve"],
  ["hungover", "newyearsday"],
]) {
  const appearance = getMariAppearancePack(id);
  assert.equal(appearance.season, season, `${id} belongs to ${season}`);
  assert.ok(MARI_APPEARANCE_PACKS.includes(appearance), `${id} is listed`);
  for (const url of [
    ...Object.values(appearance.portraits),
    ...Object.values(appearance.stories).map(({ src }) => src),
    ...Object.values(appearance.poses),
  ]) {
    assert.ok(url.startsWith(`/sprites/mari/${id}/`), `${id} points to its own folder`);
  }
}
// Minute by minute at both ends, and hour by hour around them, the costume is on exactly when the theme is.
const halloween = SEASONAL_THEMES.find(({ id }) => id === "halloween");
const moments = ["2026-10-29T23:59:00", "2026-10-30T00:00:00", "2026-11-01T11:59:00", "2026-11-01T12:00:00"].map(at);
for (let hour = 0; hour < 24 * 7; hour += 1) moments.push(new Date(2026, 9, 27, hour, 30));
for (const now of moments) {
  const on = halloween.isActive(now);
  assert.equal(shown("safari", now) === "raccoon", on, `${now.toString()}: raccoon follows Halloween`);
  assert.equal(listed(now).includes("raccoon"), on, `${now.toString()}: the chooser follows Halloween`);
}
assert.ok(
  !listed(at("2026-10-29T23:59:00")).includes("raccoon") && !listed(at("2026-11-01T12:00:00")).includes("raccoon"),
);
assert.ok(
  listed(at("2026-10-30T00:00:00")).includes("raccoon") && listed(at("2026-11-01T11:59:00")).includes("raccoon"),
);
assert.equal(shown("safari", day("2026-10-31")), "raccoon");
assert.equal(shown("safari", day("2026-10-31"), { optOut: "raccoon-2026" }), "safari");
assert.equal(shown("safari", day("2027-10-31"), { optOut: "raccoon-2026" }), "raccoon");
assert.equal(shown("safari", day("2026-11-02")), "safari");
assert.equal(shown("raccoon", day("2026-06-15")), "basic");
assert.equal(shown("golden", day("2026-10-30")), "raccoon");
// Settings → Disable seasonal ME themes: dated packs neither show by themselves nor appear in the chooser.
const toggledOff = { seasonalThemesDisabled: true };
assert.equal(shown("safari", day("2026-10-31"), { changed: toggledOff }), "safari");
assert.equal(shown("raccoon", day("2026-10-31"), { changed: toggledOff }), "basic");
assert.ok(!listed(day("2026-10-31"), toggledOff).includes("raccoon"));
// The greeting's "Turn it off" takes the costume off with the theme, for that year's Halloween only.
const turnedOff = { seasonalThemeOffYears: { halloween: 2026 } };
assert.equal(shown("safari", day("2026-10-31"), { changed: turnedOff }), "safari");
assert.equal(shown("raccoon", day("2026-10-31"), { changed: turnedOff }), "basic");
assert.ok(!listed(day("2026-10-31"), turnedOff).includes("raccoon"));
assert.equal(shown("safari", day("2027-10-31"), { changed: turnedOff }), "raccoon", "back on next Halloween");
// `?seasonalPreview=halloween` dresses her on any date, even with the toggle on or this year turned off; the
// preview's own "Turn it off" undresses her, and the real records stay out of it.
const preview = (records = {}) => ({
  seasonalPreview: { themeId: "halloween", greeted: {}, turnedOff: {}, ...records },
});
for (const changed of [preview(), { ...toggledOff, ...preview() }, { ...turnedOff, ...preview() }]) {
  assert.equal(shown("safari", day("2026-03-05"), { changed }), "raccoon", "the preview shows the costume");
  assert.ok(listed(day("2026-03-05"), changed).includes("raccoon"), "the preview lists the costume");
}
const previewOff = preview({ turnedOff: { halloween: 2026 } });
assert.equal(shown("safari", day("2026-03-05"), { changed: previewOff }), "safari");
assert.ok(!listed(day("2026-03-05"), previewOff).includes("raccoon"));

console.info(
  "Mari appearance pack: fallback, lifecycle outcomes, activity selection, per-pack isolation, loading tiers and all sprite assets passed.",
);

// The party runs past midnight: its opt-out key keeps the December year, the same year the theme uses.
const afterMidnight = new Date(2027, 0, 1, 1, 0);
assert.equal(mariSeasonKey(getMariAppearancePack("party"), afterMidnight), `party-${seasonYear("newyearseve", afterMidnight)}`);
assert.equal(mariSeasonKey(getMariAppearancePack("party"), afterMidnight), "party-2026");
assert.equal(mariSeasonKey(getMariAppearancePack("hungover"), afterMidnight), "hungover-2027");

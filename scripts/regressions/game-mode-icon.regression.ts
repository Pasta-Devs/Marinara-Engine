import assert from "node:assert/strict";
import { parseCombatIconChoice, resolveCombatIconUrl } from "../../packages/shared/src/utils/combat-icon.js";

// The Game Mode Icon picks what a fight token draws: the avatar (the default), a picture
// from the card's own gallery, or the initials.
const avatar = "/api/avatars/file/character-abc-1.png";
const galleryUrl = "/api/characters/abc/gallery/file/img_1.png";
const personaGalleryUrl = "/api/characters/personas/p_1/gallery/file/img%202.webp";

// No choice, or the avatar choice, draws the avatar; with no avatar the token keeps its initials.
assert.equal(resolveCombatIconUrl(undefined, avatar), avatar);
assert.equal(resolveCombatIconUrl({ source: "avatar" }, avatar), avatar);
assert.equal(resolveCombatIconUrl(undefined, null), null);
assert.equal(resolveCombatIconUrl(undefined, "   "), null);

// Initials win over an avatar.
assert.equal(resolveCombatIconUrl({ source: "initials" }, avatar), null);

// A gallery picture of a character or a persona is drawn instead of the avatar.
assert.equal(resolveCombatIconUrl({ source: "image", imageId: "img_1", url: galleryUrl }, avatar), galleryUrl);
assert.equal(
  resolveCombatIconUrl({ source: "image", imageId: "img_2", url: personaGalleryUrl }, null),
  personaGalleryUrl,
);

// Anything that is not a picture in the app's own galleries is ignored, and the avatar is used.
for (const url of [
  "https://example.com/tracker.png",
  "//example.com/a.png",
  "data:image/png;base64,AAAA",
  "/api/avatars/file/other.png",
  "/api/characters/abc/gallery/file/../../secret",
  "/api/characters/abc/gallery/file/a.png?x=1",
  "/api/characters/a/b/gallery/file/a.png",
]) {
  assert.equal(parseCombatIconChoice({ source: "image", imageId: "x", url }), null, url);
  assert.equal(resolveCombatIconUrl({ source: "image", imageId: "x", url }, avatar), avatar, url);
}
assert.equal(parseCombatIconChoice({ source: "image", imageId: "", url: galleryUrl }), null);
assert.equal(parseCombatIconChoice({ source: "image", url: galleryUrl }), null);
assert.equal(parseCombatIconChoice({ source: "emoji" }), null);
assert.equal(parseCombatIconChoice("initials"), null);
assert.equal(parseCombatIconChoice([]), null);

// Extra keys on a stored choice are dropped.
assert.deepEqual(parseCombatIconChoice({ source: "initials", url: galleryUrl }), { source: "initials" });

console.log("game-mode-icon regression passed");

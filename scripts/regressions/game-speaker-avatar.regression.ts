import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addUniqueLibrarySpeakerAvatars } from "../../packages/client/src/components/game/game-speaker-avatar";

const target = new Map<
  string,
  { url: string; crop?: { srcX: number; srcY: number; srcWidth: number; srcHeight: number } | null }
>();
target.set("explicit speaker", { url: "/explicit.png", crop: null });
// The production parser and visibility gate supply this already-resolved set.
// This regression verifies the avatar resolver after that boundary.
const renderedSpeakers = new Set(["Missing From Scene", "Explicit Speaker", "Tracked NPC", "Player"]);
addUniqueLibrarySpeakerAvatars(
  target,
  renderedSpeakers,
  [
    { name: "Explicit Speaker", avatarUrl: "/library-overridden.png" },
    {
      name: "Missing From Scene",
      avatarUrl: "/library.png",
      avatarCrop: { srcX: 0.2, srcY: 0.3, srcWidth: 0.5, srcHeight: 0.5 },
    },
    { name: "Mentioned Only", avatarUrl: "/mentioned.png" },
    { name: "Tracked NPC", avatarUrl: "/npc-library.png" },
    { name: "Player", avatarUrl: "/unrelated-player.png" },
  ],
  ["Tracked NPC", "Player"],
);
assert.equal(target.get("explicit speaker")?.url, "/explicit.png", "explicit portraits keep precedence");
assert.equal(target.get("missing from scene")?.url, "/library.png", "rendered absent-scene speakers resolve");
assert.deepEqual(
  target.get("missing from scene")?.crop,
  { srcX: 0.2, srcY: 0.3, srcWidth: 0.5, srcHeight: 0.5 },
  "library crop follows portrait",
);
assert.equal(target.has("mentioned only"), false, "speakers outside the supplied rendered set are never added");
assert.equal(target.has("tracked npc"), false, "tracked NPC portraits keep precedence");
assert.equal(target.has("player"), false, "the player persona does not borrow a library portrait");

const ambiguous = new Map<string, { url: string }>();
addUniqueLibrarySpeakerAvatars(
  ambiguous,
  ["Twin Name"],
  [
    { name: "Twin Name", avatarUrl: "/one.png" },
    { name: "Twin Name", avatarUrl: null },
  ],
);
assert.equal(ambiguous.size, 0, "ambiguous library names remain unresolved");

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const surfaceSource = readFileSync(join(repositoryRoot, "packages/client/src/components/game/GameSurface.tsx"), "utf8");
assert.match(
  surfaceSource,
  /parseNarrationSegments\(message, new Map\(\)\)/u,
  "caller wiring uses the production parser",
);
assert.match(
  surfaceSource,
  /message\.role !== "assistant" \|\| !isVisibleGameMessage\(message\)/u,
  "caller wiring includes visibility filtering",
);

console.log("game-speaker-avatar regression passed");

/**
 * The avatar stage and setup decisions (base lane, #7537):
 *   - a chat shows an owner's active kind when its agent is on, else falls back pngtuber → mesh-avatar → vrm;
 *   - the cast is uncapped, with the budget's frame rates and pixel-ratio caps; in the
 *     one shared loop only the speaking avatar draws at the talking rate, every other one at the idle rate,
 *     and a phone is under load when one draw of every avatar is slow, whichever avatars share a tick;
 *   - the owner's lip sync, blink and idle-motion switches (and reduced motion) shape every frame;
 *   - PNGTuber pictures resolve to stored files or the owner's sprites, expression sprites first;
 *   - expression sprites can preview a PNGTuber setup, but only a saved, enabled setup shows in chats;
 *   - the setup page leaves importing, removing, sprites and faces to the kind panels;
 *   - the chat surfaces load the stage lazily, only for avatar agents the chat turned on, and create the
 *     director only once an avatar shows.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AVATAR_NEUTRAL_FRAME,
  avatarConfigSchema,
  createAvatarConfig,
  type AvatarOwnerSummary,
} from "../../packages/shared/src/index.ts";
import {
  applyAvatarFeatures,
  avatarDevicePixelRatio,
  avatarDrawDue,
  avatarsUnderLoad,
  avatarTargetFps,
  chatAvatarAgentIds,
  chatAvatarParticipants,
  pickAvatarKind,
  recordAvatarDrawCost,
  resolveAvatarImage,
  selectStageAvatars,
  withSpriteAvatar,
  type AvatarDrawClock,
} from "../../packages/client/src/features/avatars/stage/avatar-stage-logic.ts";
import { avatarAgentKinds } from "../../packages/client/src/features/avatars/setup/avatar-setup-logic.ts";
import { buildPngtuberLayersFromSprites } from "../../packages/client/src/features/avatars/renderers/pngtuber/pngtuber-layers.ts";

const client = (path: string) => readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");

// ── Which kind shows ──
assert.equal(pickAvatarKind({ activeKind: "vrm", kinds: ["pngtuber", "vrm"] }, ["2d-avatars", "3d-avatars"]), "vrm");
assert.equal(
  pickAvatarKind({ activeKind: "vrm", kinds: ["pngtuber", "vrm"] }, ["2d-avatars"]),
  "pngtuber",
  "the 3D agent is off, so the set-up 2D kind shows",
);
assert.equal(pickAvatarKind({ activeKind: "pngtuber", kinds: ["pngtuber", "vrm"] }, ["3d-avatars"]), "vrm");
assert.equal(
  pickAvatarKind({ activeKind: null, kinds: ["vrm", "mesh-avatar"] }, ["2d-avatars", "3d-avatars"]),
  "mesh-avatar",
);
assert.equal(pickAvatarKind({ activeKind: "vrm", kinds: ["vrm"] }, ["2d-avatars"]), null, "nothing can show");

// ── Only configured, enabled owners show, without a cast limit ──
const summary = (ownerId: string, kinds: AvatarOwnerSummary["kinds"], enabled = true): AvatarOwnerSummary => ({
  owner: { ownerType: "character", ownerId },
  enabled,
  activeKind: kinds[0] ?? null,
  kinds,
  updatedAt: "2026-10-13T00:00:00.000Z",
});
const participants = ["a", "b", "c", "d", "e", "f", "off", "empty", "unsaved"].map((ownerId) => ({
  owner: { ownerType: "character" as const, ownerId },
  name: ownerId.toUpperCase(),
}));
const summaries = [
  summary("a", ["pngtuber"]),
  summary("b", ["vrm"]),
  summary("c", ["mesh-avatar"]),
  summary("d", ["pngtuber"]),
  summary("e", ["pngtuber"]),
  summary("f", ["pngtuber"]),
  summary("off", ["pngtuber"], false),
  summary("empty", []),
];
assert.deepEqual(
  selectStageAvatars(participants, summaries, ["2d-avatars", "3d-avatars"]).map((avatar) => [
    avatar.participant.owner.ownerId,
    avatar.kind,
    avatar.index,
  ]),
  [
    ["a", "pngtuber", 0],
    ["b", "vrm", 1],
    ["c", "mesh-avatar", 2],
    ["d", "pngtuber", 3],
    ["e", "pngtuber", 4],
    ["f", "pngtuber", 5],
  ],
  "all configured, enabled avatars show, including beyond the old phone and desktop limits",
);
assert.deepEqual(
  selectStageAvatars(participants, summaries, ["2d-avatars"]).map((avatar) => avatar.participant.owner.ownerId),
  ["a", "c", "d", "e", "f"],
  "no disabled, empty, unsaved or 3D-only owner enters the 2D cast",
);
assert.deepEqual(selectStageAvatars(participants, summaries, []), [], "no avatar agent, no avatars");
assert.equal(selectStageAvatars([participants[0]!, participants[0]!], summaries, ["2d-avatars"]).length, 1);
assert.deepEqual(selectStageAvatars(participants, undefined, ["2d-avatars"]), [], "wait for summaries");
assert.deepEqual(selectStageAvatars(participants, [], ["2d-avatars"]), [], "no saved setups, no cast");
assert.doesNotMatch(client("features/avatars/contract.ts"), /maxVisible/u, "no device-specific cast limit");

// ── Budget ──
assert.equal(avatarTargetFps({ talking: true, phone: true, underLoad: true }), 30);
assert.equal(avatarTargetFps({ talking: false, phone: false, underLoad: false }), 30);
assert.equal(avatarTargetFps({ talking: false, phone: true, underLoad: false }), 20);
assert.equal(avatarTargetFps({ talking: false, phone: true, underLoad: true }), 15);
// One shared 60 Hz loop, one clock per avatar: the speaking avatar draws at the talking rate while every other
// avatar stays at the idle rate.
const drawsPerSecond = (budget: { phone: boolean; underLoad: boolean }) => {
  const clocks: AvatarDrawClock[] = [
    { lastDrawMs: 0, talking: true, costMs: 0 },
    { lastDrawMs: 0, talking: false, costMs: 0 },
  ];
  const draws = [0, 0];
  for (let tick = 1; tick <= 180; tick += 1) {
    const now = (tick * 1000) / 60;
    clocks.forEach((clock, index) => {
      if (!avatarDrawDue(clock, now, budget)) return;
      clock.lastDrawMs = now;
      draws[index]! += 1;
    });
  }
  return draws.map((count) => count / 3);
};
assert.deepEqual(drawsPerSecond({ phone: true, underLoad: false }), [30, 20], "a phone's quiet avatar stays at 20");
assert.deepEqual(drawsPerSecond({ phone: true, underLoad: true }), [30, 15], "and drops to 15 under load");
assert.deepEqual(drawsPerSecond({ phone: false, underLoad: false }), [30, 30], "desktops idle at 30");
assert.match(
  client("features/avatars/stage/AvatarStage.tsx"),
  /for \(const \[ownerId, slot\] of slots\) \{[\s\S]{0,240}if \(!avatarDrawDue\(clock, now, \{ phone, underLoad \}\)\) continue;/u,
  "the stage's one loop asks each avatar's own clock",
);
// Load is one draw of every avatar, however the clocks fall into phase. A phone with two avatars that take 8 ms
// each to draw is under load before, during and after a line: once the speaker's clock drifts away from the
// quiet one, each tick draws only one avatar, which must not read as "no longer under load".
const loadedPhone = (drawMs: number) => {
  const clocks: AvatarDrawClock[] = [
    { lastDrawMs: 0, talking: false, costMs: 0 },
    { lastDrawMs: 0, talking: false, costMs: 0 },
  ];
  const draws: number[][] = [];
  let underLoad = false;
  for (let tick = 1; tick <= 60 * 15; tick += 1) {
    const now = (tick * 1000) / 60;
    const second = Math.floor((tick - 1) / 60);
    let drew = false;
    clocks.forEach((clock, index) => {
      if (!avatarDrawDue(clock, now, { phone: true, underLoad })) return;
      clock.lastDrawMs = now;
      clock.talking = index === 0 && second >= 5 && second < 8;
      recordAvatarDrawCost(clock, drawMs + (tick % 7) / 10);
      (draws[second] ??= [0, 0])[index]! += 1;
      drew = true;
    });
    if (drew) underLoad = avatarsUnderLoad(clocks, true);
  }
  return draws;
};
const loaded = loadedPhone(8);
assert.deepEqual(loaded[4], [15, 15], "both quiet avatars idle at 15 on a loaded phone");
assert.equal(loaded[7]![1], 15, "the quiet avatar stays at 15 while the other one talks");
assert.ok(loaded[7]![0]! >= 29, `the speaker draws at the talking rate (${loaded[7]![0]})`);
for (const second of [10, 12, 14]) {
  assert.deepEqual(loaded[second], [15, 15], `still under load ${second - 8} s after the line`);
}
assert.deepEqual(loadedPhone(5)[14], [20, 20], "a phone that keeps up idles at 20");
assert.equal(avatarsUnderLoad([{ lastDrawMs: 0, talking: false, costMs: 20 }], false), false, "desktops never");
assert.match(
  client("features/avatars/stage/AvatarStage.tsx"),
  /recordAvatarDrawCost\(clock, performance\.now\(\) - started\);[\s\S]{0,120}if \(drew\) underLoad = avatarsUnderLoad\(clocks\.values\(\), phone\);/u,
  "the stage measures each avatar's own draw and adds them up",
);
assert.equal(avatarDevicePixelRatio(3, true), 1.5);
assert.equal(avatarDevicePixelRatio(3, false), 2);
assert.equal(avatarDevicePixelRatio(1, false), 1);
assert.equal(avatarDevicePixelRatio(Number.NaN, false), 1);

// ── Switches shape frames ──
const talking = { ...AVATAR_NEUTRAL_FRAME, viseme: "aa" as const, mouthOpen: 0.8, state: "talking" as const };
const allOn = { lipSync: true, blink: true, idleMotion: true };
assert.deepEqual(applyAvatarFeatures(talking, allOn, false), talking);
assert.deepEqual(applyAvatarFeatures(talking, { ...allOn, lipSync: false }, false), {
  ...talking,
  viseme: null,
  mouthOpen: 0,
});
assert.equal(applyAvatarFeatures(talking, { ...allOn, blink: false }, false).blink, 0, "eyes stay open");
const thinking = { ...AVATAR_NEUTRAL_FRAME, state: "thinking" as const };
assert.equal(applyAvatarFeatures(thinking, { ...allOn, idleMotion: false }, false).state, "idle");
assert.equal(applyAvatarFeatures(thinking, allOn, true).state, "idle", "reduced motion drops the poses");
assert.equal(applyAvatarFeatures(talking, allOn, true).state, "talking", "but still talks");

// ── PNGTuber pictures ──
const owner = { ownerType: "persona" as const, ownerId: "p1" };
const sprites = [
  { expression: "full_happy", url: "/api/sprites/p1/file/full_happy.png?v=1" },
  { expression: "Happy", url: "/api/sprites/p1/file/Happy.png?v=2" },
  { expression: "Mad face", url: "/api/sprites/p1/file/Mad%20face.webp?v=3" },
  { expression: "shy", url: "/api/sprites/p1/file/shy.svg?v=4" },
];
assert.equal(
  resolveAvatarImage(owner, { updatedAt: "2026-10-13T00:00:00.000Z" }, sprites, { source: "sprite", label: "happy" }),
  "/api/sprites/p1/file/Happy.png?v=2",
  "an expression sprite wins over a full-body one, shown as the sprite itself with its version",
);
assert.equal(
  resolveAvatarImage(owner, { updatedAt: "x" }, sprites, { source: "sprite", label: "mad_face" }),
  "/api/sprites/p1/file/Mad%20face.webp?v=3",
  "a sprite is found by its own name and shown as it is, never as a cut-out",
);
assert.equal(
  resolveAvatarImage(owner, { updatedAt: "x" }, sprites, { source: "sprite", label: "shy" }),
  "/api/sprites/p1/file/shy.svg?v=4",
  "an SVG sprite shows as it is",
);
assert.equal(resolveAvatarImage(owner, { updatedAt: "x" }, sprites, { source: "sprite", label: "sad" }), null);
assert.equal(
  resolveAvatarImage(owner, { updatedAt: "2026-10-13T00:00:00.000Z" }, undefined, {
    source: "file",
    path: "pngtuber/a.png",
  }),
  "/api/avatar-models/persona/p1/files/pngtuber/a.png?v=2026-10-13T00%3A00%3A00.000Z",
);

// ── The setup page and the stage share the 2D lane's sprite rule ──
assert.deepEqual(avatarAgentKinds("2d-avatars"), ["pngtuber", "mesh-avatar"]);
assert.deepEqual(avatarAgentKinds("3d-avatars"), ["vrm", "mmd"]);
const fromSprites = buildPngtuberLayersFromSprites(
  ["neutral", "neutral_talk", "happy", "happy_talk", "crying", "full_idle"].map((expression) => ({ expression })),
);
assert.ok(fromSprites);
assert.deepEqual(Object.keys(fromSprites.layers).sort(), ["crying", "happy", "neutral"], "talk sprites are no face");
assert.deepEqual(fromSprites.layers.happy?.mouthOpen, { source: "sprite", label: "happy_talk" }, "they open the mouth");
assert.equal(fromSprites.expressionMap.sad?.target, "crying");
const spriteAvatar = withSpriteAvatar(owner, null, fromSprites);
assert.ok(spriteAvatar);
assert.deepEqual([spriteAvatar.enabled, spriteAvatar.activeKind], [false, null]);
assert.equal(spriteAvatar.kinds.pngtuber, fromSprites);
assert.ok(avatarConfigSchema.safeParse(spriteAvatar).success, "the sprite avatar is a valid avatar.json");
assert.equal(withSpriteAvatar(owner, spriteAvatar, fromSprites), spriteAvatar, "the same object, so nothing remounts");
const turnedOff = { ...createAvatarConfig(owner, "2026-10-13T00:00:00.000Z"), enabled: false };
assert.equal(withSpriteAvatar(owner, turnedOff, fromSprites)?.enabled, false, "turning it off still applies");
const otherSprites = buildPngtuberLayersFromSprites([{ expression: "sad" }]);
assert.equal(withSpriteAvatar(owner, spriteAvatar, otherSprites), spriteAvatar, "a saved PNGTuber setup wins");
assert.equal(withSpriteAvatar(owner, null, null), null, "no sprites, no avatar");

// ── Chat surfaces ──
const characterMap = new Map([
  ["c1", { name: "Ava" }],
  ["c2", { name: "Bo" }],
]);
assert.deepEqual(
  chatAvatarParticipants(["c1", "missing", "c2"], characterMap, { id: "p1", name: "Mari" }).map((participant) => [
    participant.owner.ownerType,
    participant.owner.ownerId,
    participant.name,
  ]),
  [
    ["character", "c1", "Ava"],
    ["character", "c2", "Bo"],
    ["persona", "p1", "Mari"],
  ],
);
assert.equal(
  chatAvatarParticipants([], characterMap, { id: "c9", source: "character", name: "Card" })[0]?.owner.ownerType,
  "character",
  "playing as a character card uses that character's avatar",
);
assert.deepEqual(chatAvatarAgentIds({ enableAgents: true, activeAgentIds: ["expression", "3d-avatars"] }), [
  "3d-avatars",
]);
assert.deepEqual(chatAvatarAgentIds({ enableAgents: false, activeAgentIds: ["2d-avatars"] }), []);
assert.deepEqual(chatAvatarAgentIds({ enableAgents: "true", activeAgentIds: ["2d-avatars"] }), ["2d-avatars"]);

for (const surface of ["components/chat/ChatRoleplaySurface.tsx", "components/game/GameSurface.tsx"]) {
  const text = client(surface);
  assert.match(
    text,
    /lazy\(async \(\) => \{\n {2}const module = await import\("\.\.\/\.\.\/features\/avatars\/stage\/AvatarStage"\);/u,
  );
  assert.doesNotMatch(
    text,
    /^import[^;]*features\/avatars\/stage\/AvatarStage["']/mu,
    `${surface} loads the stage lazily`,
  );
  assert.match(
    text,
    /avatarAgentIds\.length > 0 && avatarParticipants\.length > 0/u,
    `${surface} mounts it only when on`,
  );
}
assert.match(
  client("features/avatars/stage/AvatarStage.tsx"),
  /useEffect\(\(\) => \{\n {4}if \(!showsAvatars\) return;\n {4}const created = createAvatarDirector\(/u,
  "the director (and its classifier model) starts only once an avatar shows",
);
const setupPage = client("features/avatars/setup/AvatarAgentSetup.tsx");
for (const [pattern, what] of [
  [/type="file"/u, "import pickers"],
  [/avatars\.setup\.(?:useSprites|remove)|\/kinds\//u, "building from sprites and removing"],
  [/expressionMap/u, "the face editor"],
] as const) {
  assert.doesNotMatch(setupPage, pattern, `the setup page leaves ${what} to the kind panels`);
}
assert.match(
  client("components/agents/AgentEditor.tsx"),
  /const AvatarAgentSetup = lazy\(\(\) =>\n {2}import\("\.\.\/\.\.\/features\/avatars\/setup\/AvatarAgentSetup"\)/u,
  "the setup loads only on an avatar agent's page",
);

console.log("avatar stage logic regression passed");

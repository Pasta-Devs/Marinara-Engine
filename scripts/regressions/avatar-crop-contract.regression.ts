// ─────────────────────────────────────────────────────────────
// Avatar crop contract regression
// ─────────────────────────────────────────────────────────────
// Guards the neutral shared avatar-crop contract:
//  - shared SourceRectAvatarCrop / LegacyAvatarCrop / AvatarCrop union exports
//  - avatarCropSchema strict request semantics (rejects extra keys + bad numerics)
//  - normalizeAvatarCrop tolerant stored parsing (both formats, null on malformed)
//  - Noodle request strictness + tolerant stored reads
//  - parseCharacterDisplayData owning character crop normalization
//  - editor/widget output limited to SourceRectAvatarCrop
//  - removed alias names stay gone from packages and regression scripts
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { normalizeAvatarCrop } from "../../packages/shared/src/utils/avatar-crop.js";
import { avatarCropSchema } from "../../packages/shared/src/schemas/avatar-crop.schema.js";
import {
  noodleAccountProfileSettingsSchema,
  noodleAccountProfileUpdateSchema,
} from "../../packages/shared/src/schemas/noodle.schema.js";
import {
  normalizeNoodleAccountSettings,
  parseNoodleAvatarCrop,
} from "../../packages/server/src/services/storage/noodle.storage.js";
import { getAvatarCropStyle, isLegacyAvatarCrop } from "../../packages/client/src/lib/utils.js";
import { parseCharacterDisplayData } from "../../packages/client/src/lib/character-display.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

// ── 1. Shared export surface (built .d.ts) ──
const typesDts = readFileSync(join(repoRoot, "packages/shared/dist/types/avatar-crop.d.ts"), "utf8");
assert.match(typesDts, /export interface SourceRectAvatarCrop/u, "shared must export SourceRectAvatarCrop");
assert.match(typesDts, /export interface LegacyAvatarCrop/u, "shared must export LegacyAvatarCrop");
assert.match(
  typesDts,
  /export type AvatarCrop = SourceRectAvatarCrop \| LegacyAvatarCrop/u,
  "shared AvatarCrop must be the neutral union of both shapes",
);
const schemaDts = readFileSync(join(repoRoot, "packages/shared/dist/schemas/avatar-crop.schema.d.ts"), "utf8");
assert.match(schemaDts, /export declare const avatarCropSchema/u, "shared must export avatarCropSchema");
const utilsDts = readFileSync(join(repoRoot, "packages/shared/dist/utils/avatar-crop.d.ts"), "utf8");
assert.match(utilsDts, /export declare function normalizeAvatarCrop/u, "shared must export normalizeAvatarCrop");
const indexDts = readFileSync(join(repoRoot, "packages/shared/dist/index.d.ts"), "utf8");
assert.match(indexDts, /types\/avatar-crop\.js/u, "shared barrel must re-export the crop types");
assert.match(indexDts, /schemas\/avatar-crop\.schema\.js/u, "shared barrel must re-export avatarCropSchema");
assert.match(indexDts, /utils\/avatar-crop\.js/u, "shared barrel must re-export normalizeAvatarCrop");

// ── 2. normalizeAvatarCrop — supported shapes ──
const currentCrop = { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 };
const toleranceCrop = { srcX: 0.001, srcY: 0.001, srcWidth: 1, srcHeight: 1 };
const legacyCrop = { zoom: 2, offsetX: -10, offsetY: 5, fullImage: true };
const legacyCropWithoutFullImage = { zoom: 1.5, offsetX: 2, offsetY: -3 };
for (const [input, expected] of [
  [currentCrop, currentCrop],
  ['{"srcX":0.25,"srcY":0.1,"srcWidth":0.5,"srcHeight":0.5}', currentCrop],
  [legacyCrop, legacyCrop],
  [legacyCropWithoutFullImage, legacyCropWithoutFullImage],
  ['{"zoom":1.5,"offsetX":2,"offsetY":-3}', legacyCropWithoutFullImage],
  [
    { zoom: 1.2, offsetX: 0, offsetY: 0, fullImage: false },
    { zoom: 1.2, offsetX: 0, offsetY: 0 },
  ],
] as const) {
  assert.deepEqual(normalizeAvatarCrop(input), expected);
}

// ── 3. normalizeAvatarCrop — malformed input returns null without throwing ──
const malformedCrops = [
  null,
  undefined,
  "",
  "not json",
  "{broken",
  "42",
  "null",
  42,
  true,
  [],
  "[]",
  {},
  { srcX: 0, srcY: 0, srcWidth: 0, srcHeight: 0 },
  { srcX: 0, srcY: 0, srcWidth: 0.5, srcHeight: 0 },
  { srcX: -0.5, srcY: 0, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: 0.9, srcY: 0, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: 0, srcY: 0.9, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: "0.25", srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: NaN, srcY: 0, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: Infinity, srcY: 0, srcWidth: 0.5, srcHeight: 0.5 },
  { zoom: 0, offsetX: 0, offsetY: 0 },
  { zoom: -1, offsetX: 0, offsetY: 0 },
  { zoom: 1, offsetX: "0", offsetY: 0 },
  { zoom: Infinity, offsetX: 0, offsetY: 0 },
  { zoom: 1, offsetX: 0, offsetY: 0, fullImage: "yes" },
  { srcX: 0, srcY: 0, srcWidth: 0.5, srcHeight: 0.5, zoom: 1, offsetX: 0, offsetY: 0 },
];
for (const value of malformedCrops) {
  assert.equal(normalizeAvatarCrop(value), null, `malformed crop ${JSON.stringify(value)} must normalize to null`);
}
// ── 4. avatarCropSchema — strict request semantics ──
for (const crop of [currentCrop, toleranceCrop, legacyCrop]) {
  assert.deepEqual(avatarCropSchema.parse(crop), crop);
}
for (const crop of [
  { ...currentCrop, extra: 1 },
  { ...legacyCropWithoutFullImage, extra: 1 },
  { ...currentCrop, fullImage: true },
  { srcX: 0, srcY: 0, srcWidth: 0, srcHeight: 0 },
  { zoom: 0, offsetX: 0, offsetY: 0 },
  { zoom: 1.5, offsetX: 0, offsetY: 0, fullImage: "yes" },
  { ...currentCrop, srcX: "0.25" },
  { ...currentCrop, srcX: NaN },
  { srcX: -2, srcY: 0, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: 0, srcY: -2, srcWidth: 0.5, srcHeight: 0.5 },
  { srcX: 0.9, srcY: 0, srcWidth: 0.2, srcHeight: 0.5 },
  { srcX: 0, srcY: 0.9, srcWidth: 0.5, srcHeight: 0.2 },
]) {
  assert.equal(avatarCropSchema.safeParse(crop).success, false, `schema must reject ${JSON.stringify(crop)}`);
}

// ── 5. Noodle request schemas use the strict shared crop schema ──
assert.equal(
  noodleAccountProfileSettingsSchema.safeParse({ avatarCrop: { srcX: -2, srcY: 3, srcWidth: 2, srcHeight: 4 } })
    .success,
  false,
  "Noodle requests must reject source rectangles outside normalized bounds",
);
assert.equal(
  noodleAccountProfileSettingsSchema.safeParse({
    avatarCrop: { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5, bogus: true },
  }).success,
  false,
  "Noodle requests must reject extra crop keys",
);
assert.equal(
  noodleAccountProfileSettingsSchema.safeParse({
    avatarCrop: { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 },
    extra: 1,
  }).success,
  false,
  "Noodle profile settings object itself must stay strict",
);
assert.equal(
  noodleAccountProfileUpdateSchema.safeParse({ profile: { avatarCrop: legacyCropWithoutFullImage } }).success,
  true,
  "Noodle profile update must accept a valid legacy crop",
);

// ── 6. Noodle tolerant stored reads (both formats, null on malformed) ──
for (const [input, expected] of [
  [currentCrop, currentCrop],
  [toleranceCrop, toleranceCrop],
  ['{"srcX":0.25,"srcY":0.1,"srcWidth":0.5,"srcHeight":0.5}', currentCrop],
  [legacyCrop, legacyCrop],
] as const) {
  assert.deepEqual(parseNoodleAvatarCrop(input), expected);
}
for (const value of [
  null,
  undefined,
  "",
  "garbage",
  "{broken",
  42,
  [],
  { srcX: 0, srcY: 0, srcWidth: 0, srcHeight: 0 },
]) {
  assert.equal(parseNoodleAvatarCrop(value), null, "Noodle stored reads must fall back to null on malformed values");
}
assert.deepEqual(
  normalizeNoodleAccountSettings({ profile: { avatarCrop: currentCrop } }).profile.avatarCrop,
  currentCrop,
  "Noodle settings normalization must keep valid current stored crops",
);
assert.deepEqual(
  normalizeNoodleAccountSettings({ profile: { avatarCrop: legacyCrop } }).profile.avatarCrop,
  legacyCrop,
  "Noodle settings normalization must keep valid legacy stored crops",
);
for (const avatarCrop of [
  { srcX: -2, srcY: 3, srcWidth: 2, srcHeight: 4, extra: true },
  { srcX: 0, srcY: 0, srcWidth: 0, srcHeight: 0 },
]) {
  assert.equal(
    "avatarCrop" in normalizeNoodleAccountSettings({ profile: { avatarCrop } }).profile,
    false,
    "Noodle settings normalization must omit malformed stored crops",
  );
}
assert.equal(
  normalizeNoodleAccountSettings({ profile: { avatarCrop: null } }).profile.avatarCrop,
  null,
  "Noodle settings normalization must preserve explicit null crops",
);

// ── 7. Rendering contract unchanged ──
assert.deepEqual(getAvatarCropStyle(currentCrop), {
  position: "absolute",
  width: "200%",
  height: "200%",
  left: "-50%",
  top: "-20%",
  maxWidth: "none",
  maxHeight: "none",
  objectFit: "fill",
});
assert.deepEqual(getAvatarCropStyle({ zoom: 2, offsetX: -10, offsetY: 5 }), {
  transform: "scale(2) translate(-10%, 5%)",
});
assert.equal(getAvatarCropStyle({ zoom: 1.5, offsetX: 2, offsetY: -3, fullImage: true }).objectFit, "contain");
assert.deepEqual(getAvatarCropStyle(null), {});
assert.deepEqual(getAvatarCropStyle(undefined), {});
assert.equal(isLegacyAvatarCrop({ zoom: 1.5, offsetX: 2, offsetY: -3 }), true);
assert.equal(isLegacyAvatarCrop({ srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 }), false);

// ── 8. parseCharacterDisplayData owns crop normalization ──
const display = parseCharacterDisplayData({
  data: JSON.stringify({
    name: "Aria",
    extensions: { avatarCrop: { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 0.5 } },
  }),
  comment: "  Title  ",
});
assert.equal(display.name, "Aria");
assert.equal(display.comment, "Title");
assert.deepEqual(display.avatarCrop, currentCrop, "display parsing must expose the normalized current crop");
assert.deepEqual(
  parseCharacterDisplayData({ data: { name: "B", extensions: { avatarCrop: { zoom: 1.5, offsetX: 2, offsetY: -3 } } } })
    .avatarCrop,
  { zoom: 1.5, offsetX: 2, offsetY: -3 },
  "display parsing must expose the normalized legacy crop",
);
assert.deepEqual(
  parseCharacterDisplayData({
    data: JSON.stringify({ name: "C", extensions: { avatarCrop: '{"zoom":1.2,"offsetX":0,"offsetY":0}' } }),
  }).avatarCrop,
  { zoom: 1.2, offsetX: 0, offsetY: 0 },
  "display parsing must normalize JSON-encoded crop strings",
);
assert.equal(parseCharacterDisplayData({ data: "not-json" }).avatarCrop, null);
assert.equal(parseCharacterDisplayData({ data: "{}" }).avatarCrop, null);
assert.equal(
  parseCharacterDisplayData({ data: JSON.stringify({ name: "D", extensions: { avatarCrop: "broken" } }) }).avatarCrop,
  null,
  "display parsing must drop malformed crops without throwing",
);
assert.equal(parseCharacterDisplayData({ data: { name: "E", extensions: "nope" } }).avatarCrop, null);
assert.equal(
  parseCharacterDisplayData({
    data: JSON.stringify({ name: "F", extensions: { avatarCrop: { srcX: 0, srcY: 0, srcWidth: 0, srcHeight: 0 } } }),
  }).name,
  "F",
  "a malformed crop must not prevent the display fields from parsing",
);

// ── 9. Widget/editors emit SourceRectAvatarCrop ──
const widgetSource = readFileSync(join(repoRoot, "packages/client/src/components/ui/AvatarCropWidget.tsx"), "utf8");
assert.match(
  widgetSource,
  /onChange: \(next: SourceRectAvatarCrop\) => void/u,
  "AvatarCropWidget must emit SourceRectAvatarCrop",
);
assert.match(
  widgetSource,
  /const previewCrop: SourceRectAvatarCrop \| null/u,
  "AvatarCropWidget preview must be typed as SourceRectAvatarCrop",
);
assert.doesNotMatch(
  widgetSource,
  /AvatarCropValue|parseAvatarCropJson/u,
  "AvatarCropWidget must not use removed aliases",
);

for (const [path, pattern] of [
  ["components/characters/CharacterEditor.tsx", /onChange=\{\(next\) => updateExtension\("avatarCrop", next\)\}/u],
  ["components/personas/PersonaEditor.tsx", /onChange=\{\(next\) => updateField\("avatarCrop", next\)\}/u],
] as const) {
  assert.match(readFileSync(join(repoRoot, "packages/client/src", path), "utf8"), pattern);
}

// ── 10. Drawer/wizard reuse parseCharacterDisplayData (no duplicate parsing) ──
const drawerSource = readFileSync(join(repoRoot, "packages/client/src/components/chat/ChatSettingsDrawer.tsx"), "utf8");
const wizardSource = readFileSync(join(repoRoot, "packages/client/src/components/chat/ChatSetupWizard.tsx"), "utf8");
for (const [source, removedParsing, sharedCrop] of [
  [drawerSource, /charAvatarCrop|parseAvatarCropJson|AvatarCropValue/u, /getCharacterInfo\([^)]*\)\.avatarCrop/u],
  [
    wizardSource,
    /getCharacterAvatarCrop|parseAvatarCropJson|AvatarCropValue/u,
    /crop=\{getCharacterInfo\([^)]*\)\.avatarCrop \?\? null\}|crop=\{info\.avatarCrop \?\? null\}/u,
  ],
] as const) {
  assert.doesNotMatch(source, removedParsing);
  assert.match(source, sharedCrop);
}
assert.match(
  drawerSource,
  /getAvatarCropStyle\(normalizeAvatarCrop\(persona\.avatarCrop\)\)/u,
  "Drawer persona pickers must render normalized stored crops",
);
assert.doesNotMatch(drawerSource, /avatarCrop: isPersona \? null/u, "Drawer must not discard persona crops");
assert.match(
  wizardSource,
  /crop=\{normalizeAvatarCrop\(persona\.avatarCrop\)\}/u,
  "Wizard persona pickers must render normalized stored crops",
);

// ── 11. Removed names stay gone from packages and regression scripts ──
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectSourceFiles(full));
    else if (/\.(?:[jt]sx?)$/u.test(entry.name)) results.push(full);
  }
  return results;
}
const sourceFiles: string[] = [];
for (const pkg of readdirSync(join(repoRoot, "packages"), { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const srcDir = join(repoRoot, "packages", pkg.name, "src");
  if (existsSync(srcDir)) sourceFiles.push(...collectSourceFiles(srcDir));
}
sourceFiles.push(...collectSourceFiles(join(repoRoot, "scripts", "regressions")));
// This regression itself must name the banned identifiers to ban them, so the
// running file is exempt from the scan; every other package/script source is not.
const thisFile = fileURLToPath(import.meta.url);
const avatarCropTypesFile = join(repoRoot, "packages", "shared", "src", "types", "avatar-crop.ts");
const removedNames = [
  "PersonaAvatarCrop",
  "LegacyPersonaAvatarCrop",
  "type NoodleAvatarCrop =",
  "export type NoodleAvatarCrop",
  "AvatarCropValue",
  "parseAvatarCropJson",
  "AvatarCrop | LegacyAvatarCrop",
  "LegacyAvatarCrop | AvatarCrop",
];
const offenders: string[] = [];
for (const file of sourceFiles) {
  if (file === thisFile) continue;
  const source = readFileSync(file, "utf8");
  for (const name of removedNames) {
    if (
      file === avatarCropTypesFile &&
      (name === "AvatarCrop | LegacyAvatarCrop" || name === "LegacyAvatarCrop | AvatarCrop")
    ) {
      continue;
    }
    if (source.includes(name)) offenders.push(`${file}: ${name}`);
  }
}
assert.deepEqual(
  offenders,
  [],
  "Removed avatar-crop aliases and explicit current-or-legacy unions must not remain in packages or regression scripts",
);

process.stdout.write("Avatar crop contract regression passed.\n");

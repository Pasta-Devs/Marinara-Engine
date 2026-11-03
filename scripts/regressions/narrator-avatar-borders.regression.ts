// Narrator's Avatar Borders (#8712): an optional, off-by-default border in each merged Roleplay
// character's name color, drawn by the Engine. Themes get no per-character data or CSS variables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMergedAvatarBorderStyle } from "../../packages/client/src/lib/utils.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// A solid name color is used as it is; a gradient one uses its first color.
assert.deepEqual(getMergedAvatarBorderStyle("#64b544", 0, 1, true), { boxShadow: "inset 0 0 0 0.125rem #64b544" });
assert.equal(
  getMergedAvatarBorderStyle("linear-gradient(90deg, #ff6b6b, #ffd93d)", 0, 2, true).boxShadow,
  "inset 0 0 0 0.125rem #ff6b6b",
);
// Characters without a name color get the Narrator label's palette, which can be a theme color.
assert.equal(
  getMergedAvatarBorderStyle("var(--marinara-chat-chrome-text)", 1, 3, true).boxShadow,
  "inset 0 0 0 0.125rem var(--marinara-chat-chrome-text)",
);

// A cycling avatar fills the frame, so its border is the whole outline. Avatars shown together
// split the frame evenly, and each border keeps to its own avatar's share.
assert.equal(getMergedAvatarBorderStyle("#fff", 2, 4, true).clipPath, undefined);
assert.equal(getMergedAvatarBorderStyle("#fff", 0, 1, false).clipPath, undefined);
assert.deepEqual(
  [0, 1, 2, 3].map((index) => getMergedAvatarBorderStyle("#fff", index, 4, false).clipPath),
  ["inset(0 75% 0 0%)", "inset(0 50% 0 25%)", "inset(0 25% 0 50%)", "inset(0 0% 0 75%)"],
);
for (const style of [getMergedAvatarBorderStyle("#fff", 0, 2, true), getMergedAvatarBorderStyle("#fff", 1, 2, false)]) {
  assert.ok(
    Object.keys(style).every((property) => !property.startsWith("--")),
    "the border must not hand themes a CSS variable",
  );
}

// Off by default, kept across reloads and devices, and an older store starts with it off.
const store = read("packages/client/src/stores/ui.store.ts");
assert.equal(store.match(/roleplayNarratorAvatarBorders: false,/gu)?.length, 2, "initial state and appearance reset");
assert.equal(
  store.match(/roleplayNarratorAvatarBorders: state\.roleplayNarratorAvatarBorders,/gu)?.length,
  2,
  "the setting must be persisted locally and synced",
);
assert.match(store, /persisted\.roleplayNarratorAvatarBorders = persisted\.roleplayNarratorAvatarBorders === true;/u);

const settings = read("packages/client/src/components/panels/SettingsPanel.tsx");
assert.match(
  settings,
  /getSettingsControlAnchorId\("narrator-avatar-borders"\)[\s\S]{0,120}settings\.controls\.narratorAvatarBorders\.label[\s\S]{0,80}checked=\{roleplayNarratorAvatarBorders\}[\s\S]{0,80}onChange=\{setRoleplayNarratorAvatarBorders\}/u,
);

// The borders render only when the setting is on, in both the compact avatar and the Glued Side
// Panel, and cycle with their avatars. They carry no data attributes for themes.
const message = read("packages/client/src/components/chat/ChatMessage.tsx");
const bordersStart = message.indexOf("const mergedAvatarBorders = roleplayNarratorAvatarBorders");
assert.notEqual(bordersStart, -1, "the borders must be gated on the setting");
const borders = message.slice(bordersStart, message.indexOf(": null;", bordersStart));
assert.match(borders, /className="pointer-events-none absolute inset-0 rounded-\[inherit\]/u);
assert.match(
  borders,
  /getMergedAvatarBorderStyle\(avatar\.nameColor, i, mergedAvatars\.length, cycleMergedNarratorAvatars\)/u,
);
assert.doesNotMatch(borders, /data-|--/u, "the borders must not expose character data to CSS");
assert.equal(message.match(/\{mergedAvatarBorders\}/gu)?.length, 2, "compact avatars and the Glued Side Panel");
assert.match(
  message,
  /const applyMergedCycleIndex = \(index: number\) => \{[\s\S]{0,600}mergedAvatarBorderRefs\.current\.forEach\(\(border, i\) => \{\s*if \(border\) border\.style\.opacity = i === index \? "1" : "0";/u,
  "each border must cycle with its avatar",
);

console.info("narrator avatar borders regression passed");

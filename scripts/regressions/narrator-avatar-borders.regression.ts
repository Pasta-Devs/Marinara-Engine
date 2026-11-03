// Narrator's Avatar Borders (#8712): an optional, off-by-default border in each merged Roleplay
// character's name color, drawn by the Engine. Themes get no per-character data or CSS variables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMergedAvatarBorderStyle } from "../../packages/client/src/lib/utils.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// A solid name color is used as it is; a gradient one uses its first color. The style is only the
// outline of the box it is given: no clipping, and no CSS variable handed to themes.
assert.deepEqual(getMergedAvatarBorderStyle("#64b544"), { boxShadow: "inset 0 0 0 0.125rem #64b544" });
assert.deepEqual(getMergedAvatarBorderStyle("linear-gradient(90deg, #ff6b6b, #ffd93d)"), {
  boxShadow: "inset 0 0 0 0.125rem #ff6b6b",
});
// Characters without a name color get the Narrator label's palette, which can be a theme color.
assert.deepEqual(getMergedAvatarBorderStyle("var(--marinara-chat-chrome-text)"), {
  boxShadow: "inset 0 0 0 0.125rem var(--marinara-chat-chrome-text)",
});

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
const bordersStart = message.indexOf("const mergedAvatarsSideBySide =");
assert.notEqual(bordersStart, -1, "the borders must know when the avatars are shown side by side");
const borders = message.slice(bordersStart, message.indexOf("const compactAvatarSpacerClass", bordersStart));
assert.match(
  borders,
  /^const mergedAvatarsSideBySide = !cycleMergedNarratorAvatars && mergedAvatars\.length > 1;\s*const mergedAvatarBorders = !roleplayNarratorAvatarBorders \? null : mergedAvatarsSideBySide \? \(/u,
  "the borders must be gated on the setting",
);
assert.doesNotMatch(borders, /clip|data-|--/u, "no clipped shared outline, and no character data exposed to CSS");
const fullFrameStart = borders.indexOf(") : (");
assert.notEqual(fullFrameStart, -1);
const sideBySideBorders = borders.slice(0, fullFrameStart);
const fullFrameBorders = borders.slice(fullFrameStart);

// Avatars shown side by side (cycling off or reduced ambient effects) split the frame evenly. Each
// border is its own equal-share flex item, laid out like the images, so every avatar, a middle one
// included, gets a whole outline that also separates it from its neighbours.
assert.match(
  sideBySideBorders,
  /<span aria-hidden="true" className="pointer-events-none absolute inset-0 flex">\s*\{mergedAvatars\.map\(\(avatar\) => \(\s*<span\s+key=\{`border-\$\{avatar\.id\}`\}\s+className="w-0 min-w-0 flex-1"\s+style=\{getMergedAvatarBorderStyle\(avatar\.nameColor\)\}\s*\/>/u,
);
assert.equal(
  message.match(/cycleMergedNarratorAvatars \? "absolute inset-0 w-full" : "relative w-0 min-w-0 flex-1"/gu)?.length,
  3,
  "the panel tail, compact and Glued Side Panel images share the frame the same way as the borders",
);
// A cycling avatar, or a lone one, fills the frame, so its border is the frame's whole outline.
assert.match(
  fullFrameBorders,
  /className="pointer-events-none absolute inset-0 rounded-\[inherit\] transition-opacity duration-700"\s*style=\{getMergedAvatarBorderStyle\(avatar\.nameColor\)\}/u,
);
assert.equal(message.match(/\{mergedAvatarBorders\}/gu)?.length, 2, "compact avatars and the Glued Side Panel");
assert.match(
  message,
  /const applyMergedCycleIndex = \(index: number\) => \{[\s\S]{0,600}mergedAvatarBorderRefs\.current\.forEach\(\(border, i\) => \{\s*if \(border\) border\.style\.opacity = i === index \? "1" : "0";/u,
  "each border must cycle with its avatar",
);

console.info("narrator avatar borders regression passed");

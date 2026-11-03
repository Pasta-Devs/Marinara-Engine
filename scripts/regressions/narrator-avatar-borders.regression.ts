// Narrator's Avatar Borders (#8712): an optional, off-by-default border in each merged Roleplay
// character's name color, drawn by the Engine. Themes get no per-character data or CSS variables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMergedAvatarBorderStyle } from "../../packages/client/src/lib/utils.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// A solid name color is used as it is; a gradient one uses its first color. Without a share, the
// style is the whole outline of the box it is given, and no CSS variable is handed to themes.
assert.deepEqual(getMergedAvatarBorderStyle("#64b544"), { boxShadow: "inset 0 0 0 0.125rem #64b544" });
assert.deepEqual(getMergedAvatarBorderStyle("linear-gradient(90deg, #ff6b6b, #ffd93d)"), {
  boxShadow: "inset 0 0 0 0.125rem #ff6b6b",
});
// Characters without a name color get the Narrator label's palette, which can be a theme color.
assert.deepEqual(getMergedAvatarBorderStyle("var(--marinara-chat-chrome-text)"), {
  boxShadow: "inset 0 0 0 0.125rem var(--marinara-chat-chrome-text)",
});

// With a share, each avatar's border is the frame's own ring, kept only over that avatar's column.
// The columns are the images' equal shares, and together they cover the ring once: no gap, no overlap.
for (const count of [2, 3, 4]) {
  let previousEnd = 0;
  for (let index = 0; index < count; index++) {
    const style = getMergedAvatarBorderStyle("#64b544", { index, count });
    assert.equal(style.boxShadow, "inset 0 0 0 0.125rem #64b544", "every part is the same ring as the full outline");
    const column = /^inset\(0 ([\d.]+)% 0 ([\d.]+)%\)$/u.exec(String(style.clipPath));
    assert.ok(column, `a full-height column of the ring, got ${String(style.clipPath)}`);
    const start = Number(column[2]);
    const end = 100 - Number(column[1]);
    assert.ok(Math.abs(start - previousEnd) < 1e-9, `part ${index + 1} of ${count} must start where the last ended`);
    assert.ok(Math.abs(end - start - 100 / count) < 1e-9, `part ${index + 1} of ${count} must be one equal share`);
    previousEnd = end;
  }
  assert.ok(Math.abs(previousEnd - 100) < 1e-9, `the ${count} parts must close the ring`);
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
const bordersStart = message.indexOf("const mergedAvatarsSideBySide =");
assert.notEqual(bordersStart, -1, "the borders must know when the avatars are shown side by side");
const borders = message.slice(bordersStart, message.indexOf("const roleplayAvatarPanelTail", bordersStart));
assert.match(
  borders,
  /^const mergedAvatarsSideBySide = !cycleMergedNarratorAvatars && mergedAvatars\.length > 1;\s*const outlineEachMergedAvatar = mergedAvatarsSideBySide && showRoleplayAvatarPanel;\s*const mergedAvatarBorders = !roleplayNarratorAvatarBorders \? null : outlineEachMergedAvatar \? \(/u,
  "the borders must be gated on the setting, and only the Glued Side Panel outlines each avatar on its own",
);
assert.doesNotMatch(borders, /data-|--/u, "no character data exposed to CSS");
const ringStart = borders.indexOf(") : (");
assert.notEqual(ringStart, -1);
const outlineBorders = borders.slice(0, ringStart);
const ringBorders = borders.slice(ringStart);

// Which frame the avatars sit in decides the border. The Glued Side Panel's frame is square, so
// side by side each border is its own equal-share flex item, laid out like the images, and every
// avatar, a middle one included, gets a whole outline that also separates it from its neighbours.
const css = read("packages/client/src/styles/globals.css");
assert.match(css, /^\.rpg-avatar-panel \{\n {2}position: relative;\n {2}border-radius: 0;\n\}/mu);
assert.match(
  message,
  /"rpg-avatar-panel-media rpg-avatar-panel absolute inset-0 h-full w-full cursor-zoom-in overflow-hidden",\s*cycleMergedNarratorAvatars \? "block" : "flex",(?:(?!<\/button>)[\s\S])*\{mergedAvatarBorders\}\s*<\/button>/u,
  "the Glued Side Panel's square frame holds the borders",
);
assert.match(
  outlineBorders,
  /<span aria-hidden="true" className="pointer-events-none absolute inset-0 flex">\s*\{mergedAvatars\.map\(\(avatar\) => \(\s*<span\s+key=\{`border-\$\{avatar\.id\}`\}\s+className="w-0 min-w-0 flex-1"\s+style=\{getMergedAvatarBorderStyle\(avatar\.nameColor\)\}\s*\/>/u,
);
assert.equal(
  message.match(/cycleMergedNarratorAvatars \? "absolute inset-0 w-full" : "relative w-0 min-w-0 flex-1"/gu)?.length,
  3,
  "the panel tail, compact and Glued Side Panel images share the frame the same way as the borders",
);

// The compact frame clips round in both styles: circles are rounded-full, and for rectangles the
// unlayered `.rpg-avatar-glow` 50% radius outranks Tailwind's layered rounded-xl, making an oval.
// Straight per-avatar outlines would be cut off by that curve, so there every border spans the
// frame, takes its radius and keeps only its column of the ring. A cycling or lone avatar keeps the
// whole ring, in every frame.
assert.match(css, /^\.rpg-avatar-glow \{\n {2}position: relative;\n {2}border-radius: 50%;\n\}/mu);
assert.match(
  message,
  /const useCompactRectangleAvatar = isRoleplay && roleplayAvatarStyle === "rectangles";\s*const compactAvatarFrameClass = useCompactRectangleAvatar\s*\? "[^"]*rounded-xl"\s*: "[^"]*rounded-full";/u,
  "the rectangles and circles styles of the compact frame",
);
assert.match(
  message,
  /"rpg-avatar-glow relative cursor-pointer overflow-hidden ring-2 ring-white\/10",\s*compactAvatarFrameClass,\s*!cycleMergedNarratorAvatars && "flex",(?:(?!<\/button>)[\s\S])*\{mergedAvatarBorders\}\s*<\/button>/u,
  "the compact frame of either style is the round .rpg-avatar-glow that holds the borders",
);
assert.match(
  message,
  /const showRoleplayAvatarPanel = isRoleplay && roleplayAvatarStyle === "panel" && !isGrouped;\s*const showCompactRoleplayAvatar = isRoleplay && !isGrouped && !hideRoleplayAvatars && !showRoleplayAvatarPanel;/u,
  "circles and rectangles are never the Glued Side Panel, so their side-by-side borders split the ring",
);
assert.match(
  ringBorders,
  /className="pointer-events-none absolute inset-0 rounded-\[inherit\] transition-opacity duration-700"\s*style=\{getMergedAvatarBorderStyle\(\s*avatar\.nameColor,\s*mergedAvatarsSideBySide \? \{ index: i, count: mergedAvatars\.length \} : undefined,\s*\)\}/u,
);
assert.equal(message.match(/\{mergedAvatarBorders\}/gu)?.length, 2, "compact avatars and the Glued Side Panel");
assert.match(
  message,
  /const applyMergedCycleIndex = \(index: number\) => \{[\s\S]{0,600}mergedAvatarBorderRefs\.current\.forEach\(\(border, i\) => \{\s*if \(border\) border\.style\.opacity = i === index \? "1" : "0";/u,
  "each border must cycle with its avatar",
);

console.info("narrator avatar borders regression passed");

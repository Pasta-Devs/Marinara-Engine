// The shared pill Tabs read as one button split into cells, like Download | Open Library: only the outer corners are
// round, and a grid of rows (Settings' 2 × 3 categories) has a line between its cells and one between its rows, and
// none on a row's outer edge. The Chats mode tabs put the icon before the label, on one line, as that row does.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const requireClient = createRequire(new URL("../../../packages/client/package.json", import.meta.url));
const React = requireClient("react");
const { renderToStaticMarkup } = requireClient("react-dom/server");
// tsx compiles the client's JSX to React.createElement here.
(globalThis as { React?: unknown }).React = React;
const { Tabs } = await import("../../../packages/client/src/components/ui/Tabs.js");

const ROUND = "calc(0.75rem - 1px)";
const DIVIDER = "1px solid var(--marinara-chat-chrome-button-border)";

function render(props: Record<string, unknown>, ids: string[]) {
  const items = ids.map((id) => ({ id, label: id, icon: React.createElement("svg") }));
  const markup: string = renderToStaticMarkup(
    React.createElement(Tabs, { items, value: ids[0], onChange() {}, label: "Tabs", ...props }),
  );
  return Array.from(markup.matchAll(/<button[^>]*style="([^"]*)"[^>]*class="([^"]*)"[^>]*>.*?<\/button>/gu), (m) => {
    const style = Object.fromEntries(
      m[1]!.split(";").map((rule) => {
        const at = rule.indexOf(":");
        return [rule.slice(0, at), rule.slice(at + 1)];
      }),
    );
    // Corners as [start-start, start-end, end-end, end-start]: top-left, top-right, bottom-right, bottom-left in a
    // left-to-right language, mirrored in a right-to-left one.
    const corners = ["start-start", "start-end", "end-end", "end-start"]
      .map((corner) => style[`border-${corner}-radius`])
      .join(" ");
    return { style, corners, className: m[2]!, html: m[0] };
  });
}

// Settings: six categories in three columns.
const grid = render({ columns: 3 }, ["general", "appearance", "generation", "addons", "imports", "advanced"]);
assert.equal(grid.length, 6);
assert.deepEqual(
  grid.map((cell) => cell.corners),
  [`${ROUND} 0 0 0`, "0 0 0 0", `0 ${ROUND} 0 0`, `0 0 0 ${ROUND}`, "0 0 0 0", `0 0 ${ROUND} 0`],
  "only the grid's four outer corners are round",
);
assert.deepEqual(
  grid.map((cell) => cell.style["border-top"]),
  [undefined, undefined, undefined, DIVIDER, DIVIDER, DIVIDER],
  "a line parts the rows",
);
assert.deepEqual(
  grid.map((cell) => [cell.style["border-inline-start"], cell.style["border-inline-end"]]),
  [
    ["1px solid transparent", "0"],
    [DIVIDER, "0"],
    [DIVIDER, "0"],
    ["1px solid transparent", "0"],
    [DIVIDER, "0"],
    [DIVIDER, "0"],
  ],
  "a line parts the cells of a row, and a row's first cell has none on the grid's outer edge",
);
assert.ok(
  grid.every((cell) => !/\brounded-/u.test(cell.className)),
  "no cell rounds its own corners inside the grid",
);
assert.ok(
  grid.every((cell) => /flex-col/u.test(cell.className)),
  "a pill icon still sits above its label by default",
);

// One row: round at its two ends only.
const row = render({ inlineIcons: true }, ["conversation", "roleplay", "game"]);
assert.deepEqual(
  row.map((cell) => cell.corners),
  [`${ROUND} 0 0 ${ROUND}`, "0 0 0 0", `0 ${ROUND} ${ROUND} 0`],
);
assert.ok(
  row.every((cell) => !cell.style["border-top"]),
  "a single row has no line between rows",
);
// The Chats mode tabs: the icon before the label on one line, the label cut short rather than wrapped.
for (const cell of row) {
  assert.doesNotMatch(cell.className, /flex-col/u, "an inline icon sits before the label");
  assert.match(cell.html, /<span class="min-w-0 truncate">/u, "an inline label stays on one line");
}

// A last row the cells do not fill (a ruleset sheet's 4 or 5 tabs in 3 columns): the last cell stretches to the
// track's edge, so the row's line and its round corner end there, not mid-track.
const four = render({ columns: 3 }, ["overview", "stats", "skills", "gear"]);
assert.deepEqual(
  four.map((cell) => cell.style["grid-column"]),
  [undefined, undefined, undefined, "span 3"],
);
assert.deepEqual(
  four.map((cell) => cell.corners),
  [`${ROUND} 0 0 0`, "0 0 0 0", `0 ${ROUND} 0 0`, `0 0 ${ROUND} ${ROUND}`],
  "the stretched last cell rounds both bottom corners",
);
const five = render({ columns: 3 }, ["overview", "stats", "skills", "gear", "spells"]);
assert.deepEqual(
  five.map((cell) => cell.style["grid-column"]),
  [undefined, undefined, undefined, undefined, "span 2"],
);
assert.deepEqual(five.map((cell) => cell.corners).slice(3), [`0 0 0 ${ROUND}`, `0 0 ${ROUND} 0`]);

console.log("shared-tabs regression passed");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");

// Row ⋯/download buttons must stay unfilled until hover. Theme and accent rules kept
// outranking the quiet rule by specificity and the bubbles came back, so it uses !important.
const css = read("styles/globals.css");
const quiet = css.match(
  /\.mari-chrome-control--quiet:not\(:hover\):not\(:focus-visible\):not\(\[aria-expanded="true"\]\) \{([^}]*)\}/,
);
assert.ok(quiet, "the quiet row-button rest rule exists");
assert.match(quiet[1], /background: transparent !important;/, "quiet buttons have no fill at rest");
assert.match(quiet[1], /border-color: transparent !important;/, "quiet buttons have no border at rest");

assert.match(
  read("components/connections/ConnectionRow.tsx"),
  /export const ROW_BUTTON = "[^"]*mari-chrome-control--quiet/,
  "row buttons use the quiet variant",
);

// The built-in model row offers one action per state, not a button, a one-item menu and a row click for the same thing.
const card = read("components/connections/BuiltInModelCard.tsx");
assert.doesNotMatch(card, /ContextMenu/, "no one-item ⋯ menu on the built-in model row");
assert.match(card, /onClick=\{notDownloaded \? undefined : open\}/, "the row is not a second Download button");

console.log("quiet row buttons: OK");

// Professor Mari's stylesheet: her user bubbles take their background from the theme colours.
// regression-layout: source-path this is a stylesheet rule, so the stylesheet's text is what is checked.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

assert.match(
  readFileSync(new URL("../../../packages/client/src/styles/mari.css", import.meta.url), "utf8"),
  /\.mari-user-request__bubble \{[^}]*background: color-mix\(in srgb, var\(--foreground\) \d+%, var\(--card\)\)/u,
  "Professor Mari user bubbles must take their colour from the theme",
);

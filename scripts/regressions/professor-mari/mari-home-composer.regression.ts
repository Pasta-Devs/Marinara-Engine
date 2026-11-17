// Professor Mari's Home composer stops growing at its CSS max-height. Reads component source until a test can drive
// it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const professorMariHomeSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
// R11: the composer cap is its CSS max-height now (8 lines, 6 on touch), not a hard-coded 128 px.
assert.match(
  professorMariHomeSource,
  /const cap = Number\.parseFloat\(getComputedStyle\(textarea\)\.maxHeight\);\s*const to = Number\.isFinite\(cap\) \? Math\.min\(textarea\.scrollHeight, cap\)/u,
  "Professor Mari's composer must stop growing at its max-height",
);

import assert from "node:assert/strict";

import { renderMariSkillsPrompt } from "../../../packages/server/src/services/professor-mari/mari-skills-prompt.js";

const skill = (id: string, contentLength: number, enabled = true) => ({
  id,
  name: `Skill ${id}`,
  description: `does ${id}`,
  enabled,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  size: contentLength,
  filePath: `/skills/${id}/SKILL.md`,
  content: "x".repeat(contentLength),
});

assert.equal(renderMariSkillsPrompt([]), null);
assert.equal(renderMariSkillsPrompt([skill("off", 10, false)]), null);

// A huge skill body is NEVER injected in full: only its index line is always on.
const big = renderMariSkillsPrompt([skill("big", 200_000)]) ?? "";
assert.match(big, /\[big\] Skill big: does big/);
assert.ok(!big.includes("x".repeat(2_000)), "oversized skill body must not be inlined");
assert.match(big, /skill\.get/);

// Short skills stay inlined so trivial ones cost no fetch round-trip.
const small = renderMariSkillsPrompt([skill("small", 50)]) ?? "";
assert.ok(small.includes(`<skill name="Skill small" id="small">`));
assert.ok(small.includes("x".repeat(50)));

// The always-on block stays bounded no matter how many skills are enabled.
const many = renderMariSkillsPrompt(Array.from({ length: 500 }, (_, i) => skill(`s${i}`, 1_000))) ?? "";
assert.ok(many.length < 20_000, `skills block too large: ${many.length}`);
assert.match(many, /omitted from the index/);

// Diagnostics survive.
assert.match(renderMariSkillsPrompt([], ["broken"]) ?? "", /<skill_diagnostics>\nbroken/);

console.log("Professor Mari skills prompt regression checks passed.");

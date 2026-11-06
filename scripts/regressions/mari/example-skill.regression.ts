// The example Professor Mari skill is seeded once, disabled, and never comes back after a delete.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "mari-example-skill-"));
const savedDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dir;
const { ProfessorMariWorkspaceSkillsService } =
  await import("../../../packages/server/src/services/professor-mari/workspace-skills.service.js");
const { renderMariSkillsPrompt } =
  await import("../../../packages/server/src/services/professor-mari/mari-skills-prompt.js");

try {
  const service = new ProfessorMariWorkspaceSkillsService();
  // Two first calls at once still seed one skill.
  const [{ skills }] = await Promise.all([service.list(), new ProfessorMariWorkspaceSkillsService().list()]);
  // Shipped skills come first and are always on; the example is a normal user skill after them.
  const ids = skills.map((skill) => skill.id);
  assert.equal(ids.at(-1), "ask-before-building", "the example comes last");
  assert.ok(
    ids.slice(0, -1).every((id) => id.startsWith("builtin-")),
    "every id before the example is a shipped skill",
  );
  const example = skills.find((skill) => skill.id === "ask-before-building");
  assert.equal(example?.enabled, false, "the example ships disabled");
  assert.match(example!.content, /`suggestions`/);
  const rendered = renderMariSkillsPrompt(skills);
  assert.ok(rendered && !rendered.includes("ask-before-building"), "a disabled example adds nothing to the prompt");

  await service.delete("ask-before-building");
  assert.deepEqual(
    (await service.list()).skills.map((skill) => skill.id),
    ids.slice(0, -1),
    "a deleted example is not seeded again",
  );
} finally {
  if (savedDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = savedDataDir;
  rmSync(dir, { recursive: true, force: true });
}

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
  assert.deepEqual(
    skills.map((skill) => [skill.id, skill.enabled]),
    [["ask-before-building", false]],
  );
  assert.match(skills[0]!.content, /`suggestions`/);
  assert.equal(renderMariSkillsPrompt(skills), null, "a disabled example adds nothing to the prompt");

  await service.delete("ask-before-building");
  assert.deepEqual((await service.list()).skills, [], "a deleted example is not seeded again");
} finally {
  if (savedDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = savedDataDir;
  rmSync(dir, { recursive: true, force: true });
}

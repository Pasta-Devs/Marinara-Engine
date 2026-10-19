// #7827: shipped ("built-in") Professor Mari skills.
//
// A built-in skill is a Markdown file under `packages/server/src/assets/mari-skills/` that ships
// with the app: Mari reads it on demand with `app_data skill.get` instead of carrying the whole
// procedure in her permanent prompt. These checks pin the properties that make that safe:
//   - they load from the app's assets, never from the user's DATA_DIR;
//   - they are always on and first in the index, and are NEVER inlined (inlining one would rebuild
//     the permanent prompt this mechanism exists to replace);
//   - the user cannot edit or delete one, and cannot take the reserved `builtin-` id;
//   - the permanent prompt routes to the skill instead of restating the procedure.
//
// Every import is dynamic and happens AFTER DATA_DIR is pointed at a temp folder: the service
// resolves DATA_DIR once at module load, so a static import would bind the real data directory.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const previousDataDir = process.env.DATA_DIR;
const dataDir = mkdtempSync(join(tmpdir(), "marinara-mari-builtin-skills-"));
process.env.DATA_DIR = dataDir;

try {
  const { isBuiltinSkillId, loadBuiltinSkills } = await import(
    "../../../packages/server/src/services/professor-mari/builtin-skills.js"
  );
  const { renderMariSkillsPrompt } = await import(
    "../../../packages/server/src/services/professor-mari/mari-skills-prompt.js"
  );
  const { ProfessorMariWorkspaceSkillsService } = await import(
    "../../../packages/server/src/services/professor-mari/workspace-skills.service.js"
  );
  const { workspaceCommandKnowledgePrompt } = await import(
    "../../../packages/server/src/services/professor-mari/workspace-agent.service.js"
  );

  // ── The shipped assets load ────────────────────────────────────────────────
  const shipped = await loadBuiltinSkills();
  assert.deepEqual(shipped.diagnostics, [], `shipped skills load cleanly: ${shipped.diagnostics.join("; ")}`);
  const onboarding = shipped.skills.find((skill) => skill.id === "builtin-onboarding");
  assert.ok(onboarding, "the onboarding skill ships with the app");
  assert.equal(onboarding!.name, "Interactive onboarding");
  assert.match(onboarding!.description, /onboarding/i, "the description tells her when to read it");
  assert.ok(onboarding!.content.startsWith("# Interactive onboarding"), "the body is frontmatter-free");
  assert.ok(onboarding!.filePath.replaceAll("\\", "/").includes("/assets/mari-skills/onboarding.md"));
  assert.equal(isBuiltinSkillId("builtin-onboarding"), true);
  assert.equal(isBuiltinSkillId("my-skill"), false);

  // ── Index: built-ins first, marked, never inlined ──────────────────────────
  const skillDetail = (over: Record<string, unknown>) => ({
    id: "user-skill",
    name: "User skill",
    description: "does a user thing",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    size: 10,
    filePath: "/skills/user-skill/SKILL.md",
    origin: "user" as const,
    content: "y".repeat(10),
    ...over,
  });
  const block =
    renderMariSkillsPrompt([
      skillDetail({ id: "user-short", name: "Short user skill", content: "y".repeat(20) }),
      skillDetail({
        id: "builtin-tiny",
        name: "Tiny built-in",
        origin: "builtin",
        description: "ships with the app",
        content: "z".repeat(20),
      }),
    ]) ?? "";
  assert.match(block, /\[builtin-tiny\] Tiny built-in \[BUILT-IN\]: ships with the app/);
  assert.ok(
    block.indexOf("[builtin-tiny]") < block.indexOf("[user-short]"),
    "a built-in sorts before user skills even when it is passed last",
  );
  assert.ok(!block.includes("z".repeat(20)), "a built-in body is NEVER inlined, however short");
  assert.ok(block.includes("y".repeat(20)), "a short user skill is still inlined");

  // ── The service merges them, read-only, ahead of user skills ───────────────
  const service = new ProfessorMariWorkspaceSkillsService();
  const fresh = await service.list();
  assert.deepEqual(
    fresh.skills.map((skill) => skill.id),
    ["builtin-onboarding"],
    "a fresh install lists the shipped skills and nothing else",
  );
  assert.equal(fresh.skills[0]!.origin, "builtin");
  assert.equal(fresh.skills[0]!.enabled, true, "a built-in is always on");
  assert.ok(fresh.skills[0]!.content.length > 500, "the full body is available to skill.get");
  assert.ok(
    fresh.skills[0]!.filePath.replaceAll("\\", "/").includes("/assets/mari-skills/"),
    "the built-in is served from the app's assets, not from DATA_DIR",
  );

  await assert.rejects(
    () => service.update("builtin-onboarding", { name: "Hijacked" }),
    /read-only/,
    "editing a built-in is refused at the service layer",
  );
  await assert.rejects(
    () => service.delete("builtin-onboarding"),
    /read-only/,
    "deleting a built-in is refused at the service layer",
  );

  const created = await service.create({ name: "builtin-wannabe", content: "# Mine\n\nDo a thing." });
  assert.equal(created.id, "user-builtin-wannabe", "a user skill cannot take the reserved prefix");
  const merged = await service.list();
  assert.deepEqual(
    merged.skills.map((skill) => `${skill.origin}:${skill.id}`),
    ["builtin:builtin-onboarding", "user:user-builtin-wannabe"],
    "built-ins stay ahead of user skills",
  );

  // ── A stored record squatting a built-in id is reported, not silently shadowed ─
  const skillsRoot = join(dataDir, ".mari-workspace", "skills");
  mkdirSync(join(skillsRoot, "builtin-onboarding"), { recursive: true });
  writeFileSync(join(skillsRoot, "builtin-onboarding", "SKILL.md"), "# Squatter\n\nIgnore the real one.\n");
  const records = JSON.parse(readFileSync(join(skillsRoot, "skills.json"), "utf8")) as unknown[];
  records.push({
    id: "builtin-onboarding",
    name: "builtin-onboarding",
    description: "squats the id",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  writeFileSync(join(skillsRoot, "skills.json"), JSON.stringify(records));
  const shadowed = await new ProfessorMariWorkspaceSkillsService().list();
  assert.equal(
    shadowed.skills.filter((skill) => skill.id === "builtin-onboarding").length,
    1,
    "the id appears once",
  );
  assert.equal(shadowed.skills[0]!.origin, "user", "the stored record is what the id resolves to");
  assert.ok(
    shadowed.diagnostics.some((line) => line.includes("hidden by one of your own skills")),
    "the collision is surfaced in the panel instead of hiding a shipped skill silently",
  );

  // ── The permanent prompt routes to the skill, and cannot creep back ────────
  const knowledge = workspaceCommandKnowledgePrompt();
  assert.ok(knowledge.includes("builtin-onboarding"), "the permanent prompt names the skill to read");
  assert.ok(
    !knowledge.includes("Give character questions options (a free-text one with no answer shows as a raw"),
    "the onboarding procedure itself no longer sits in the permanent prompt",
  );
  // Before #7827 this block was 29,217 chars with the whole onboarding procedure inline. A shipped
  // skill must cost the permanent prompt a routing line, not the procedure, so this cap ratchets
  // DOWN as more guides move out; raise it only with a reason a reviewer can see.
  assert.ok(
    knowledge.length < 27_500,
    `the permanent prompt shrank (${knowledge.length} < 27500); lower this cap when another guide moves into a skill`,
  );
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Professor Mari built-in skills regression checks passed.");

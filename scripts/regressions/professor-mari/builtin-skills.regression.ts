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
  const { loadBuiltinSkills } = await import("../../../packages/server/src/services/professor-mari/builtin-skills.js");
  const { renderMariSkillsPrompt } =
    await import("../../../packages/server/src/services/professor-mari/mari-skills-prompt.js");
  const { ProfessorMariWorkspaceSkillsService } =
    await import("../../../packages/server/src/services/professor-mari/workspace-skills.service.js");
  const {
    buildWorkspaceContinuitySnapshot,
    piRuntimePrompt,
    workspaceCommandKnowledgePrompt,
    workspaceCommandProtocolPrompt,
  } = await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");

  // ── The shipped assets load ────────────────────────────────────────────────
  const shipped = await loadBuiltinSkills();
  assert.deepEqual(shipped.diagnostics, [], `shipped skills load cleanly: ${shipped.diagnostics.join("; ")}`);
  // A handbook's error table is matched against the text the model actually got. Lookups now refuse
  // with `No <kind> has the id "<id>"` (missingRecord); the retired `<Kind> <id> not found` shape must
  // not come back. Parent folders keep their own message.
  for (const skill of shipped.skills) {
    assert.doesNotMatch(
      skill.content,
      /`(?!Parent folder)[A-Z][A-Za-z ]* (?:<id>|\$\{id\}) (?:was )?not found/u,
      `${skill.id} quotes a retired not-found message`,
    );
  }
  const onboarding = shipped.skills.find((skill) => skill.id === "builtin-onboarding");
  assert.ok(onboarding, "the onboarding skill ships with the app");
  assert.equal(onboarding!.name, "Interactive onboarding");
  assert.match(onboarding!.description, /onboarding/i, "the description tells her when to read it");
  assert.ok(onboarding!.content.startsWith("# Interactive onboarding"), "the body is frontmatter-free");
  assert.ok(onboarding!.filePath.replaceAll("\\", "/").includes("/assets/mari-skills/onboarding.md"));
  const lorebook = shipped.skills.find((skill) => skill.id === "builtin-lorebook");
  assert.ok(lorebook, "the lorebook handbook ships with the app");
  assert.ok(lorebook!.content.startsWith("# Lorebook authoring"), "its body is frontmatter-free");
  // A handbook whose writes outgrow one reply on a small output limit says how to split them (or, for a
  // stylesheet, why it cannot be). Home widgets are left out: a whole create is under 600 characters.
  for (const id of ["characters", "lorebook", "presets", "extensions", "themes", "onboarding"]) {
    const handbook = shipped.skills.find((skill) => skill.id === `builtin-${id}`);
    assert.ok(
      handbook?.content.includes("When the output limit is small"),
      `builtin-${id} covers a small output limit`,
    );
  }

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
    [
      "builtin-characters",
      "builtin-decisions",
      "builtin-extensions",
      "builtin-home-widgets",
      "builtin-lorebook",
      "builtin-onboarding",
      "builtin-presets",
      "builtin-repair",
      "builtin-themes",
      "ask-before-building",
    ],
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
    [
      "builtin:builtin-characters",
      "builtin:builtin-decisions",
      "builtin:builtin-extensions",
      "builtin:builtin-home-widgets",
      "builtin:builtin-lorebook",
      "builtin:builtin-onboarding",
      "builtin:builtin-presets",
      "builtin:builtin-repair",
      "builtin:builtin-themes",
      "user:ask-before-building",
      "user:user-builtin-wannabe",
    ],
    "built-ins stay ahead of user skills",
  );

  // The rewritten id must still fit the 64-character limit `assertSafeSkillId` enforces, or the
  // skill would be created and then reject every later update or delete.
  const wide = await service.create({
    name: `builtin-${"a".repeat(60)}`,
    content: "# Wide\n\nA deliberately long reserved name.",
  });
  assert.ok(wide.id.length <= 64, `a reserved-prefix id stays within 64 chars (got ${wide.id.length})`);
  assert.ok(wide.id.startsWith("user-builtin-"), "the reserved prefix is still rewritten");
  await service.update(wide.id, { description: "Still editable." });

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
  assert.equal(shadowed.skills.filter((skill) => skill.id === "builtin-onboarding").length, 1, "the id appears once");
  assert.equal(
    shadowed.skills.find((skill) => skill.id === "builtin-onboarding")?.origin,
    "user",
    "the stored record is what the id resolves to",
  );
  assert.ok(
    shadowed.diagnostics.some((line) => line.includes("hidden by one of your own skills")),
    "the collision is surfaced in the panel instead of hiding a shipped skill silently",
  );

  // ── The permanent prompt routes to the skill, and cannot creep back ────────
  const knowledge = workspaceCommandKnowledgePrompt();
  console.log(`permanent prompt: ${knowledge.length} chars`);
  for (const id of [
    "builtin-characters",
    "builtin-decisions",
    "builtin-extensions",
    "builtin-home-widgets",
    "builtin-lorebook",
    "builtin-onboarding",
    "builtin-presets",
    "builtin-repair",
    "builtin-themes",
  ]) {
    assert.ok(knowledge.includes(id), `the permanent prompt names ${id}`);
  }
  assert.ok(
    !knowledge.includes("Recursive flags are inverted"),
    "the lorebook procedure itself no longer sits in the permanent prompt",
  );
  assert.ok(
    !knowledge.includes("Give character questions options (a free-text one with no answer shows as a raw"),
    "the onboarding procedure itself no longer sits in the permanent prompt",
  );
  // Two policies that must hold on turns where no handbook was read stay permanent: a rewrite that
  // drops the user's Decision passes the gate, and depth placement is gated with or without Decisions.
  assert.ok(
    knowledge.includes("keeps every existing conditional, `decisionStatement` and `activationQuestion` verbatim"),
    "ordinary edits preserve the user's existing Decisions",
  );
  assert.ok(knowledge.includes("History placement costs prompt caching, Decisions or not"), "depth placement is gated");
  assert.ok(
    knowledge.includes("(on a small output limit, the first entries, then one `lorebook.addEntry` per reply)"),
    "the permanent lorebook line carries the small-limit split, so it does not re-impose one create",
  );
  assert.ok(knowledge.includes("(`cachePlacement`)"), "the placement record is named");
  assert.ok(
    knowledge.includes("SAME response with `awaitingAuthorization: true`"),
    "a Home widget create is held for Accept even when the handbook was not read",
  );
  const piPrompt = piRuntimePrompt();
  assert.ok(piPrompt.includes("never wrap them in tags"), "the pi prompt forbids pseudo-XML tags in visible text");
  // Only a small output limit asks for split writes; a strong model told to fragment wastes calls.
  assert.match(
    piRuntimePrompt(1024),
    /output limit is small \(1024 tokens per reply\)/u,
    "a small limit gets the split hint",
  );
  assert.match(piRuntimePrompt(4096), /output limit is small/u, "4096 is still small");
  assert.ok(!piRuntimePrompt(8192).includes("output limit is small"), "a large limit gets no split hint");
  // The classic prompt carries the same knowledge clauses, so it must state the limit they depend on too.
  assert.match(workspaceCommandProtocolPrompt(2048), /output limit is small \(2048 tokens per reply\)/u);
  assert.ok(!workspaceCommandProtocolPrompt().includes("output limit is small"), "classic: no limit, no hint");
  assert.ok(!piPrompt.includes("output limit is small"), "an unknown limit gets no split hint");
  const { mariMaxOutputTokens } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const smallConnection = (enabledParameters?: Record<string, boolean>) =>
    ({
      id: "small",
      name: "small",
      provider: "custom",
      model: "unknown-model",
      defaultParameters: JSON.stringify({ maxTokens: 1024, enabledParameters }),
    }) as unknown as Parameters<typeof mariMaxOutputTokens>[0];
  assert.equal(mariMaxOutputTokens(smallConnection()), 1024, "the stored Max Output Tokens is the limit");
  assert.equal(
    mariMaxOutputTokens(smallConnection({ maxTokens: false })),
    8192,
    "a Max Output Tokens the send map switches off is not the limit",
  );
  // A failed call points at the handbook for that surface: the one moment the model already knows
  // where it is, and the only reliable nudge a 12b follows.
  const { skillHintForFailedAction } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  assert.match(skillHintForFailedAction("character.update") ?? "", /builtin-characters/u);
  assert.match(skillHintForFailedAction("lorebook.addEntry") ?? "", /builtin-lorebook/u);
  assert.match(skillHintForFailedAction("character.onboarding.update") ?? "", /builtin-onboarding/u);
  assert.equal(skillHintForFailedAction("skill.get"), null, "a failed skill.get does not point at itself");
  assert.equal(skillHintForFailedAction("chat.list"), null, "a read with no handbook gets no hint");

  // Before #7827 this block was 29,217 chars with the whole onboarding procedure inline. A shipped
  // skill must cost the permanent prompt a routing line, not the procedure, so this cap ratchets
  // DOWN as more guides move out; raise it only with a reason a reviewer can see.
  // Raised from 14,900 for the two policy sentences above (about 550 chars): they guard writes
  // that happen without any handbook in context.
  // Lowered from 15,700 after the writing-for-agents pass: router lines now lead with the trigger and
  // carry one silent trap each, and the restated procedures moved into the handbooks (15,593 → 13,555).
  // Raised from 13,700 (+280) for the top-level-id rule and the "first tool round" trigger: 12b/31b
  // put the skill id inside `data` and never reached a handbook, which defeats the whole mechanism
  // (13,621 → 13,900). Raised again (+438) when the "first tool round" wording still did not move a
  // 12b (4 chats, 1 fetch): the gate now names the action it covers, at the top of the reference
  // (13,900 → 14,338). Raised once more (+150) when the patch/verify rule came back: CI's
  // open-issues test caught that moving card guidance into the characters handbook had dropped the
  // permanent "updates are patches / read it back before claiming" rule (14,424 → 14,594). Raised
  // (+1,100) for staging's Game Mode ruleset-sheet bullet (#8063), which has no handbook yet
  // (14,594 → 15,714); moving it into one is the next diet candidate.
  assert.ok(
    knowledge.length < 15_850,
    `the permanent prompt grew (${knowledge.length} >= 15850); move guidance into a skill, or lower this cap when one moves out`,
  );

  // A handbook is not carried into the next turn: it would be cut mid-sentence and crowd out the
  // record being edited. The next turn sees that it was read, and is told to read it again.
  const handbook = shipped.skills.find((skill) => skill.id === "builtin-lorebook")!;
  const card = JSON.stringify({ id: "char-1", description: "c".repeat(6000) });
  const snapshot = buildWorkspaceContinuitySnapshot({
    userText: "Add lore for the tavern.",
    assistantText: "Here is the plan.",
    commandResults: [
      {
        id: "call-1",
        name: "app_data",
        input: { action: "skill.get", id: "builtin-lorebook" },
        output: JSON.stringify(handbook),
        success: true,
      },
      { id: "call-2", name: "app_data", input: { action: "character.get", id: "char-1" }, output: card, success: true },
    ],
  })!;
  // Matched as it is stored: JSON-escaped inside the skill.get output.
  assert.ok(!snapshot.includes(JSON.stringify(handbook.content).slice(1, 200)), "the handbook text is not carried");
  assert.ok(snapshot.includes("call skill.get again"), "the next turn is told to read the handbook again");
  assert.ok(snapshot.includes('"builtin-lorebook"'), "the next turn knows which handbook was read");
  assert.ok(snapshot.includes(card), "the record read after the handbook is kept whole");
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("Professor Mari built-in skills regression checks passed.");

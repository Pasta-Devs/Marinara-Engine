// #6629: actual file-store writes, consent lifecycle and model status; no provider calls.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "mari-decision-authoring-"));
const savedEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createMariInstructionsStorage } =
  await import("../../../packages/server/src/services/storage/mari-instructions.storage.js");
const { createAppSettingsStorage } =
  await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { getProfessorMariWorkspaceSkillsService } =
  await import("../../../packages/server/src/services/professor-mari/workspace-skills.service.js");
const {
  mariDecisionContext,
  recordMariDecisionInteraction,
  withMariDecisionContext,
  introducesMariDecisionContent,
  MARI_DECISION_AUTHORING_PROMPT,
} = await import("../../../packages/server/src/services/professor-mari/decision-authoring.js");
const { readDecisionAuthoringStatus } =
  await import("../../../packages/server/src/services/decision/decision-status.js");
const { activationQuestionSettings } =
  await import("../../../packages/server/src/services/generation/agent-activation-questions.js");
const { DECISION_LOCAL_DEFAULT_SETTINGS_KEY, DECISION_LOCAL_SLOT_IDS, collectDecisionQuestions } =
  await import("../../../packages/shared/src/index.js");

const statement = "The characters are fighting in the latest message";
const conditional = `{{#if decision:"${statement}" sticky:3 cooldown:5}}Be concise.{{else}}Ordinary guidance.{{/if}}`;
assert.equal(collectDecisionQuestions(conditional).length, 1);
assert.equal(collectDecisionQuestions(conditional)[0]!.sticky, 3);
assert.equal(
  introducesMariDecisionContent({ content: conditional }, { content: `Updated preface. ${conditional}` }),
  false,
  "unrelated prose does not add a dependency",
);
assert.equal(
  introducesMariDecisionContent({ content: conditional }, { content: conditional + conditional }),
  true,
  "a duplicate use counts",
);
assert.equal(
  introducesMariDecisionContent({ content: conditional }, { content: "ordinary" }),
  false,
  "removal stays possible",
);
assert.equal(
  introducesMariDecisionContent({ content: conditional }, { content: conditional.replace("sticky:3", "sticky:5") }),
  false,
  "timing edits do not add a dependency",
);
assert.equal(
  introducesMariDecisionContent(
    { activationQuestion: statement, activationThreshold: 0.5 },
    { activationQuestion: statement, activationThreshold: 0.7 },
  ),
  false,
  "threshold tuning does not add a dependency",
);
assert.equal(
  collectDecisionQuestions(MARI_DECISION_AUTHORING_PROMPT).filter((q) => q.kind === "choice").length,
  2,
  "documented choice example parses",
);

const db = await createFileNativeDB();
try {
  const mari = new MariDbService(db);
  const chats = createChatsStorage(db);
  const memories = createMariInstructionsStorage(db);
  const settings = createAppSettingsStorage(db);
  const connections = createConnectionsStorage(db);
  const chat = await chats.create({
    name: "Mari proof",
    mode: "conversation",
    characterIds: [],
    promptPresetId: null,
    connectionId: null,
  });
  assert.ok(chat);
  let context = { db, chatId: chat.id, userMessageId: "" };
  const turn = async (content: string) => {
    const message = await chats.createMessage({ chatId: context.chatId, role: "user", content });
    assert.ok(message);
    context = { ...context, userMessageId: message.id };
  };
  const write = (action: string, data: Record<string, unknown>, other: Record<string, unknown> = {}) =>
    withMariDecisionContext(context, () => mari.executeAction({ action, data, apply: true, ...other }));
  const record = (data: unknown) => recordMariDecisionInteraction(context, data);
  const assertOk = (result: { ok: boolean; error?: string }) => assert.equal(result.ok, true, JSON.stringify(result));
  const findId = async (action: string, name: string) => {
    const result = await mari.executeAction({ action });
    const id = (result.output as Array<{ id: string; name: string }>).find((row) => row.name === name)?.id;
    assert.ok(id, `${action}: ${name}`);
    return id;
  };

  assert.equal((await readDecisionAuthoringStatus(db)).state, "none");
  const hosted = await connections.create({
    name: "Decision test",
    provider: "decision",
    model: "fixture",
    defaultForAgents: false,
  });
  assert.ok(hosted);
  assert.equal((await readDecisionAuthoringStatus(db)).state, "none", "merely saving a connection does not select it");
  await connections.update(hosted.id, { defaultForAgents: true });
  assert.deepEqual((await readDecisionAuthoringStatus(db)).state, "selected");
  assert.equal((await readDecisionAuthoringStatus(db)).health, "untested");
  await settings.set(DECISION_LOCAL_DEFAULT_SETTINGS_KEY, DECISION_LOCAL_SLOT_IDS.primary);
  const local = await readDecisionAuthoringStatus(db);
  assert.equal(local.selected, DECISION_LOCAL_SLOT_IDS.primary, "local slot wins over a saved hosted connection");
  assert.equal(local.state, "unavailable", "a selected unconfigured local slot is not reported as no selection");
  await settings.remove(DECISION_LOCAL_DEFAULT_SETTINGS_KEY);
  await connections.update(hosted.id, { defaultForAgents: false });
  const failedDb = {
    select: () => {
      throw new Error("fixture unavailable");
    },
  } as unknown as typeof db;
  assert.equal((await readDecisionAuthoringStatus(failedDb)).state, "unknown");

  await turn("Create an ordinary character.");
  assertOk(await write("character.create", { name: "Ordinary", description: "A traveler." }));
  let result = await write("character.create", { name: "Blocked", description: conditional });
  assert.equal(result.ok, false, "ordinary request cannot introduce Decision content");
  const preview = await write(
    "character.create",
    { name: "Decision preview", description: conditional },
    { apply: false },
  );
  assertOk(preview);
  assert.equal(preview.mode, "dry-run", "preparing a reviewable plan does not require permission to persist it");
  assert.equal(
    ((await mari.executeAction({ action: "character.list" })).output as Array<{ name: string }>).some(
      (row) => row.name === "Decision preview",
    ),
    false,
    "a consent-free preview does not persist authored content",
  );
  await turn("Add Decision guidance to my character.");
  await record({ category: "authoring", answer: "allow", quote: "Add Decision guidance to my character." });
  result = await write("character.create", { name: "Blocked", description: conditional });
  assert.equal(result.ok, false, "explicit authoring permission still requires the missing-model acknowledgment");
  await record({ category: "setupReminder", answer: "pending" });
  await assert.rejects(
    record({ category: "setupReminder", answer: "allow", quote: "Add Decision guidance to my character." }),
    /new user reply/,
    "Mari cannot answer her own warning in the same run",
  );
  const firstPending = (await mariDecisionContext(context)).interactions.setupReminder;
  await record({ category: "setupReminder", answer: "pending" });
  assert.deepEqual(
    (await mariDecisionContext(context)).interactions.setupReminder,
    firstPending,
    "retry preserves the original question",
  );
  await turn("No, leave Decisions out.");
  await record({ category: "setupReminder", answer: "decline", quote: "No, leave Decisions out." });
  await turn("Add Decision guidance to my character.");
  await record({ category: "authoring", answer: "allow", quote: "Add Decision guidance to my character." });
  assert.equal(
    (await write("character.create", { name: "Blocked", description: conditional })).ok,
    false,
    "decline is not erased by the next content request",
  );
  await turn("Yes, proceed without a model, and use Decisions for this chat.");
  for (const category of ["setupReminder", "authoring"])
    await record({
      category,
      answer: "allow",
      quote: "Yes, proceed without a model, and use Decisions for this chat.",
      scope: "chat",
    });
  assertOk(await write("character.create", { name: "Decision card", description: conditional }));
  assertOk(await write("persona.create", { name: "Decision persona", description: conditional }));
  assertOk(
    await write("lorebook.create", {
      name: "Decision lore",
      entries: [
        {
          name: "Fight",
          content: "Battle lore",
          decisionMode: "trigger",
          decisionStatement: statement,
          sticky: 3,
          cooldown: 5,
        },
      ],
    }),
  );
  const bookId = await findId("lorebook.list", "Decision lore");
  const entries = (await mari.executeAction({ action: "lorebook.entries", lorebookId: bookId })).output as Array<{
    id: string;
  }>;
  assert.ok(entries.length);
  const entryId = entries[0]!.id;
  const getEntry = async () =>
    (await mari.executeAction({ action: "lorebook.getEntry", entryId })).output as Record<string, unknown>;
  assert.equal((await getEntry()).decisionStatement, statement);
  assert.equal((await getEntry()).sticky, 3);
  assertOk(
    await write(
      "lorebook.updateEntry",
      { decisionMode: "require", decisionStatement: "A fight just ended.", cooldown: 4 },
      { entryId },
    ),
  );
  assert.equal((await getEntry()).decisionMode, "require");
  assert.equal((await write("lorebook.updateEntry", { decisionMode: "invalid" }, { entryId })).ok, false);
  assertOk(await write("lorebook.addEntry", { name: "Extra", content: conditional }, { lorebookId: bookId }));
  assertOk(
    await write("preset.create", {
      name: "Decision preset",
      sections: [
        { name: "Stable", content: "Keep the prefix stable." },
        { name: "Optional", content: conditional },
      ],
      choiceBlocks: [{ variableName: "style", question: "Style", options: [{ label: "Timed", value: conditional }] }],
    }),
  );
  assertOk(
    await write("agent.create", {
      name: "Decision agent",
      phase: "post_processing",
      settings: { activationQuestion: statement, activationThreshold: 0.7, runInterval: 3, unrelated: "keep" },
      promptTemplate: conditional,
    }),
  );
  const agentId = await findId("agent.list", "Decision agent");
  const readAgent = async () =>
    (await mari.executeAction({ action: "agent.get", id: agentId })).output as { settings: Record<string, unknown> };
  assert.equal(activationQuestionSettings((await readAgent()).settings)?.threshold, 0.7);
  for (const patch of [
    { activationThreshold: 1.2 },
    { activationScanDepth: 0 },
    { activationMaxSkip: 101 },
    { activationQuestion: "x".repeat(501) },
    { runInterval: 0 },
  ]) {
    assert.equal((await write("agent.update", { settings: patch }, { id: agentId })).ok, false, JSON.stringify(patch));
  }
  assert.equal(
    activationQuestionSettings((await readAgent()).settings)?.threshold,
    0.7,
    "rejected update preserves the valid gate",
  );
  assertOk(await write("agent.update", { settings: { activationQuestion: "The scene changed." } }, { id: agentId }));
  assert.equal((await readAgent()).settings.unrelated, "keep");
  assert.equal((await readAgent()).settings.runInterval, 3);
  assertOk(
    await write("agent.update", { settings: { activationQuestion: "", activationThreshold: null } }, { id: agentId }),
  );
  assert.equal((await readAgent()).settings.activationQuestion, undefined, "explicit clearing removes the setting");
  assert.equal((await readAgent()).settings.unrelated, "keep");

  // Chat metadata survives service re-creation and history longer than Mari's 40-message window.
  for (let i = 0; i < 45; i++) await turn(`Unrelated message ${i}`);
  const continued = await mariDecisionContext({ ...context });
  assert.equal((continued.interactions.setupReminder as { answer: string }).answer, "allow");
  const cardId = await findId("character.list", "Decision card");
  // A new chat has no local permissions, but unrelated edits/removing Decisions remain possible.
  const chat2 = await chats.create({
    name: "New Mari chat",
    mode: "conversation",
    characterIds: [],
    promptPresetId: null,
    connectionId: null,
  });
  assert.ok(chat2);
  context = { ...context, chatId: chat2.id };
  await turn("Rename the card.");
  assert.deepEqual((await mariDecisionContext(context)).interactions, {});
  assertOk(await write("character.update", { name: "Renamed" }, { characterId: cardId }));
  assert.equal(
    (await write("character.update", { description: conditional + conditional }, { characterId: cardId })).ok,
    false,
  );
  const rawBlocked = await withMariDecisionContext(context, () =>
    mari.executeCli({
      argv: [
        "db",
        "patch",
        "lorebook_entries",
        entryId,
        "--json",
        JSON.stringify({ decisionStatement: "A new event occurs." }),
        "--apply",
      ],
    }),
  );
  assert.equal(rawBlocked.ok, false, "raw CLI cannot bypass the authoring boundary");
  assert.match(rawBlocked.error ?? "", /Decision content/);

  // Cross-chat suppression uses a real enabled Memory, never a disabled draft or title alone.
  await turn("Stop reminding me to set up a Decision model. Remember that.");
  await record({
    category: "setupReminder",
    answer: "suppress",
    quote: "Stop reminding me to set up a Decision model.",
  });
  assertOk(
    await write("instruction.remember", {
      name: "Decision setup reminders",
      description: "Do not repeat setup reminders.",
      content: "Do not remind me to set up a Decision model in future chats.",
    }),
  );
  const memory = (await memories.list())[0]!;
  assert.equal(memory.enabled, false);
  const memoryRecord = {
    category: "setupReminder",
    answer: "suppress",
    source: "memory",
    sourceId: memory.id,
    quote: memory.content,
  };
  await assert.rejects(record(memoryRecord), /enabled Memory/);
  const approval = mari
    .getPendingApprovals()
    .find((item) => item.diffPreview.some((change) => change.table === "mari_instructions"));
  assert.ok(approval);
  await mari.keepAppliedReview(approval.id, { enable: true });
  assert.equal((await memories.get(memory.id))?.enabled, true);
  const chat3 = await chats.create({
    name: "Remembered preference",
    mode: "conversation",
    characterIds: [],
    promptPresetId: null,
    connectionId: null,
  });
  assert.ok(chat3);
  context = { ...context, chatId: chat3.id };
  await turn("Make another Decision entry.");
  await record(memoryRecord);
  assert.equal(
    (await write("lorebook.addEntry", { name: "Suppressed only", content: conditional }, { lorebookId: bookId })).ok,
    false,
    "suppressing reminders does not permit unsolicited Decisions",
  );
  await record({ category: "authoring", answer: "allow", quote: "Make another Decision entry." });
  assertOk(await write("lorebook.addEntry", { name: "Requested", content: conditional }, { lorebookId: bookId }));
  await memories.update(memory.id, { enabled: false });
  assert.equal(
    (await write("lorebook.addEntry", { name: "Disabled memory", content: conditional }, { lorebookId: bookId })).ok,
    false,
    "disabling the source invalidates cached suppression",
  );
  await memories.update(memory.id, { enabled: true });

  // Task-specific permission expires, while an enabled standing authoring preference can apply anew.
  await turn("Make an ordinary entry.");
  assert.equal(
    (await write("lorebook.addEntry", { name: "Unsolicited", content: conditional }, { lorebookId: bookId })).ok,
    false,
  );
  await connections.update(hosted.id, { defaultForAgents: true });
  const skillService = getProfessorMariWorkspaceSkillsService();
  const skill = await skillService.create({
    name: "Decision preference",
    content: "Use Decisions sparingly in my lorebooks.",
    enabled: true,
  });
  await record({
    category: "authoring",
    answer: "allow",
    source: "skill",
    sourceId: skill.id,
    quote: "Use Decisions sparingly in my lorebooks.",
  });
  assertOk(
    await write("lorebook.addEntry", { name: "Skill preference", content: conditional }, { lorebookId: bookId }),
  );
  await connections.update(hosted.id, { defaultForAgents: false });
  assert.equal(
    (
      await write(
        "lorebook.addEntry",
        { name: "No unsolicited dependency", content: conditional },
        { lorebookId: bookId },
      )
    ).ok,
    false,
    "standing authoring permission plus suppressed reminders does not add dependencies without a model",
  );
  await connections.update(hosted.id, { defaultForAgents: true });
  await skillService.update(skill.id, { enabled: false });
  assert.equal(
    (await write("lorebook.addEntry", { name: "Disabled skill", content: conditional }, { lorebookId: bookId })).ok,
    false,
  );

  // Placement permission is separate, including when no Decision syntax is present.
  assert.equal(
    (
      await write(
        "lorebook.addEntry",
        { name: "History", content: "Ordinary lore", position: 2, depth: 4 },
        { lorebookId: bookId },
      )
    ).ok,
    false,
  );
  await turn("Put that lore inside chat history; I accept the cache impact.");
  await record({
    category: "cachePlacement",
    answer: "allow",
    quote: "Put that lore inside chat history; I accept the cache impact.",
  });
  assertOk(
    await write(
      "lorebook.addEntry",
      { name: "History", content: "Ordinary lore", position: 2, depth: 4 },
      { lorebookId: bookId },
    ),
  );

  // A negative standing authoring Memory applies with a selected model; explicit new instructions
  // can override it for a task. Short/non-English answers must not become an English keyword gate.
  const preference = await memories.create({
    name: "Decision use",
    content: "Do not add Decisions to my content.",
    enabled: true,
  });
  await record({
    category: "authoring",
    answer: "decline",
    source: "memory",
    sourceId: preference.id,
    quote: preference.content,
  });
  assert.equal(
    (await write("lorebook.addEntry", { name: "Declined preference", content: conditional }, { lorebookId: bookId }))
      .ok,
    false,
  );
  await turn("好");
  await record({ category: "authoring", answer: "allow", quote: "好" });
  assertOk(await write("lorebook.addEntry", { name: "Task override", content: conditional }, { lorebookId: bookId }));
  await memories.update(preference.id, { content: "Use Decisions sparingly when a model is selected." });
  const positivePreference = (await memories.get(preference.id))!;
  await turn("Another entry, please.");
  await record({
    category: "authoring",
    answer: "allow",
    source: "memory",
    sourceId: preference.id,
    quote: positivePreference.content,
  });
  assertOk(await write("lorebook.addEntry", { name: "Remembered use", content: conditional }, { lorebookId: bookId }));
  await memories.remove(preference.id);
  assert.equal(
    (await write("lorebook.addEntry", { name: "Deleted preference", content: conditional }, { lorebookId: bookId })).ok,
    false,
  );

  const forged = await withMariDecisionContext(context, () =>
    mari.executeCli({
      argv: [
        "db",
        "patch",
        "chats",
        context.chatId,
        "--json",
        JSON.stringify({ metadata: JSON.stringify({ mariDecisionAuthoring: {} }) }),
        "--apply",
      ],
    }),
  );
  assert.equal(forged.ok, false, "raw metadata cannot reset or forge authoring permission");
  assert.match(JSON.stringify(forged.validation), /decision.record/);
  console.log(
    "Mari Decision authoring: status, write paths, consent, long/new chats, Memory/Skill lifecycle and validation passed.",
  );
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

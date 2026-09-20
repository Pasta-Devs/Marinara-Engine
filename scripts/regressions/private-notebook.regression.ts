import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-private-notebook-"));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

type TestApp = {
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<{
    statusCode: number;
    json(): any;
    headers: Record<string, string | string[] | undefined>;
  }>;
  ready(): Promise<void>;
};

let app: TestApp | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { flushDB, getDB } = await import("../../packages/server/src/db/connection.js");
  const { encodeShardKey } = await import("../../packages/server/src/db/file-backed-store.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  const { appSettings, characters, chats } = await import("../../packages/server/src/db/schema/index.js");
  const { getMariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
  const { runMariTransformSandbox } =
    await import("../../packages/server/src/services/mari-db/mari-transform-sandbox.js");
  const { assemblePrompt } = await import("../../packages/server/src/services/prompt/assembler.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { ProfessorMariWorkspaceService } =
    await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { isProfessorMariPrivateDataPath, professorMariCodePathspecs } =
    await import("../../packages/server/src/services/professor-mari/workspace-change-review.service.js");
  const { PRIVATE_NOTEBOOK_SETTINGS_PREFIX } = await import("../../packages/shared/src/index.js");

  app = (await buildApp()) as TestApp;
  await app.ready();
  const db = await getDB();
  const timestamp = new Date().toISOString();

  await db.insert(characters).values([
    { id: "character-a", data: "{}", createdAt: timestamp, updatedAt: timestamp },
    { id: "character-b", data: "{}", createdAt: timestamp, updatedAt: timestamp },
    { id: "character-delete", data: "{}", createdAt: timestamp, updatedAt: timestamp },
  ]);
  await db.insert(chats).values([
    {
      id: "chat-a",
      name: "Notebook A",
      mode: "roleplay",
      characterIds: JSON.stringify(["character-a"]),
      groupId: "family-a",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-b",
      name: "Notebook B",
      mode: "roleplay",
      characterIds: JSON.stringify(["character-a"]),
      groupId: "family-a",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-c",
      name: "Notebook C",
      mode: "roleplay",
      characterIds: JSON.stringify(["character-b"]),
      groupId: "family-b",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-ungrouped",
      name: "Notebook ungrouped",
      mode: "conversation",
      characterIds: JSON.stringify(["character-a"]),
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-missing-character",
      name: "Notebook stale character",
      mode: "roleplay",
      characterIds: JSON.stringify(["missing-character"]),
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-corrupt",
      name: "Notebook corrupt row",
      mode: "roleplay",
      characterIds: "[]",
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-future",
      name: "Notebook future row",
      mode: "roleplay",
      characterIds: "[]",
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-unsafe-revision",
      name: "Notebook unsafe revision row",
      mode: "roleplay",
      characterIds: "[]",
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-delete-a",
      name: "Notebook lifecycle A",
      mode: "roleplay",
      characterIds: "[]",
      groupId: "family-delete",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-delete-b",
      name: "Notebook lifecycle B",
      mode: "roleplay",
      characterIds: "[]",
      groupId: "family-delete",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-delete-group-a",
      name: "Notebook group lifecycle A",
      mode: "roleplay",
      characterIds: "[]",
      groupId: "family-delete-group",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-delete-group-b",
      name: "Notebook group lifecycle B",
      mode: "roleplay",
      characterIds: "[]",
      groupId: "family-delete-group",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "chat-delete-character",
      name: "Notebook character lifecycle",
      mode: "roleplay",
      characterIds: JSON.stringify(["character-delete"]),
      groupId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]);

  const getContext = async (chatId: string) => {
    const response = await app!.inject({ method: "GET", url: `/api/private-notebook/chats/${chatId}` });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const save = (chatId: string, target: Record<string, string>, content: string, expectedRevision: number) =>
    app!.inject({
      method: "PUT",
      url: `/api/private-notebook/chats/${chatId}`,
      payload: { target, content, expectedRevision },
    });
  const findDocument = (context: any, scope: string, characterId?: string) =>
    context.documents.find(
      (document: any) =>
        document.target.scope === scope && (scope !== "character" || document.target.characterId === characterId),
    );

  const initial = await getContext("chat-a");
  assert.equal(initial.groupId, "family-a");
  assert.deepEqual(initial.characterIds, ["character-a"]);
  assert.deepEqual(
    initial.documents.map((document: any) => document.target.scope),
    ["global", "character", "chat", "branch-family"],
  );
  assert(initial.documents.every((document: any) => document.revision === 0 && document.content === ""));

  const uncachedRead = await app.inject({ method: "GET", url: "/api/private-notebook/chats/chat-a" });
  assert.equal(uncachedRead.headers["cache-control"], "no-store");

  assert.equal((await save("chat-a", { scope: "global" }, "global note", 0)).statusCode, 200);
  assert.equal(
    (await save("chat-a", { scope: "character", characterId: "character-a" }, "character note", 0)).statusCode,
    200,
  );
  assert.equal((await save("chat-a", { scope: "chat" }, "chat-a note", 0)).statusCode, 200);
  assert.equal((await save("chat-a", { scope: "branch-family" }, "family-a note", 0)).statusCode, 200);

  const sibling = await getContext("chat-b");
  assert.equal(findDocument(sibling, "global").content, "global note");
  assert.equal(findDocument(sibling, "character", "character-a").content, "character note");
  assert.equal(findDocument(sibling, "chat").content, "");
  assert.equal(findDocument(sibling, "branch-family").content, "family-a note");

  const unrelated = await getContext("chat-c");
  assert.equal(findDocument(unrelated, "global").content, "global note");
  assert.equal(findDocument(unrelated, "character", "character-b").content, "");
  assert.equal(findDocument(unrelated, "chat").content, "");
  assert.equal(findDocument(unrelated, "branch-family").content, "");

  const chatsStorage = createChatsStorage(db);
  const charactersStorage = createCharactersStorage(db);
  const notebookRowExists = async (key: string) =>
    (await db.select({ key: appSettings.key }).from(appSettings).where(eq(appSettings.key, key)).limit(1)).length === 1;
  const lifecycleKey = (suffix: string) => `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}${suffix}`;

  assert.equal((await save("chat-delete-a", { scope: "chat" }, "delete chat A", 0)).statusCode, 200);
  assert.equal((await save("chat-delete-b", { scope: "chat" }, "delete chat B", 0)).statusCode, 200);
  assert.equal(
    (await save("chat-delete-a", { scope: "branch-family" }, "shared family survives one sibling", 0)).statusCode,
    200,
  );
  await chatsStorage.remove("chat-delete-a");
  assert.equal((await db.select().from(chats).where(eq(chats.id, "chat-delete-a"))).length, 0);
  assert.equal(await notebookRowExists(lifecycleKey("chat:chat-delete-a")), false);
  assert.equal(await notebookRowExists(lifecycleKey("family:family-delete")), true);
  assert.equal(
    findDocument(await getContext("chat-delete-b"), "branch-family").content,
    "shared family survives one sibling",
  );
  await chatsStorage.remove("chat-delete-b");
  assert.equal(await notebookRowExists(lifecycleKey("chat:chat-delete-b")), false);
  assert.equal(await notebookRowExists(lifecycleKey("family:family-delete")), false);

  assert.equal((await save("chat-delete-group-a", { scope: "chat" }, "delete group A", 0)).statusCode, 200);
  assert.equal((await save("chat-delete-group-b", { scope: "chat" }, "delete group B", 0)).statusCode, 200);
  assert.equal(
    (await save("chat-delete-group-a", { scope: "branch-family" }, "delete whole family", 0)).statusCode,
    200,
  );
  await chatsStorage.removeGroup("family-delete-group");
  assert.equal((await db.select().from(chats).where(eq(chats.groupId, "family-delete-group"))).length, 0);
  assert.equal(await notebookRowExists(lifecycleKey("chat:chat-delete-group-a")), false);
  assert.equal(await notebookRowExists(lifecycleKey("chat:chat-delete-group-b")), false);
  assert.equal(await notebookRowExists(lifecycleKey("family:family-delete-group")), false);

  assert.equal(
    (
      await save(
        "chat-delete-character",
        { scope: "character", characterId: "character-delete" },
        "delete character note",
        0,
      )
    ).statusCode,
    200,
  );
  await charactersStorage.remove("character-delete");
  assert.equal((await db.select().from(characters).where(eq(characters.id, "character-delete"))).length, 0);
  assert.equal(await notebookRowExists(lifecycleKey("character:character-delete")), false);
  assert.deepEqual((await getContext("chat-delete-character")).characterIds, []);
  assert.equal(findDocument(await getContext("chat-c"), "global").content, "global note");

  const inactiveCharacter = await save(
    "chat-a",
    { scope: "character", characterId: "character-b" },
    "must not save",
    0,
  );
  assert.equal(inactiveCharacter.statusCode, 400);
  assert.equal(inactiveCharacter.json().code, "scope-unavailable");

  const missingCharacter = await save(
    "chat-missing-character",
    { scope: "character", characterId: "missing-character" },
    "must not save",
    0,
  );
  assert.equal(missingCharacter.statusCode, 400);
  assert.equal(missingCharacter.json().code, "scope-unavailable");
  assert.deepEqual((await getContext("chat-missing-character")).characterIds, []);

  const unavailableFamily = await save("chat-ungrouped", { scope: "branch-family" }, "must not save", 0);
  assert.equal(unavailableFamily.statusCode, 400);
  assert.equal(unavailableFamily.json().code, "scope-unavailable");
  assert.equal(findDocument(await getContext("chat-ungrouped"), "branch-family"), undefined);

  const rawSettingsRead = await app.inject({
    method: "GET",
    url: "/api/app-settings/private-notebook:v1:global",
  });
  assert.equal(rawSettingsRead.statusCode, 404, "the generic app-settings route must not expose notebook rows");

  const unknownField = await app.inject({
    method: "PUT",
    url: "/api/private-notebook/chats/chat-a",
    payload: { target: { scope: "chat" }, content: "must not save", expectedRevision: 1, key: "raw-key" },
  });
  assert.equal(unknownField.statusCode, 400, "the update contract must reject raw keys and unknown fields");

  const oversized = await save("chat-a", { scope: "chat" }, "x".repeat(100_001), 1);
  assert.equal(oversized.statusCode, 400, "documents over the shared character limit must be rejected");
  const unsafeExpectedRevision = await save(
    "chat-a",
    { scope: "global" },
    "must not save",
    Number.MAX_SAFE_INTEGER + 1,
  );
  assert.equal(unsafeExpectedRevision.statusCode, 400, "unsafe expected revisions must be rejected");

  const race = await Promise.all([
    save("chat-a", { scope: "chat" }, "race winner one", 1),
    save("chat-a", { scope: "chat" }, "race winner two", 1),
  ]);
  assert.deepEqual(
    race.map((response) => response.statusCode).sort((a, b) => a - b),
    [200, 409],
  );
  const raceSuccess = race.find((response) => response.statusCode === 200)!.json();
  const raceConflict = race.find((response) => response.statusCode === 409)!.json();
  assert.equal(raceSuccess.revision, 2);
  assert.equal(raceConflict.code, "revision-conflict");
  assert.equal(raceConflict.document.revision, 2);
  assert.equal(raceConflict.document.content, raceSuccess.content);

  const emptied = await save("chat-a", { scope: "chat" }, "", raceSuccess.revision);
  assert.equal(emptied.statusCode, 200);
  assert.equal(emptied.headers["cache-control"], "no-store");
  assert.equal(emptied.json().revision, 3);
  assert.equal(emptied.json().content, "");

  const promptIsolationSentinel = "PRIVATE_NOTEBOOK_SENTINEL_MUST_NEVER_REACH_THE_MODEL_847192";
  assert.equal((await save("chat-c", { scope: "chat" }, promptIsolationSentinel, 0)).statusCode, 200);
  const durableChatKey = `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:chat-c`;
  const durableShardPath = join(dataDir, "storage", "tables", "app_settings", `${encodeShardKey(durableChatKey)}.json`);
  const durableRows = JSON.parse(readFileSync(durableShardPath, "utf8")) as Array<{ key: string; value: string }>;
  const durableRow = durableRows.find((row) => row.key === durableChatKey);
  assert.equal(
    JSON.parse(durableRow?.value ?? "null")?.content,
    promptIsolationSentinel,
    "a successful PUT must land its exact notebook revision on disk before responding",
  );

  const nestedDurableKey = `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:nested-durable`;
  const nestedDurablePath = join(
    dataDir,
    "storage",
    "tables",
    "app_settings",
    `${encodeShardKey(nestedDurableKey)}.json`,
  );
  await db.transaction(async (outer) => {
    await outer
      .insert(appSettings)
      .values({ key: nestedDurableKey, value: JSON.stringify({ content: "nested" }), updatedAt: timestamp });
    await db.transaction(async () => undefined, { durable: true });
  });
  const nestedDurableRows = JSON.parse(readFileSync(nestedDurablePath, "utf8")) as Array<{
    key: string;
    value: string;
  }>;
  assert.equal(
    JSON.parse(nestedDurableRows.find((row) => row.key === nestedDurableKey)?.value ?? "null")?.content,
    "nested",
    "a nested durable request must upgrade the outer transaction before it returns",
  );

  const nestedRollbackKey = `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:nested-rollback`;
  const nestedRollbackPath = join(
    dataDir,
    "storage",
    "tables",
    "app_settings",
    `${encodeShardKey(nestedRollbackKey)}.json`,
  );
  await assert.rejects(
    db.transaction(async (outer) => {
      await outer
        .insert(appSettings)
        .values({ key: nestedRollbackKey, value: JSON.stringify({ content: "rolled-back" }), updatedAt: timestamp });
      await db.transaction(async () => undefined, { durable: true });
      throw new Error("nested durable rollback probe");
    }),
    /nested durable rollback probe/,
  );
  assert.equal(
    existsSync(nestedRollbackPath),
    false,
    "a rolled-back nested durable transaction must not leave a disk row",
  );
  const assembled = await assemblePrompt({
    db,
    preset: {
      id: "private-notebook-prompt-isolation",
      name: "Private Notebook prompt isolation",
      sectionOrder: JSON.stringify(["main"]),
      groupOrder: JSON.stringify([]),
      wrapFormat: "xml",
      parameters: JSON.stringify({}),
      variableGroups: JSON.stringify([]),
      variableValues: JSON.stringify({}),
    },
    sections: [
      {
        id: "main",
        presetId: "private-notebook-prompt-isolation",
        identifier: "main",
        name: "Main",
        content: "Ordinary prompt content.",
        role: "system",
        enabled: "true",
        isMarker: "false",
        groupId: null,
        markerConfig: null,
        injectionPosition: "ordered",
        injectionDepth: 0,
        injectionOrder: 0,
        forbidOverrides: "false",
      },
    ],
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "chat-c",
    characterIds: [],
    personaName: "User",
    personaDescription: "",
    chatMessages: [{ role: "user", content: "Hello" }],
    disableLorebooks: true,
    enableAgents: false,
  });
  assert.doesNotMatch(
    assembled.messages.map((message) => message.content).join("\n"),
    new RegExp(promptIsolationSentinel),
    "private notebook app-settings rows must not enter assembled model prompts",
  );

  const corruptKey = "private-notebook:v1:chat:chat-corrupt";
  const futureKey = "private-notebook:v1:chat:chat-future";
  const unsafeRevisionKey = "private-notebook:v1:chat:chat-unsafe-revision";
  const corruptValue = "{not-json";
  const futureValue = JSON.stringify({ schemaVersion: 2, content: "future private note", revision: 1 });
  const unsafeRevisionValue = JSON.stringify({
    schemaVersion: 1,
    content: "unsafe revision private note",
    revision: Number.MAX_SAFE_INTEGER + 1,
  });
  await db.insert(appSettings).values([
    { key: corruptKey, value: corruptValue, updatedAt: timestamp },
    { key: futureKey, value: futureValue, updatedAt: timestamp },
    { key: unsafeRevisionKey, value: unsafeRevisionValue, updatedAt: timestamp },
  ]);

  for (const chatId of ["chat-corrupt", "chat-future", "chat-unsafe-revision"]) {
    const read = await app.inject({ method: "GET", url: `/api/private-notebook/chats/${chatId}` });
    assert.equal(read.statusCode, 409);
    assert.equal(read.json().code, "stored-document-unreadable");
    const write = await save(chatId, { scope: "chat" }, "must not replace stored data", 0);
    assert.equal(write.statusCode, 409);
    assert.equal(write.json().code, "stored-document-unreadable");
  }
  assert.equal(
    (await db.select().from(appSettings).where(eq(appSettings.key, corruptKey)).limit(1))[0]?.value,
    corruptValue,
  );
  assert.equal(
    (await db.select().from(appSettings).where(eq(appSettings.key, futureKey)).limit(1))[0]?.value,
    futureValue,
  );
  assert.equal(
    (await db.select().from(appSettings).where(eq(appSettings.key, unsafeRevisionKey)).limit(1))[0]?.value,
    unsafeRevisionValue,
  );

  await db.insert(chats).values({
    id: "chat-mari-family-owner",
    name: "Notebook Mari family owner guard",
    mode: "roleplay",
    characterIds: "[]",
    groupId: "family-mari-owner",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  assert.equal(
    (await save("chat-mari-family-owner", { scope: "branch-family" }, "family note must not be orphaned by Mari", 0))
      .statusCode,
    200,
  );

  const mariDb = getMariDbService(db);
  await db.insert(appSettings).values({ key: "ordinary-regression-setting", value: "visible", updatedAt: timestamp });
  const assertPrivateDataAbsent = (value: unknown, label: string) => {
    const serialized = JSON.stringify(value) ?? "";
    assert.doesNotMatch(serialized, /private-notebook:v1:/u, `${label} must not disclose a notebook key`);
    assert.doesNotMatch(serialized, new RegExp(promptIsolationSentinel), `${label} must not disclose notebook content`);
  };
  for (const [label, argv] of [
    ["list", ["db", "list", "app_settings", "--limit", "1000"]],
    ["get", ["db", "get", "app_settings", `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:chat-c`]],
    ["select", ["db", "select", "app_settings", "--limit", "5000"]],
    ["table search", ["db", "search", "app_settings", promptIsolationSentinel]],
    ["all-table search", ["db", "search", "all", promptIsolationSentinel]],
    ["validate", ["db", "validate", "--table", "app_settings"]],
  ] as const) {
    const result = await mariDb.executeCli({ argv: [...argv] });
    assertPrivateDataAbsent(result.output ?? result.validation ?? result.error, `mari db ${label}`);
  }
  const visibleSettingsCount = (await db.select().from(appSettings)).filter(
    (row) => !row.key.startsWith(PRIVATE_NOTEBOOK_SETTINGS_PREFIX),
  ).length;
  const counts = await mariDb.executeCli({ argv: ["db", "counts"] });
  assert.equal((counts.output as Record<string, number>).app_settings, visibleSettingsCount);

  const globalKey = `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}global`;
  const globalBefore = (await db.select().from(appSettings).where(eq(appSettings.key, globalKey)).limit(1))[0];
  const deniedMutations = [
    [
      "insert",
      [
        "db",
        "insert",
        "app_settings",
        "--json",
        JSON.stringify({ key: `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:forged`, value: "forged private text" }),
      ],
    ],
    ["patch", ["db", "patch", "app_settings", globalKey, "--json", JSON.stringify({ value: "tampered" })]],
    [
      "replace",
      [
        "db",
        "replace",
        "app_settings",
        globalKey,
        "--json",
        JSON.stringify({ key: globalKey, value: "tampered", updatedAt: timestamp }),
      ],
    ],
    ["delete by id", ["db", "delete", "app_settings", globalKey]],
    [
      "delete by selector",
      ["db", "delete", "app_settings", "--where", `row.key.startsWith("${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}")`],
    ],
  ] as const;
  for (const [label, argv] of deniedMutations) {
    const result = await mariDb.executeCli({ argv: [...argv] });
    assert.equal(result.ok, false, `mari db ${label} must be denied`);
    assert.match(result.error ?? "", /Private notebook data cannot be accessed/u);
    assert.doesNotMatch(result.error ?? "", /private-notebook:v1:/u, "denials must not echo the protected key");
  }
  assert.deepEqual(
    (await db.select().from(appSettings).where(eq(appSettings.key, globalKey)).limit(1))[0],
    globalBefore,
  );

  for (const [label, table, id] of [
    ["chat note owner", "chats", "chat-c"],
    ["character note owner", "characters", "character-a"],
    ["last family-note owner", "chats", "chat-mari-family-owner"],
  ] as const) {
    const result = await mariDb.executeCli({ argv: ["db", "delete", table, id] });
    assert.equal(result.ok, false, `mari db must not delete the ${label}`);
    assert.match(result.error ?? "", /Private notebook data cannot be accessed/u);
    assertPrivateDataAbsent(result, `mari db ${label} deletion denial`);
  }
  assert.equal((await db.select().from(chats).where(eq(chats.id, "chat-c")).limit(1)).length, 1);
  assert.equal((await db.select().from(characters).where(eq(characters.id, "character-a")).limit(1)).length, 1);
  assert.equal((await db.select().from(chats).where(eq(chats.id, "chat-mari-family-owner")).limit(1)).length, 1);

  const internalMari = mariDb as unknown as {
    planTransform: (...args: unknown[]) => Promise<unknown[]>;
    planMutation: (request: Record<string, unknown>, command: string) => Promise<unknown>;
    applyPlan: (plan: unknown) => Promise<string>;
  };
  const originalPlanTransform = internalMari.planTransform;
  internalMari.planTransform = async () => [
    {
      table: "app_settings",
      id: `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:forged-transform`,
      action: "insert",
      before: null,
      after: { key: `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:forged-transform`, value: "forged" },
      beforeRaw: null,
      afterRaw: { key: `${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:forged-transform`, value: "forged" },
      apply: true,
    },
  ];
  try {
    await assert.rejects(
      internalMari.planMutation(
        { kind: "transform", table: "all", scriptPath: "unused.mjs", apply: false, cascade: true, reason: null },
        "mari db transform all unused.mjs",
      ),
      /Private notebook data cannot be accessed/u,
      "transform-generated notebook rows must be rejected centrally",
    );

    internalMari.planTransform = async () => [
      {
        table: "characters",
        id: "character-a",
        action: "delete",
        before: { id: "character-a" },
        after: null,
        beforeRaw: { id: "character-a" },
        afterRaw: null,
        apply: true,
      },
    ];
    await assert.rejects(
      internalMari.planMutation(
        { kind: "transform", table: "all", scriptPath: "unused.mjs", apply: false, cascade: true, reason: null },
        "mari db transform all unused.mjs",
      ),
      /Private notebook data cannot be accessed/u,
      "transform-generated owner deletion must not orphan a private notebook row",
    );
  } finally {
    internalMari.planTransform = originalPlanTransform;
  }

  const transformInputProbe = join(dataDir, "transform-input-probe.mjs");
  writeFileSync(
    transformInputProbe,
    `export default (row, context) => row.key === "ordinary-regression-setting"
      ? ({ update: { value: JSON.stringify({ privateRowsVisible: context.find("app_settings", candidate => String(candidate.key).startsWith(${JSON.stringify(PRIVATE_NOTEBOOK_SETTINGS_PREFIX)})).length }) } })
      : undefined;\n`,
    "utf8",
  );
  const transformInputProbeResult = await mariDb.executeCli({
    argv: ["db", "transform", "app_settings", transformInputProbe],
    cwd: dataDir,
  });
  assert.equal(
    transformInputProbeResult.ok,
    true,
    "the real transform command must execute the privacy-filtered input",
  );
  assert.doesNotMatch(JSON.stringify(transformInputProbeResult), /private-notebook:v1:/u);
  assert.match(JSON.stringify(transformInputProbeResult), /privateRowsVisible[^0-9]*0/u);

  await db.insert(chats).values({
    id: "chat-mari-plan-race",
    name: "Notebook Mari plan race guard",
    mode: "roleplay",
    characterIds: "[]",
    groupId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const staleOwnerDeletePlan = await internalMari.planMutation(
    {
      kind: "delete",
      table: "chats",
      id: "chat-mari-plan-race",
      apply: true,
      cascade: true,
      reason: null,
    },
    "mari db delete chats chat-mari-plan-race --cascade --apply",
  );
  const raceGuardContent = "note created after Mari planned its owner deletion";
  assert.equal((await save("chat-mari-plan-race", { scope: "chat" }, raceGuardContent, 0)).statusCode, 200);
  await assert.rejects(
    () => internalMari.applyPlan(staleOwnerDeletePlan),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /Private notebook data cannot be accessed/u);
      assert.doesNotMatch(error.message, /private-notebook:v1:/u);
      assert.doesNotMatch(error.message, new RegExp(raceGuardContent));
      return true;
    },
    "apply-time revalidation must close the owner-delete planning race",
  );
  assert.equal((await db.select().from(chats).where(eq(chats.id, "chat-mari-plan-race")).limit(1)).length, 1);
  assert.equal(findDocument(await getContext("chat-mari-plan-race"), "chat").content, raceGuardContent);

  const missingChat = await app.inject({ method: "GET", url: "/api/private-notebook/chats/not-a-chat" });
  assert.equal(missingChat.statusCode, 404);
  assert.equal(missingChat.json().code, "chat-not-found");

  const persistedGlobal = findDocument(await getContext("chat-a"), "global");
  assert.equal(persistedGlobal.content, "global note");
  await app.close();
  app = null;

  app = (await buildApp()) as TestApp;
  await app.ready();
  assert.equal(findDocument(await getContext("chat-a"), "global").content, "global note");

  await flushDB();
  const storageRoot = join(dataDir, "storage");
  const tablesRoot = join(storageRoot, "tables");
  const appSettingsDir = join(tablesRoot, "app_settings");
  const protectedShard = join(
    appSettingsDir,
    `${encodeShardKey(`${PRIVATE_NOTEBOOK_SETTINGS_PREFIX}chat:chat-c`)}.json`,
  );
  const adversarialFiles = [
    protectedShard,
    join(appSettingsDir, "private-notebook%3av1%3achat%3achat-c.json.bak"),
    join(appSettingsDir, "private-notebook%253Av1%253Achat%253Achat-c.json.tmp-1-1"),
    join(tablesRoot, "app_settings.json"),
    join(tablesRoot, "app_settings.json.bak"),
    join(tablesRoot, "app_settings.json.tmp-1-1"),
    join(tablesRoot, "app_settings.json.corrupt-2026-01-01"),
    join(tablesRoot, "app_settings.json.pre-shard"),
    join(tablesRoot, "app_settings.json.post-downgrade-2026-01-01"),
    join(tablesRoot, "app_settings%2fprivate-notebook%3av1%3aglobal.json"),
    join(dataDir, "backups", "manual-profile", "storage", "tables", "app_settings", "notebook.json"),
  ];
  mkdirSync(appSettingsDir, { recursive: true });
  for (const path of adversarialFiles) {
    mkdirSync(join(path, ".."), { recursive: true });
    if (path !== protectedShard) writeFileSync(path, promptIsolationSentinel, "utf8");
    assert.equal(isProfessorMariPrivateDataPath(path), true, `path policy must protect ${path}`);
  }
  const ordinarySource = join(dataDir, "ordinary-source.ts");
  writeFileSync(ordinarySource, "export const ordinary = true;\n", "utf8");
  assert.equal(isProfessorMariPrivateDataPath(ordinarySource), false);

  await assert.rejects(
    runMariTransformSandbox({
      workspaceRoot: dataDir,
      scriptPath: protectedShard,
      timestamp,
      tables: [{ name: "items", jsonColumns: [], rows: [{ id: "one" }] }],
    }),
    /cannot use private application data as a transform script/u,
  );
  const transformReadScript = join(dataDir, "transform-read-private.mjs");
  writeFileSync(
    transformReadScript,
    `import { readFileSync } from "node:fs";\n` +
      `export default () => ({ update: { leaked: readFileSync(${JSON.stringify(protectedShard)}, "utf8") } });\n`,
    "utf8",
  );
  const priorUnsafeTransforms = process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS;
  process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS = "true";
  try {
    let transformOutput: unknown = null;
    try {
      transformOutput = await runMariTransformSandbox({
        workspaceRoot: dataDir,
        scriptPath: transformReadScript,
        timestamp,
        tables: [{ name: "items", jsonColumns: [], rows: [{ id: "one" }] }],
      });
    } catch {
      // A denied file open terminates the isolated transform, which is also a successful privacy outcome.
    }
    assertPrivateDataAbsent(transformOutput, "transform filesystem read");
  } finally {
    if (priorUnsafeTransforms === undefined) delete process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS;
    else process.env.MARI_DB_ALLOW_UNSAFE_TRANSFORMS = priorUnsafeTransforms;
  }

  let symlinkPath: string | null = join(dataDir, "notebook-alias.json");
  try {
    symlinkSync(protectedShard, symlinkPath, "file");
  } catch {
    symlinkPath = null;
  }
  const workspace = new ProfessorMariWorkspaceService({ db } as never);
  workspace.setEnabled(true, dataDir);
  const runner = workspace as unknown as {
    executeWorkspaceCommand(
      command: {
        id: string;
        name: "read" | "ls" | "find" | "grep";
        arguments: Record<string, unknown>;
        authorization: string;
      },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
      authorizationContext: { directUserText: string },
    ): Promise<{ output: string; success: boolean }>;
  };
  let workspaceCommandId = 0;
  const runWorkspaceRead = (name: "read" | "ls" | "find" | "grep", args: Record<string, unknown>) =>
    runner.executeWorkspaceCommand(
      { id: `private-notebook-${workspaceCommandId++}`, name, arguments: args, authorization: "" },
      new AbortController().signal,
      [],
      () => undefined,
      { directUserText: "" },
    );
  for (const path of adversarialFiles) {
    const result = await runWorkspaceRead("read", { path });
    assert.equal(result.success, false, `structured read must reject ${path}`);
    assertPrivateDataAbsent(result.output, "structured read denial");
  }
  if (symlinkPath) {
    const result = await runWorkspaceRead("read", { path: symlinkPath });
    assert.equal(result.success, false, "structured reads must reject a symlink to notebook storage");
  }
  const ordinaryRead = await runWorkspaceRead("read", { path: ordinarySource });
  assert.equal(ordinaryRead.success, true, "ordinary workspace source reads must remain available");
  const tableListing = await runWorkspaceRead("ls", { path: tablesRoot });
  assertPrivateDataAbsent(tableListing.output, "structured table listing");
  assert.doesNotMatch(tableListing.output, /app_settings/u, "list must hide protected storage entries");
  const findResult = await runWorkspaceRead("find", { path: dataDir, pattern: "**/*" });
  assertPrivateDataAbsent(findResult.output, "structured find");
  const grepResult = await runWorkspaceRead("grep", { path: dataDir, pattern: promptIsolationSentinel, literal: true });
  assert.doesNotMatch(grepResult.output, /private-notebook:v1:/u, "structured grep must not disclose notebook keys");
  assert.match(grepResult.output, /No matches/u);
  const codePathspecs = professorMariCodePathspecs(dataDir).join("\n");
  assert.match(codePathspecs, /storage/u, "mari code must exclude managed storage from git output");
  assert.match(codePathspecs, /backups/u, "mari code must exclude profile backups from git output");

  const codeWorkspace = join(dataDir, "code-workspace");
  const codeStorage = join(codeWorkspace, "storage");
  const codeBackups = join(codeWorkspace, "backups");
  mkdirSync(join(codeStorage, "tables", "app_settings"), { recursive: true });
  mkdirSync(codeBackups, { recursive: true });
  mkdirSync(codeWorkspace, { recursive: true });
  writeFileSync(join(codeWorkspace, "ordinary-source.ts"), "export const ordinary = 1;\n", "utf8");
  writeFileSync(join(codeStorage, "tables", "app_settings", "private.json"), promptIsolationSentinel, "utf8");
  writeFileSync(join(codeBackups, "private-backup.json"), promptIsolationSentinel, "utf8");
  execFileSync("git", ["init", "-q"], { cwd: codeWorkspace });
  execFileSync("git", ["config", "user.email", "e24-test@example.invalid"], { cwd: codeWorkspace });
  execFileSync("git", ["config", "user.name", "E24 Test"], { cwd: codeWorkspace });
  execFileSync("git", ["add", "."], { cwd: codeWorkspace });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: codeWorkspace });
  writeFileSync(join(codeWorkspace, "ordinary-source.ts"), "export const ordinary = 2;\n", "utf8");
  writeFileSync(
    join(codeStorage, "tables", "app_settings", "private.json"),
    `${promptIsolationSentinel}-changed`,
    "utf8",
  );
  writeFileSync(join(codeBackups, "private-backup.json"), `${promptIsolationSentinel}-changed`, "utf8");
  const priorCodeDataDir = process.env.DATA_DIR;
  const priorCodeStorage = process.env.FILE_STORAGE_DIR;
  process.env.DATA_DIR = codeWorkspace;
  process.env.FILE_STORAGE_DIR = codeStorage;
  try {
    const codeDiff = await mariDb.executeCli({ argv: ["code", "diff", "--patch"], cwd: codeWorkspace });
    assert.equal(codeDiff.ok, true, "the real mari code diff command must run with private pathspecs");
    assert.doesNotMatch(
      JSON.stringify(codeDiff),
      new RegExp(promptIsolationSentinel),
      "mari code diff must omit private storage and backups",
    );
    assert.match(
      JSON.stringify(codeDiff),
      /ordinary-source\.ts/u,
      "mari code diff must retain ordinary tracked changes",
    );
  } finally {
    if (priorCodeDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = priorCodeDataDir;
    if (priorCodeStorage === undefined) delete process.env.FILE_STORAGE_DIR;
    else process.env.FILE_STORAGE_DIR = priorCodeStorage;
  }

  const routeSource = readFileSync(
    join(repositoryRoot, "packages/server/src/routes/private-notebook.routes.ts"),
    "utf8",
  );
  const serviceSource = readFileSync(
    join(repositoryRoot, "packages/server/src/services/private-notebook.service.ts"),
    "utf8",
  );
  assert(!/logger\.|request\.log\.|reply\.log\.|console\./.test(`${routeSource}\n${serviceSource}`));
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

process.stdout.write("Private notebook storage and API regression passed.\n");

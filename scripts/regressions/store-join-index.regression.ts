// A joined select was a nested loop over every (base row, joined row) pair.
// getPreviousOutput joins a chat's agent runs against its messages, so a
// long chat paid rows x messages condition evaluations, each with an object
// spread, on the event loop: about 142 million pairs and ten blocked minutes
// on a 7k-run, 20k-message chat. Joins on an equality now bucket the joined
// table once and probe it per base row; results and their order are the same.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-join-index-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { and, desc, eq, ne, or } = await import("../../packages/server/src/db/file-query.js");
const { agentRuns, chats, messages } = await import("../../packages/server/src/db/schema/index.js");

const CHATS = 20;
const CHAT = `chat-${CHATS - 1}`;
const MESSAGES = 20_000;
const RUNS = 5_000;
const CONFIG = "config-tracker";
const at = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();

const db = await createFileNativeDB();
try {
  await db
    .insert(chats)
    .values(Array.from({ length: CHATS }, (_, i) => ({ id: `chat-${i}`, name: `Chat ${i}`, mode: "roleplay" })));
  await db.insert(messages).values(
    Array.from({ length: MESSAGES }, (_, i) => ({
      id: `m-${i}`,
      chatId: `chat-${Math.floor(i / (MESSAGES / CHATS))}`,
      role: i % 2 ? "assistant" : "user",
      content: `message ${i}`,
      activeSwipeIndex: 0,
      createdAt: at(i),
    })),
  );
  const run = (id: string, messageId: string, i: number, extra: Partial<typeof agentRuns.$inferInsert> = {}) => ({
    id,
    agentConfigId: CONFIG,
    chatId: CHAT,
    messageId,
    swipeIndex: 0,
    resultType: "context_injection",
    resultData: `{"i":${i}}`,
    success: "true",
    createdAt: at(i),
    ...extra,
  });
  await db.insert(agentRuns).values([
    ...Array.from({ length: RUNS }, (_, i) =>
      run(`r-${i}`, `m-${i * 4}`, i, { chatId: `chat-${Math.floor(i / (RUNS / CHATS))}` }),
    ),
    // A second run on the same message and a run whose message does not exist.
    run("r-dup", "m-19008", RUNS + 1),
    run("r-orphan", "m-missing", RUNS + 2),
    run("r-cross-chat", "m-0", RUNS + 3),
    run("r-failed", "m-19999", RUNS + 4, { success: "false" }),
    run("r-other-config", "m-19012", RUNS + 3, { agentConfigId: "config-other" }),
  ]);

  const started = performance.now();
  const rows = await db
    .select()
    .from(agentRuns)
    .innerJoin(messages, eq(agentRuns.messageId, messages.id))
    .where(
      and(
        eq(agentRuns.agentConfigId, CONFIG),
        eq(agentRuns.chatId, CHAT),
        eq(messages.chatId, CHAT),
        eq(agentRuns.success, "true"),
      ),
    )
    .orderBy(desc(messages.createdAt), desc(agentRuns.createdAt));
  const elapsedMs = performance.now() - started;

  assert.equal(
    rows.length,
    RUNS / CHATS + 1,
    "every run with a real message joins exactly once, orphan and other config excluded",
  );
  assert.equal(rows[0].agent_runs.id, `r-${RUNS - 1}`, "ordered by message time descending");
  const onM8 = rows.filter((row) => row.messages.id === "m-19008").map((row) => row.agent_runs.id);
  assert.deepEqual(onM8, ["r-dup", "r-4752"], "two runs on one message both join, newest run first");
  assert.ok(
    rows.every((row) => row.agent_runs.messageId === row.messages.id),
    "join condition holds on every row",
  );
  assert.ok(
    elapsedMs < 5_000,
    `joined select took ${Math.round(elapsedMs)} ms; the nested loop took minutes at this size`,
  );

  const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
  const agents = createAgentsStorage(db);
  await db.update(messages).set({ activeSwipeIndex: 1 }).where(eq(messages.id, "m-19992"));
  assert.deepEqual(
    await agents.getPreviousOutput(CONFIG, CHAT, "m-19996", "m-19996"),
    { i: RUNS - 3 },
    "agent history excludes other chats/configs, failed runs, later messages, and inactive swipes",
  );

  // A join with no equality between the two tables still takes the full scan path.
  const scanned = await db
    .select()
    .from(chats)
    .innerJoin(messages, ne(chats.id, messages.id))
    .where(eq(chats.id, CHAT));
  assert.equal(scanned.length, MESSAGES, "non-equality join pairs the chat with every message");

  // Small fixtures cover join shapes without relying on the optimization's implementation.
  const { fileTable, text, integer } = await import("../../packages/server/src/db/file-schema.js");
  const columns = () => ({ id: text("id").primaryKey(), key: text("join_key"), rank: integer("rank") });
  const left = fileTable("join_index_left", columns());
  const right = fileTable("join_index_right", columns());
  const third = fileTable("join_index_third", columns());
  db._fileStore.registerTables([left, right, third]);
  await db.insert(left).values([
    { id: "a", key: "x", rank: 1 },
    { id: "b", key: "x", rank: 2 },
    { id: "c", key: null, rank: 3 },
    { id: "d", key: "missing", rank: 4 },
  ]);
  await db.insert(right).values([
    { id: "r1", key: "x", rank: 1 },
    { id: "r2", key: "x", rank: 2 },
    { id: "r3", key: null, rank: 3 },
  ]);
  await db.insert(third).values([{ id: "t1", key: "r2", rank: 2 }]);
  const projection = { left: left.id, right: right.id };
  const expected = [
    { left: "a", right: "r1" },
    { left: "a", right: "r2" },
    { left: "b", right: "r1" },
    { left: "b", right: "r2" },
    { left: "c", right: "r3" },
  ];
  for (const condition of [eq(left.key, right.key), eq(right.key, left.key)]) {
    assert.deepEqual(
      await db.select(projection).from(left).innerJoin(right, condition),
      expected,
      "equality in either direction preserves duplicate matches, null equality, and insertion order",
    );
  }
  assert.deepEqual(
    await db
      .select(projection)
      .from(left)
      .innerJoin(right, and(eq(left.key, right.key), eq(left.rank, right.rank))),
    [expected[0], expected[3], expected[4]],
    "all join conjuncts still apply after looking up a bucket",
  );
  assert.deepEqual(
    await db
      .select(projection)
      .from(left)
      .innerJoin(right, eq(left.key, right.key))
      .orderBy(desc(left.id), desc(right.id))
      .offset(1)
      .limit(2),
    [expected[3], expected[2]],
    "ordering and pagination follow the completed join",
  );
  assert.deepEqual(
    await db
      .select(projection)
      .from(left)
      .innerJoin(right, eq(left.key, right.key))
      .innerJoin(third, eq(third.key, right.id)),
    [expected[1], expected[3]],
    "chained joins can probe a previously joined table",
  );
  assert.equal(
    (
      await db
        .select()
        .from(left)
        .innerJoin(right, or(eq(left.key, right.key), eq(right.id, "r1")))
    ).length,
    7,
    "an equality under OR must not exclude matches from another branch",
  );
  assert.equal(
    (await db.select().from(left).innerJoin(right, eq(right.rank, 2))).length,
    4,
    "a literal comparison is not a cross-table equality key",
  );
  assert.equal(
    (await db.select().from(right).innerJoin(right, eq(right.key, right.key))).length,
    9,
    "rejoining a bound table keeps the existing row-replacement semantics",
  );
  await db.delete(right);
  assert.deepEqual(
    await db.select(projection).from(left).innerJoin(right, eq(left.key, right.key)),
    [],
    "empty joined tables produce no rows",
  );

  console.log(`Store join index regression passed: ${rows.length} joined rows in ${Math.round(elapsedMs)} ms.`);
} finally {
  await db._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}

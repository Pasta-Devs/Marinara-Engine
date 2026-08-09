// End-to-end guard for the tiered [fetch:] wiring (#4768 phase 2): a real DB +
// real stores + a deterministic stub embedder, driving handleProfessorMariCommand
// so exact/ambiguous/miss fetches produce the right mariContext entry and
// assistant action. mariContext is the durable slot #4768 relocated into the
// volatile tail, so a candidate list rides it without churning the cache prefix.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFESSOR_MARI_ID } from "../../packages/shared/src/constants/defaults.js";
import { createBowStubEmbedder } from "./helpers/bow-stub-embedder.js";

process.env.FILE_STORAGE_DIR = mkdtempSync(join(tmpdir(), "marinara-fetch-int-"));

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { characters, chats } = await import("../../packages/server/src/db/schema/index.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { handleProfessorMariCommand } = await import(
  "../../packages/server/src/services/generation/professor-mari-command-runtime.js"
);

// Deterministic, collision-free bag-of-words embedder shared with the other
// Mari fetch regressions (token overlap → exact cosine).
const embeddingSource = createBowStubEmbedder(undefined, "fetch-integration regression");

const db = await createFileNativeDB();
const chars = createCharactersStorage(db);
const chatsStore = createChatsStorage(db);
const lorebooksStore = createLorebooksStorage(db);
const presets = createPromptsStorage(db);

const STAMP = "2026-01-01T00:00:00.000Z";
async function insertCharacter(id: string, name: string, description: string) {
  await db.insert(characters).values({
    id,
    data: JSON.stringify({ name, description }),
    comment: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}
await insertCharacter("c1", "Dracula", "a brooding immortal vampire");
await insertCharacter("c2", "Alucard", "a hunting daywalker vampire");
await insertCharacter("c3", "Bob", "a cheerful baker");
// Two characters with the exact same name, distinguished only by description.
// (Worded to not collide with the "immortal vampire brooding" / "vampire" queries above.)
await insertCharacter("vlad-vampire", "Vlad", "a nocturnal bloodsucking count of Wallachia");
await insertCharacter("vlad-impaler", "Vlad", "a warlord who impales his enemies on stakes");

const CHAT_ID = "mari-home-chat";
await db.insert(chats).values({
  id: CHAT_ID,
  name: "Professor Mari",
  mode: "conversation",
  characterIds: "[]",
  metadata: "{}",
  createdAt: STAMP,
  updatedAt: STAMP,
});

async function runFetch(name: string) {
  const actions: Array<Record<string, unknown>> = [];
  const result = await handleProfessorMariCommand({
    command: { type: "fetch", fetchType: "character", name } as never,
    characterId: null,
    chatId: CHAT_ID,
    sourceChatMetadata: "{}",
    isHomeProfessorMariAssistantChat: true,
    db,
    stores: { chars, chats: chatsStore, lorebooksStore, presets },
    embeddingSource,
    vectorizerAvailable: true,
    sendAssistantAction: (data) => actions.push(data),
  });
  const fresh = await chatsStore.getById(CHAT_ID);
  const metadata = JSON.parse((fresh?.metadata as string) ?? "{}") as { mariContext?: Record<string, string> };
  return { result, actions, mariContext: metadata.mariContext ?? {} };
}

// Single-fetch keys are "<type>:<name> [id: <id>]"; match by prefix when the id
// doesn't matter to the assertion.
function fetchedValue(mariContext: Record<string, string>, prefix: string): string | undefined {
  const key = Object.keys(mariContext).find((k) => k.startsWith(prefix));
  return key ? mariContext[key] : undefined;
}

// ── Exact name → single fetch, keyed by the resolved name, data_fetched action ──
{
  const { result, actions, mariContext } = await runFetch("Dracula");
  assert.equal(result.fetchSucceeded, true, "a resolved fetch in the home chat triggers the follow-up");
  assert.ok(fetchedValue(mariContext, "character:Dracula"), "the resolved item is stored under its name");
  assert.match(fetchedValue(mariContext, "character:Dracula")!, /brooding immortal vampire/);
  assert.equal(actions.at(-1)?.action, "data_fetched");
}

// ── A descriptive fuzzy reference auto-opens the single strong hit ──
{
  const { mariContext, actions } = await runFetch("immortal vampire brooding");
  assert.ok(fetchedValue(mariContext, "character:Dracula"), "a fuzzy reference resolves to the right character");
  assert.equal(actions.at(-1)?.action, "data_fetched");
}

// ── Ambiguous term → candidate list (not a guess), data_candidates action ──
{
  const { result, actions, mariContext } = await runFetch("vampire");
  assert.equal(result.fetchSucceeded, true, "a candidate list still triggers the follow-up so Mari can present it");
  const optionsKey = Object.keys(mariContext).find((k) => k.startsWith("character options"));
  assert.ok(optionsKey, "an ambiguous fetch stores a candidate options block");
  assert.match(mariContext[optionsKey!]!, /Dracula/);
  assert.match(mariContext[optionsKey!]!, /Alucard/);
  assert.match(mariContext[optionsKey!]!, /do not guess/i);
  const last = actions.at(-1)!;
  assert.equal(last.action, "data_candidates");
  assert.ok(Array.isArray(last.candidates) && (last.candidates as unknown[]).length === 2);
}

// ── Resolving a fetch evicts the stale candidate options block (no re-asking) ──
{
  await runFetch("vampire"); // leaves a "character options for" block
  const { mariContext } = await runFetch("Dracula"); // a resolved fetch must clear it
  assert.ok(fetchedValue(mariContext, "character:Dracula"), "the resolved item is present");
  assert.ok(
    !Object.keys(mariContext).some((k) => k.includes(' options for "')),
    "a resolved fetch evicts the stale candidate options block so it stops re-injecting",
  );
}

// ── Two entities with the same exact name disambiguate by id, and fetching that
//    id opens the EXACT one (not the first) ──
{
  const { actions, mariContext } = await runFetch("Vlad");
  const candidatesAction = actions.at(-1)!;
  assert.equal(candidatesAction.action, "data_candidates", "two same-named entities must disambiguate, not auto-open the first");
  const candidates = candidatesAction.candidates as Array<{ id: string; name: string }>;
  assert.equal(candidates.length, 2, "both Vlads must be offered");
  const optionsKey = Object.keys(mariContext).find((k) => k.startsWith("character options"))!;
  assert.match(mariContext[optionsKey]!, /\[id: vlad-vampire\]/, "the options block must expose each id for a name-safe fetch");
  assert.match(mariContext[optionsKey]!, /\[id: vlad-impaler\]/);

  // Fetch the impaler by its id → must render the impaler, not the first "Vlad".
  const { mariContext: after } = await runFetch("vlad-impaler");
  const impalerEntry = after["character:Vlad [id: vlad-impaler]"]!;
  assert.ok(impalerEntry, "the single fetch is keyed by name AND id");
  assert.match(impalerEntry, /impales his enemies/, "fetching by id must open the exact entity");
  assert.doesNotMatch(impalerEntry, /bloodsucking/, "it must NOT render the other same-named entity");

  // Then fetch the other Vlad — both namesakes are held under distinct keys, the
  // first is not overwritten.
  const { mariContext: both } = await runFetch("vlad-vampire");
  assert.ok(both["character:Vlad [id: vlad-vampire]"], "the other Vlad is held under its own key");
  assert.ok(both["character:Vlad [id: vlad-impaler]"], "the first Vlad is NOT overwritten by the second");
}

// ── No match → no context written, follow-up not triggered ──
{
  const { result, actions } = await runFetch("a spaceship pilot from andromeda");
  assert.equal(result.fetchSucceeded, false, "an unresolved fetch does not trigger a follow-up");
  assert.equal(actions.length, 0, "an unresolved fetch emits no assistant action");
}

process.stdout.write("Professor Mari fetch-integration regression passed.\n");

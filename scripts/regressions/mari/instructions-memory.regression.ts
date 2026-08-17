// #4851: Professor Mari now has a persistent, retrievable memory (the user's "saved
// instructions"). This drives the REAL MariDbService against a file-native store and
// asserts (a) the instruction.* action surface (remember/list/get/update/forget) routed
// through the Keep/Restore mutation pipeline, disabled-by-default,
// the "Keep & Enable" review action, and the persistent flag; (b) the direct panel
// storage writes (create/update/remove); and (c) the pure index-and-fetch renderer's
// token-bloat invariant: a NON-persistent body is never injected; only the title/one-liner
// index is, while a persistent body is.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import { renderMariMemoryPrompt } from "../../../packages/server/src/services/professor-mari/mari-instructions-prompt.js";
import { createMariInstructionsStorage, type MariInstructionRow } from "../../../packages/server/src/services/storage/mari-instructions.storage.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-instructions-"));
process.env.FILE_STORAGE_DIR = dir;

const drainKeep = async (mari: MariDbService) => {
  for (const approval of mari.getPendingApprovals()) await mari.keepAppliedReview(approval.id);
};

// ── Pure renderer: the token-bloat invariant ──────────────────────────────────
{
  const stamp = "2026-01-01T00:00:00.000Z";
  const mk = (over: Partial<MariInstructionRow>): MariInstructionRow => ({
    id: "id",
    name: "Name",
    description: "Desc",
    content: "Body",
    persistent: false,
    enabled: true,
    createdAt: stamp,
    updatedAt: stamp,
    ...over,
  });

  assert.equal(renderMariMemoryPrompt([]), null, "no memories -> no block");

  const nonPersistent = renderMariMemoryPrompt([
    mk({ id: "m1", name: "Lorebook formatting", description: "key on name + nickname", content: "SECRET-BODY-XYZ" }),
  ]);
  assert.ok(nonPersistent, "one memory -> a block");
  assert.match(nonPersistent, /Lorebook formatting/, "the index shows the title");
  assert.match(nonPersistent, /key on name \+ nickname/, "the index shows the one-line description");
  assert.match(nonPersistent, /\[m1\]/, "the index shows the id to fetch");
  assert.doesNotMatch(nonPersistent, /SECRET-BODY-XYZ/, "a NON-persistent body is never injected (token-bloat guard)");
  assert.match(nonPersistent, /instruction\.get/, "the block tells Mari to fetch relevant memories");
  assert.match(nonPersistent, /precedence|authoritative|follow the memory/i, "the block frames memory as taking precedence");

  const persistent = renderMariMemoryPrompt([mk({ id: "p1", name: "How-to handling", content: "PERSIST-BODY-ABC", persistent: true })]);
  assert.ok(persistent && /PERSIST-BODY-ABC/.test(persistent), "a persistent body IS injected in full");
  assert.match(persistent!, /\[PERSISTENT\]/, "a persistent memory is marked in the index");

  const disabledOnly = renderMariMemoryPrompt([mk({ enabled: false })]);
  assert.equal(disabledOnly, null, "disabled memories are ignored");

  const many = renderMariMemoryPrompt(
    [mk({ id: "a", name: "A" }), mk({ id: "b", name: "B" }), mk({ id: "c", name: "C" })],
    { maxIndexEntries: 2 },
  );
  assert.ok(many && /\+1 more/.test(many), "the index caps its length and reports the remainder honestly");

  // Persistent rows are ordered first so the index cap can never drop a persistent directive.
  const persistentOrdering = renderMariMemoryPrompt(
    [mk({ id: "n1", name: "N1" }), mk({ id: "n2", name: "N2" }), mk({ id: "pin", name: "Persistent one", persistent: true, content: "x" })],
    { maxIndexEntries: 1 },
  );
  assert.ok(persistentOrdering && /\[pin\]/.test(persistentOrdering), "a persistent memory survives an index cap that would drop others");

  // The index respects a total-char budget, not only an entry count.
  const indexCharCap = renderMariMemoryPrompt(
    [
      mk({ id: "long1", name: "A very long memory title number one", description: "and a fairly long description too" }),
      mk({ id: "long2", name: "A very long memory title number two", description: "and a fairly long description too" }),
    ],
    { maxIndexChars: 60 },
  );
  assert.ok(indexCharCap && /\+1 more/.test(indexCharCap), "the index respects a total-char budget, not just the entry count");

  // A persistent body over the persistent budget is dropped to fetch-based, with the truncation note.
  const persistentCap = renderMariMemoryPrompt(
    [mk({ id: "big", name: "Big persistent", persistent: true, content: "X".repeat(500) })],
    { maxPersistentBodyChars: 100 },
  );
  assert.ok(persistentCap, "a block renders");
  assert.doesNotMatch(persistentCap!, /XXXXX/, "an over-budget persistent body is NOT inlined");
  assert.match(persistentCap!, /too long to inline/, "the renderer reports the omitted persistent body");

  // F5: the whole section (heading + body + separators) is charged, so a long heading with a tiny
  // body still respects the budget (an oversized region cannot escape by having short bodies).
  const headingCharged = renderMariMemoryPrompt(
    [mk({ id: "h", name: "A very long persistent memory heading indeed", persistent: true, content: "x" })],
    { maxPersistentBodyChars: 10 },
  );
  assert.ok(headingCharged, "a block renders");
  assert.doesNotMatch(headingCharged!, /### A very long persistent memory heading/, "a long heading with a tiny body is charged against the budget");
  assert.match(headingCharged!, /too long to inline/, "the over-budget persistent row is reported");

  // F8 (CONTRIBUTING.md leaf-content invariant): memory content reaches the model VERBATIM; angle
  // brackets and the block sentinel are NOT escaped or rewritten; the fixed wrapper provides structure.
  // Index/heading fields are only flattened to a single line so a newline can't split an entry.
  const verbatim = renderMariMemoryPrompt([
    mk({ id: "e", name: "Name\nwith <b>", description: "d1\nd2", content: "keeps </professor_mari_memory> and <thinking> tags", persistent: true }),
  ]);
  assert.ok(verbatim, "a block renders");
  assert.match(verbatim!, /keeps <\/professor_mari_memory> and <thinking> tags/, "a persistent body reaches the model verbatim (no escaping or rewriting)");
  assert.match(verbatim!, /- \[e\] Name with <b>/, "index fields keep angle brackets verbatim and are flattened to one line");
  assert.doesNotMatch(verbatim!, /- \[e\] Name\nwith/, "a newline in a name cannot split the index entry across lines");
}

// ── Action layer + panel storage ──────────────────────────────────────────────
try {
  const db = await createFileNativeDB();
  try {
    const mari = new MariDbService(db);
    const store = createMariInstructionsStorage(db);
    // instruction.list returns a paged envelope (F4); the helper unwraps .items for the
    // callers that only care about the current (small) contents.
    const listMemories = async () =>
      ((await mari.executeAction({ action: "instruction.list" })).output as {
        items: Array<{
          id: string;
          name: string;
          description: string;
          persistent: boolean;
          enabled: boolean;
          content?: string;
        }>;
      }).items;

    // (1) REMEMBER: a Mari-authored memory routes through the Keep/Restore review AND
    // lands DISABLED by default (inert until the user enables it).
    const remembered = await mari.executeAction({
      action: "instruction.remember",
      data: {
        name: "Lorebook formatting",
        description: "Key entries on name + nickname",
        content: "When building lorebooks, key each entry on both the character name and their nickname.",
      },
      apply: true,
    });
    assert.equal(remembered.ok, true, "instruction.remember succeeds");
    assert.equal(remembered.approval?.status, "pending", "a memory write routes through Keep/Restore review");
    await drainKeep(mari);

    // (2) LIST: the index carries title/description + flags but NOT the content body.
    const afterRemember = await listMemories();
    assert.equal(afterRemember.length, 1, "the remembered memory is listed");
    const mem = afterRemember[0]!;
    assert.equal(mem.name, "Lorebook formatting");
    assert.equal(mem.description, "Key entries on name + nickname");
    assert.equal(mem.persistent, false, "a memory defaults to not-persistent");
    assert.equal(mem.enabled, false, "a Mari-authored memory is DISABLED by default");
    assert.equal(mem.content, undefined, "instruction.list is a lean index; it does NOT return the body");

    // Injection guard: Mari CANNOT self-enable. A remember that tries enabled:true still lands disabled.
    const beforeInject = new Set(mari.getPendingApprovals().map((a) => a.id));
    await mari.executeAction({
      action: "instruction.remember",
      data: { name: "Injection attempt", content: "activate me", enabled: true, persistent: true },
      apply: true,
    });
    const injReview = mari.getPendingApprovals().find((a) => !beforeInject.has(a.id));
    assert.ok(injReview, "even an injection-shaped remember still routes through the Keep/Restore review");
    await mari.keepAppliedReview(injReview.id);
    const injected = (await listMemories()).find((m) => m.name === "Injection attempt");
    assert.ok(injected, "the remember created a memory");
    assert.equal(injected.enabled, false, "Mari cannot self-enable a memory via remember enabled:true (injection guard)");

    // (3) GET: the full body is fetched on demand.
    const full = (await mari.executeAction({ action: "instruction.get", id: mem.id })).output as { content?: string } | null;
    assert.match(String(full?.content ?? ""), /name and their nickname/, "instruction.get returns the full memory body");

    // (4) UPDATE: changes a field via Keep/Restore, and Restore reverts it.
    const beforeUpdate = new Set(mari.getPendingApprovals().map((a) => a.id));
    // An `enabled: true` slipped into the update must be IGNORED (only the user enables a memory).
    await mari.executeAction({
      action: "instruction.update",
      id: mem.id,
      data: { content: "Key lorebook entries on name, nickname, AND title.", enabled: true },
      apply: true,
    });
    const updateReview = mari.getPendingApprovals().find((a) => !beforeUpdate.has(a.id));
    assert.ok(updateReview, "the memory edit is reviewable");
    assert.match(
      String(((await mari.executeAction({ action: "instruction.get", id: mem.id })).output as { content?: string } | null)?.content ?? ""),
      /AND title/,
      "the update applied before Restore (guards against a no-op update passing this test)",
    );
    assert.equal(
      ((await mari.executeAction({ action: "instruction.list" })).output as { items: Array<{ id: string; enabled: boolean }> }).items.find((m) => m.id === mem.id)?.enabled,
      false,
      "instruction.update cannot enable a memory (Mari never self-enables, even via update)",
    );
    await mari.restoreAppliedReview(updateReview.id);
    assert.match(
      String(((await mari.executeAction({ action: "instruction.get", id: mem.id })).output as { content?: string } | null)?.content ?? ""),
      /name and their nickname/,
      "Restore reverts the memory edit",
    );

    // (F9) A description can be cleared through update: "" is applied, not silently dropped.
    await mari.executeAction({ action: "instruction.update", id: mem.id, data: { description: "" }, apply: true });
    await drainKeep(mari);
    assert.equal(
      (await listMemories()).find((m) => m.id === mem.id)?.description,
      "",
      "instruction.update can clear a description (empty string is applied, not dropped)",
    );

    // (5) The `persistent` flag round-trips through remember, via the Keep/Restore review.
    const beforePersist = new Set(mari.getPendingApprovals().map((a) => a.id));
    await mari.executeAction({
      action: "instruction.remember",
      data: { name: "How-to handling", content: "When I ask how to do something, just do it.", persistent: true },
      apply: true,
    });
    const persistReview = mari.getPendingApprovals().find((a) => !beforePersist.has(a.id));
    assert.ok(persistReview, "a persistent memory write routes through the Keep/Restore review");
    await mari.keepAppliedReview(persistReview.id);
    const persistentMem = (await listMemories()).find((m) => m.name === "How-to handling");
    assert.ok(persistentMem, "remember created a memory");
    assert.equal(persistentMem.persistent, true, "the persistent flag round-trips");

    // (6) KEEP & ENABLE: a fresh remember lands disabled; keeping WITH enable flips it on.
    const beforeKE = new Set(mari.getPendingApprovals().map((a) => a.id));
    await mari.executeAction({
      action: "instruction.remember",
      data: { name: "Enable me now", content: "Use a warm tone." },
      apply: true,
    });
    const keReview = mari.getPendingApprovals().find((a) => !beforeKE.has(a.id));
    assert.ok(keReview, "the new memory is reviewable");
    await mari.keepAppliedReview(keReview.id, { enable: true });
    const enabledNow = (await listMemories()).find((m) => m.name === "Enable me now");
    assert.ok(enabledNow?.enabled === true, "Keep & Enable turns the memory on");

    // (7) Render over LIVE rows: only ENABLED memories inject. Enable the two originals
    // (persistent one inlines its body; non-persistent shows in the index only).
    for (const m of await listMemories()) {
      if (m.name === "Lorebook formatting" || m.name === "How-to handling") await store.update(m.id, { enabled: true });
    }
    const block = renderMariMemoryPrompt(await store.list());
    assert.ok(block, "a block renders from live enabled memories");
    assert.match(block, /Lorebook formatting/, "the non-persistent memory appears in the index");
    assert.match(block, /How-to handling/, "the persistent memory appears in the index");
    assert.match(block, /just do it/, "the persistent body is injected in full");
    assert.doesNotMatch(block, /key each entry on both/, "the non-persistent body is NOT injected");

    // (7b) The user's reported case: editing an ENABLED, persistent memory's content persists and
    // stays live. Unlike (4) — a disabled memory whose edit is Restored — this KEEPS the edit and
    // asserts the new body is what injects going forward. (The engine has no "already matches" no-op;
    // declining such an edit is a prompt-side decision, not a capability gap.)
    const livePersistent = (await listMemories()).find((m) => m.name === "How-to handling");
    assert.ok(
      livePersistent && livePersistent.enabled === true && livePersistent.persistent === true,
      "the memory under edit is enabled + persistent",
    );
    await mari.executeAction({
      action: "instruction.update",
      id: livePersistent.id,
      data: { content: "When I ask how to do something, just do it without asking." },
      apply: true,
    });
    await drainKeep(mari);
    const editedLive = (await listMemories()).find((m) => m.id === livePersistent.id);
    assert.ok(editedLive, "the edited memory still exists after Keep");
    assert.equal(editedLive.enabled, true, "editing an enabled memory keeps it enabled");
    assert.equal(editedLive.persistent, true, "editing keeps the persistent flag");
    assert.match(
      String(((await mari.executeAction({ action: "instruction.get", id: livePersistent.id })).output as { content?: string } | null)?.content ?? ""),
      /just do it without asking/,
      "a kept content edit to an enabled, persistent memory persists",
    );
    assert.match(
      String(renderMariMemoryPrompt(await store.list()) ?? ""),
      /just do it without asking/,
      "the edited persistent body is what now injects into the prompt",
    );

    // (8) FORGET: deletes through the Keep/Restore review (must create a review card).
    const beforeForget = new Set(mari.getPendingApprovals().map((a) => a.id));
    await mari.executeAction({ action: "instruction.forget", id: mem.id, apply: true });
    const forgetReview = mari.getPendingApprovals().find((a) => !beforeForget.has(a.id));
    assert.ok(forgetReview, "instruction.forget routes through a Keep/Restore review");
    await mari.keepAppliedReview(forgetReview.id);
    assert.equal(
      (await mari.executeAction({ action: "instruction.get", id: mem.id })).ok,
      false,
      "instruction.forget removes the memory",
    );

    // (9) Over-cap content is rejected with a clear error, never silently truncated.
    const tooLong = await mari.executeAction({
      action: "instruction.remember",
      data: { name: "Huge", content: "x".repeat(20_001) },
      apply: true,
    });
    assert.equal(tooLong.ok, false, "over-length memory content is rejected, not truncated");
    assert.match(String(tooLong.error ?? ""), /maximum is 20000|Trim it/i, "the rejection names the limit");

    // (10) PANEL storage writes are direct (no review card) and default disabled + non-persistent.
    const created = await store.create({ name: "Panel memory", content: "Prefer short greetings." });
    assert.equal(created.enabled, false, "a panel-created memory defaults disabled");
    assert.equal(created.persistent, false, "a panel-created memory defaults non-persistent");
    assert.doesNotMatch(
      renderMariMemoryPrompt(await store.list()) ?? "",
      /Panel memory/,
      "a disabled panel memory is inert (absent from the injected block)",
    );
    const toggled = await store.update(created.id, { enabled: true, persistent: true });
    assert.ok(toggled?.enabled === true && toggled.persistent === true, "the panel update flips enabled + persistent");
    assert.match(renderMariMemoryPrompt(await store.list()) ?? "", /Prefer short greetings/, "an enabled persistent panel memory inlines its body");
    // Direct panel writes enforce the same caps (guards against a storage-path change bypassing them).
    await assert.rejects(store.create({ name: "Too big", content: "x".repeat(20_001) }), /maximum is 20000/iu, "store.create rejects over-cap content");
    await assert.rejects(store.update(created.id, { content: "x".repeat(20_001) }), /maximum is 20000/iu, "store.update rejects over-cap content");
    assert.equal(await store.remove(created.id), true, "the panel delete removes the memory");
    assert.equal(await store.get(created.id), null, "the deleted memory is gone");

    // (F3) The generic raw `mari db` path CANNOT write mari_instructions: every memory mutation
    // must go through instruction.* so the length caps + enabled=0 forcing apply. A raw insert is
    // blocked (even one trying enabled:"true"), and so is an over-cap raw insert, because the cap that
    // lives only in the instruction.* builders can't be bypassed through the raw path.
    const rawInsert = await mari.executeCli({
      argv: ["db", "insert", "mari_instructions", "--json", JSON.stringify({ name: "Raw", content: "raw body", enabled: "true" }), "--apply"],
      command: "mari db insert mari_instructions --json <row> --apply",
      sessionId: "mari-instructions-regression",
    });
    assert.equal(rawInsert.ok, false, "a raw mari db insert of a memory is blocked");
    assert.match(JSON.stringify(rawInsert.validation), /cannot mutate memories through raw DB actions/u, "the block names the raw-path denial");
    const rawOversize = await mari.executeCli({
      argv: ["db", "insert", "mari_instructions", "--json", JSON.stringify({ name: "Raw big", content: "x".repeat(20_001) }), "--apply"],
      command: "mari db insert mari_instructions --json <row> --apply",
      sessionId: "mari-instructions-regression",
    });
    assert.equal(rawOversize.ok, false, "an over-cap raw memory insert is blocked (the cap can't be bypassed via the raw path)");

    // (F4) instruction.list is paginated so memories past the first page stay discoverable AND
    // fetchable by id (the bug severed ids when the unbounded list hit the read clip). Seed enough
    // rows to require multiple pages, then walk them. Page size: default 40, hard max 50 (kept
    // under the read budget by construction, see the list handler).
    const DEFAULT_PAGE = 40;
    const MAX_PAGE = 50;
    for (let i = 0; i < 60; i += 1) {
      await store.create({ name: `Bulk memory ${i}`, content: `Body ${i}`, description: `Desc ${i}` });
    }
    const total = (await store.list()).length;
    assert.ok(total > DEFAULT_PAGE, "seeded enough memories to require more than one default page");
    type ListPage = { items: Array<{ id: string }>; total: number; offset: number; nextOffset: number | null };

    const page1 = (await mari.executeAction({ action: "instruction.list" })).output as ListPage;
    assert.equal(page1.total, total, "the page reports the true total memory count");
    assert.equal(page1.items.length, DEFAULT_PAGE, "a bare list returns the default page size");
    assert.equal(page1.offset, 0, "the first page starts at offset 0");
    assert.equal(page1.nextOffset, DEFAULT_PAGE, "a full first page advertises the next offset");

    // An explicit oversized limit is clamped to the max page size (the read-budget guarantee).
    const clamped = (await mari.executeAction({ action: "instruction.list", limit: 999 })).output as ListPage;
    assert.equal(clamped.items.length, MAX_PAGE, "an oversized limit is clamped to the max page size");

    // Walk every page to prove each memory keeps a distinct, fetchable id across the whole set.
    const walked: string[] = [];
    let cursor: number | null = 0;
    let pages = 0;
    while (cursor !== null) {
      const page = (await mari.executeAction({ action: "instruction.list", offset: cursor })).output as ListPage;
      assert.ok(page.items.length <= MAX_PAGE, "no page exceeds the max page size");
      walked.push(...page.items.map((m) => m.id));
      cursor = page.nextOffset;
      pages += 1;
      assert.ok(pages <= total + 2, "paging terminates");
    }
    assert.equal(walked.length, total, "paging visits every memory exactly once");
    assert.equal(new Set(walked).size, total, "every memory across all pages exposes a distinct id");
    const tail = walked[walked.length - 1]!;
    assert.equal(
      (await mari.executeAction({ action: "instruction.get", id: tail })).ok,
      true,
      "a memory reached only by paging is still fetchable by its id",
    );

    // An offset past the end returns an empty final page, not an error.
    const pastEnd = (await mari.executeAction({ action: "instruction.list", offset: total + 10 })).output as ListPage;
    assert.equal(pastEnd.items.length, 0, "an offset past the end returns no items");
    assert.equal(pastEnd.nextOffset, null, "an offset past the end reports no next offset");

    // The executable sub-action surface matches the declared catalog (list/get/remember/update/forget):
    // synonyms like "create"/"delete" are NOT accepted, so nothing wider than PROFESSOR_MARI_APP_DATA_ACTIONS.
    const unsupported = await mari.executeAction({ action: "instruction.create", data: { name: "x", content: "y" } });
    assert.equal(unsupported.ok, false, "a non-canonical instruction sub-action is rejected (executable surface == declared catalog)");
    assert.match(String(unsupported.error ?? ""), /Unsupported instruction action/i, "the rejection names the unsupported action");
  } finally {
    await db._fileStore.close();
  }
} finally {
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}

console.log("Mari instructions-memory regressions passed.");

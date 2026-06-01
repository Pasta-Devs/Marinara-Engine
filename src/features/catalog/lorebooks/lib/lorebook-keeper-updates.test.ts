import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLorebookKeeperUpdate } from "./lorebook-keeper-updates";
import { lorebookCommandApi } from "../../../../shared/api/lorebook-command-api";
import { storageApi } from "../../../../shared/api/storage-api";
import type { PendingLorebookUpdate } from "../../../../shared/stores/agent.store";

vi.mock("../../../../shared/api/lorebook-command-api", () => ({
  lorebookCommandApi: {
    vectorize: vi.fn(),
  },
}));

vi.mock("../../../../shared/api/storage-api", () => ({
  storageApi: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

function keeperUpdate(overrides: Partial<PendingLorebookUpdate> = {}): PendingLorebookUpdate {
  return {
    id: "pending-1",
    chatId: "chat-1",
    lorebookId: "lorebook-1",
    lorebookName: "Session Lore",
    action: "update",
    entryId: "entry-1",
    entryName: "Old Dock",
    content: "The old dock is haunted.",
    newFacts: [],
    keys: ["dock"],
    tag: "",
    reason: "",
    agentName: "Lorebook Keeper",
    timestamp: 1,
    ...overrides,
  };
}

describe("applyLorebookKeeperUpdate", () => {
  beforeEach(() => {
    vi.mocked(storageApi.create).mockReset();
    vi.mocked(storageApi.delete).mockReset();
    vi.mocked(storageApi.get).mockReset();
    vi.mocked(storageApi.list).mockReset();
    vi.mocked(storageApi.update).mockReset();
    vi.mocked(lorebookCommandApi.vectorize).mockReset();
    vi.mocked(lorebookCommandApi.vectorize).mockResolvedValue({ vectorized: 1, skipped: 0 });
  });

  it("auto-vectorizes the entry created by Lorebook Keeper", async () => {
    vi.mocked(storageApi.create).mockResolvedValue({ id: "created-entry", lorebookId: "lorebook-1" });

    const result = await applyLorebookKeeperUpdate(keeperUpdate({ action: "create", entryId: null }));

    expect(result).toMatchObject({
      applied: true,
      entryId: "created-entry",
      vectorization: { status: "vectorized", vectorized: 1, skipped: 0 },
    });
    expect(lorebookCommandApi.vectorize).toHaveBeenCalledWith("lorebook-1", {
      onlyMissing: true,
      entryIds: ["created-entry"],
    });
  });

  it("clears stale embeddings and re-vectorizes changed existing entries", async () => {
    vi.mocked(storageApi.get).mockResolvedValue({
      id: "entry-1",
      lorebookId: "lorebook-1",
      name: "Old Dock",
      content: "The old dock exists.",
      keys: ["dock"],
      locked: false,
      tag: "",
    });
    vi.mocked(storageApi.update).mockResolvedValue({ id: "entry-1", lorebookId: "lorebook-1" });

    const result = await applyLorebookKeeperUpdate(keeperUpdate({ newFacts: ["A ghost sings there."] }));

    expect(storageApi.update).toHaveBeenCalledWith(
      "lorebook-entries",
      "entry-1",
      expect.objectContaining({ embedding: null }),
    );
    expect(result.vectorization).toMatchObject({ status: "vectorized", vectorized: 1 });
    expect(lorebookCommandApi.vectorize).toHaveBeenCalledWith("lorebook-1", {
      onlyMissing: true,
      entryIds: ["entry-1"],
    });
  });

  it("does not block the Keeper apply when auto-vectorization fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(storageApi.create).mockResolvedValue({ id: "created-entry", lorebookId: "lorebook-1" });
    vi.mocked(lorebookCommandApi.vectorize).mockRejectedValue(new Error("No embedding connection is configured"));

    const result = await applyLorebookKeeperUpdate(keeperUpdate({ action: "create", entryId: null }));

    expect(result).toMatchObject({
      applied: true,
      entryId: "created-entry",
      vectorization: { status: "failed", error: "No embedding connection is configured" },
    });
    warn.mockRestore();
  });

  it("does not vectorize deletes or unchanged updates", async () => {
    vi.mocked(storageApi.get).mockResolvedValue({
      id: "entry-1",
      lorebookId: "lorebook-1",
      name: "Old Dock",
      content: "The old dock is haunted.",
      keys: ["dock"],
      locked: false,
      tag: "",
    });

    const unchanged = await applyLorebookKeeperUpdate(keeperUpdate());
    const deleted = await applyLorebookKeeperUpdate(keeperUpdate({ action: "delete" }));

    expect(unchanged.applied).toBe(false);
    expect(deleted.applied).toBe(true);
    expect(lorebookCommandApi.vectorize).not.toHaveBeenCalled();
  });
});

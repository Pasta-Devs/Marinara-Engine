import { describe, expect, it } from "vitest";
import type { LlmGateway } from "../../../capabilities/llm";
import type { StorageGateway } from "../../../capabilities/storage";
import type { EncounterActionRequest } from "../../../contracts/types/combat-encounter";
import { resolveRoleplayEncounterAction } from "./encounter-service";

type JsonRecord = Record<string, unknown>;

const CHAT: JsonRecord = {
  id: "chat-1",
  name: "Encounter",
  mode: "roleplay",
  personaId: null,
  characterIds: [],
  connectionId: "conn-1",
  metadata: {},
};

/** Minimal storage that resolves the chat + a default connection and returns
 *  empty collections for everything else, so the action path runs end to end. */
function fakeStorage(): StorageGateway {
  return {
    list: async <T>() => [] as T[],
    get: async <T>(entity: string, id: string) => {
      if (entity === "chats" && id === "chat-1") return CHAT as T;
      if (entity === "connections" && id === "conn-1") return { id: "conn-1", name: "Test" } as T;
      return null as T | null;
    },
    create: async <T>() => ({}) as T,
    update: async <T>() => ({}) as T,
    delete: async () => ({ deleted: true }),
    listChatMessages: async () => [],
    createChatMessage: async <T>() => ({}) as T,
    updateChatMessage: async <T>() => ({}) as T,
    deleteChatMessage: async () => ({ deleted: true }),
    patchChatMessageExtra: async <T>() => ({}) as T,
    addChatMessageSwipe: async <T>() => ({}) as T,
    patchChatMetadata: async <T>() => ({}) as T,
    patchChatSummaries: async <T>() => ({}) as T,
    listChatMemories: async () => [],
    getWorldState: async <T>() => null as T | null,
    saveTrackerSnapshot: async <T>() => ({}) as T,
    listLorebookEntries: async () => [],
    createLorebookEntries: async () => [],
    promptFull: async <T>() => null as T | null,
  };
}

/** LlmGateway whose `complete` is fully controllable (resolve text or reject). */
function fakeLlm(complete: () => Promise<string>): LlmGateway {
  return {
    complete,
    // eslint-disable-next-line require-yield
    stream: async function* () {
      throw new Error("stream is not used in these tests");
    },
    listModels: async () => [],
  };
}

const NARRATIVE = { tense: "present", person: "second", narration: "limited", pov: "" } as const;

function actionRequest(): EncounterActionRequest {
  return {
    chatId: "chat-1",
    connectionId: null,
    action: "I swing my sword at the dummy.",
    combatStats: {
      party: [{ name: "Hero", hp: 20, maxHp: 24, attacks: [], items: [], statuses: [], isPlayer: true }],
      enemies: [{ name: "Dummy", hp: 18, maxHp: 18, attacks: [], statuses: [], description: "", sprite: "" }],
      environment: "a training hall",
    },
    playerActions: { attacks: [], items: [] },
    encounterLog: [],
    settings: { combatNarrative: NARRATIVE, summaryNarrative: NARRATIVE, historyDepth: 0 },
    spellbookId: null,
  };
}

describe("resolveRoleplayEncounterAction invalid-response handling (issue #1520)", () => {
  it("flags invalid (and does not invent a turn) when the model output is not JSON", async () => {
    const storage = fakeStorage();
    const llm = fakeLlm(async () => "A13_MALFORMED_NON_JSON_RESPONSE");

    const res = await resolveRoleplayEncounterAction({ storage, llm }, actionRequest());

    // Caller must treat this as a retryable failure and leave combat unchanged;
    // res.result is only a placeholder fallback and must not be applied.
    expect(res.invalid).toBe(true);
  });

  it("flags invalid when the LLM call itself fails", async () => {
    const storage = fakeStorage();
    const llm = fakeLlm(async () => {
      throw new Error("provider timeout");
    });

    const res = await resolveRoleplayEncounterAction({ storage, llm }, actionRequest());

    expect(res.invalid).toBe(true);
  });

  it("resolves a real turn (not invalid) for a valid JSON action response", async () => {
    const storage = fakeStorage();
    const llm = fakeLlm(async () =>
      JSON.stringify({
        combatStats: {
          party: [{ name: "Hero", hp: 20, maxHp: 24, isPlayer: true }],
          enemies: [{ name: "Dummy", hp: 0, maxHp: 18 }],
        },
        narrative: "The dummy splinters.",
        combatEnd: true,
        result: "victory",
      }),
    );

    const res = await resolveRoleplayEncounterAction({ storage, llm }, actionRequest());

    expect(res.invalid).toBeFalsy();
    expect(res.result.result).toBe("victory");
    expect(res.result.narrative).toContain("dummy");
  });

  it("does not flag a present-but-partial JSON response (it is still a real turn)", async () => {
    const storage = fakeStorage();
    const llm = fakeLlm(async () => JSON.stringify({ narrative: "Something happened." }));

    const res = await resolveRoleplayEncounterAction({ storage, llm }, actionRequest());

    // A real record missing `result`/`combatStats` is sanitized from input,
    // NOT treated as invalid — only a null parse (unparseable / LLM error) is.
    expect(res.invalid).toBeFalsy();
    expect(res.result).toBeDefined();
  });
});

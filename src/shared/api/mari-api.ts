import type { MariEntryRequest, MariGatewayResponse, MariMessage } from "../../engine/mari/mari-entry";
import { EMPTY_MARI_COMPACTION, type MariCompactionState } from "../../engine/mari/mari-history";
import { storageApi } from "./storage-api";
import { invokeTauri } from "./tauri-client";

const PROFESSOR_MARI_SETTINGS_ID = "professor-mari";

export type ProfessorMariPreferences = {
  selectedConnectionId: string | null;
  selectedPersonaId: string | null;
};

type ProfessorMariSettingsRecord = {
  value?: unknown;
};

type StoredMessageRecord = {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  createdAt?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizePreferences(value: unknown): ProfessorMariPreferences {
  const object = asRecord(value);
  const selectedConnectionId =
    typeof object.selectedConnectionId === "string" && object.selectedConnectionId.trim()
      ? object.selectedConnectionId
      : null;
  const selectedPersonaId =
    typeof object.selectedPersonaId === "string" && object.selectedPersonaId.trim() ? object.selectedPersonaId : null;
  return { selectedConnectionId, selectedPersonaId };
}

function normalizeCompaction(value: unknown): MariCompactionState {
  const object = asRecord(value);
  return {
    compactedSummary:
      typeof object.compactedSummary === "string" && object.compactedSummary.trim() ? object.compactedSummary : null,
    compactedAt: typeof object.compactedAt === "string" && object.compactedAt.trim() ? object.compactedAt : null,
    compactedThroughMessageId:
      typeof object.compactedThroughMessageId === "string" && object.compactedThroughMessageId.trim()
        ? object.compactedThroughMessageId
        : null,
  };
}

function normalizeMariMessage(record: StoredMessageRecord): MariMessage | null {
  const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
  const id = typeof record.id === "string" && record.id.trim() ? record.id : null;
  const content = typeof record.content === "string" ? record.content : null;
  const createdAt = typeof record.createdAt === "string" && record.createdAt.trim() ? record.createdAt : null;
  if (!role || !id || content === null || !createdAt) return null;
  return { id, role, content, createdAt };
}

function createMariMessage(message: { role: "user" | "assistant"; content: string }): MariMessage {
  const nonce =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `professor-mari-message-${nonce}`,
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString(),
  };
}

function normalizeMariMessages(value: unknown): MariMessage[] {
  const object = asRecord(value);
  const rawMessages = Array.isArray(object.messages) ? object.messages : [];
  return rawMessages
    .map((message) => normalizeMariMessage(asRecord(message) as StoredMessageRecord))
    .filter((message): message is MariMessage => !!message);
}

async function readSettingsValue(): Promise<Record<string, unknown>> {
  const record = await storageApi.get<ProfessorMariSettingsRecord>("app-settings", PROFESSOR_MARI_SETTINGS_ID);
  return asRecord(record?.value);
}

async function saveSettingsPatch(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const value = {
    ...(await readSettingsValue()),
    ...patch,
  };
  await storageApi.create("app-settings", {
    id: PROFESSOR_MARI_SETTINGS_ID,
    value,
  });
  return value;
}

export const mariApi = {
  prompt: (request: MariEntryRequest) =>
    invokeTauri<MariGatewayResponse>("professor_mari_prompt", {
      request,
    }),
  preferences: {
    get: async (): Promise<ProfessorMariPreferences> => {
      return normalizePreferences(await readSettingsValue());
    },
    save: async (preferences: ProfessorMariPreferences): Promise<ProfessorMariPreferences> => {
      return normalizePreferences(
        await saveSettingsPatch({
          selectedConnectionId: preferences.selectedConnectionId,
          selectedPersonaId: preferences.selectedPersonaId,
        }),
      );
    },
  },
  history: {
    get: async (): Promise<{ messages: MariMessage[]; compaction: MariCompactionState }> => {
      const settings = await readSettingsValue();
      return {
        messages: normalizeMariMessages(settings),
        compaction: normalizeCompaction(settings),
      };
    },
    appendMessage: async (message: { role: "user" | "assistant"; content: string }): Promise<MariMessage> => {
      const settings = await readSettingsValue();
      const nextMessage = createMariMessage(message);
      await saveSettingsPatch({
        messages: [...normalizeMariMessages(settings), nextMessage],
      });
      return nextMessage;
    },
    saveCompaction: async (compaction: MariCompactionState): Promise<MariCompactionState> =>
      normalizeCompaction(
        await saveSettingsPatch({
          compactedSummary: compaction.compactedSummary,
          compactedAt: compaction.compactedAt,
          compactedThroughMessageId: compaction.compactedThroughMessageId,
        }),
      ),
    reset: async (): Promise<void> => {
      await saveSettingsPatch({ ...EMPTY_MARI_COMPACTION, messages: [] });
    },
  },
};

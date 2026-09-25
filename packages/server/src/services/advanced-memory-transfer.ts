import { z } from "zod";
import { normalizeAdvancedMemorySettings, normalizeChatSummaryEntries } from "@marinara-engine/shared";
import type { DB } from "../db/connection.js";
import { advancedMemoryRecords } from "../db/schema/advanced-memory.js";
import { newId } from "../utils/id-generator.js";
import {
  advancedMemorySourceFingerprint,
  createAdvancedMemoryService,
  type AdvancedMemoryMessage,
} from "./advanced-memory.js";

const transferRecordSchema = z.object({
  valid: z.boolean(),
  sourceDigest: z.string(),
  record: z.object({
    id: z.string().min(1),
    sceneId: z.string().min(1),
    kind: z.enum(["scene", "continuity", "temporary", "excerpt"]),
    status: z.enum(["open", "closed"]),
    startMessageId: z.string().min(1),
    endMessageId: z.string().min(1),
    messageIds: z.array(z.string().min(1)).min(1),
    audienceCharacterIds: z.array(z.string().min(1)),
    content: z.string(),
    title: z.string(),
    timeline: z.string().nullable(),
    enabled: z.boolean(),
    manualOverride: z.boolean(),
    sourceFingerprint: z.string(),
    dependencies: z.array(z.object({ id: z.string(), revision: z.string() })),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

/** Keep explicit knowledge permissions, never turn an unavailable anchor into "from the beginning". */
export function remapAdvancedMemoryMetadata(
  metadata: Record<string, unknown>,
  messageIds: ReadonlyMap<string, string>,
  characterIds: readonly string[],
): Record<string, unknown> {
  const result = { ...metadata };
  delete result.advancedMemoryState;
  delete result.advancedMemoryTransfer;
  if (metadata.advancedMemory) {
    const settings = normalizeAdvancedMemorySettings(metadata.advancedMemory);
    const knowledgeStarts: Record<string, string | null> = {};
    for (const [characterId, anchor] of Object.entries(settings.knowledgeStarts)) {
      if (!characterIds.includes(characterId)) continue;
      if (anchor === null) knowledgeStarts[characterId] = null;
      else if (messageIds.has(anchor)) knowledgeStarts[characterId] = messageIds.get(anchor)!;
    }
    result.advancedMemory = {
      ...settings,
      knowledgeStarts,
      knowledgeConfirmed: false,
      narratorCharacterId:
        settings.narratorCharacterId && characterIds.includes(settings.narratorCharacterId)
          ? settings.narratorCharacterId
          : null,
    };
  }
  if (Array.isArray(metadata.advancedMemoryRosterChanges)) {
    result.advancedMemoryRosterChanges = metadata.advancedMemoryRosterChanges.flatMap((event) => {
      if (!event || typeof event !== "object") return [];
      const value = event as Record<string, unknown>;
      if (typeof value.characterId !== "string" || (value.action !== "joined" && value.action !== "left")) return [];
      if (
        value.afterMessageId !== null &&
        (typeof value.afterMessageId !== "string" || !messageIds.has(value.afterMessageId))
      )
        return [];
      return [
        {
          characterId: value.characterId,
          action: value.action,
          afterMessageId: typeof value.afterMessageId === "string" ? messageIds.get(value.afterMessageId)! : null,
        },
      ];
    });
  }
  return result;
}

/** Copy only source-supported artifacts; a branch inside a scene retains an empty, open scaffold. */
export async function copyAdvancedMemoryRecords(input: {
  db: DB;
  chatId: string;
  records: unknown;
  sourceMessages: readonly AdvancedMemoryMessage[];
  messageIds: ReadonlyMap<string, string>;
  characterIds: readonly string[];
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!Array.isArray(input.records)) return;
  const sources = new Map(input.sourceMessages.map((message) => [message.id, message]));
  const summaryIds = new Set(normalizeChatSummaryEntries(input.metadata.summaryEntries).map((entry) => entry.id));
  const seenRecordIds = new Set<string>();
  const candidates = input.records.flatMap((value) => {
    const parsed = transferRecordSchema.safeParse(value);
    if (!parsed.success) return [];
    const { record, sourceDigest, valid } = parsed.data;
    if (seenRecordIds.has(record.id)) return [];
    seenRecordIds.add(record.id);
    if (record.audienceCharacterIds.some((id) => !input.characterIds.includes(id))) return [];
    const covered = record.messageIds.map((id) => sources.get(id));
    const verified =
      valid &&
      covered.every(Boolean) &&
      advancedMemorySourceFingerprint(covered as AdvancedMemoryMessage[]) === sourceDigest;
    const scaffold = record.kind === "scene" && record.id === record.sceneId && !record.content;
    const retained = record.messageIds.filter((id) => input.messageIds.has(id));
    const complete =
      retained.length === record.messageIds.length &&
      input.messageIds.has(record.startMessageId) &&
      input.messageIds.has(record.endMessageId);
    if (!retained.length || (!complete && !scaffold)) return [];
    if (!verified && !record.manualOverride && record.enabled) return [];
    const start = input.messageIds.get(record.startMessageId) ?? input.messageIds.get(retained[0]!)!;
    const end = input.messageIds.get(record.endMessageId) ?? input.messageIds.get(retained.at(-1)!)!;
    const scenePrefix = /^(scene|continuity|temporary)-(.+)$/u.exec(record.sceneId);
    const sceneAnchor = scenePrefix ? input.messageIds.get(scenePrefix[2]!) : undefined;
    if (!sceneAnchor) return [];
    const sceneId = `${scenePrefix![1]}-${sceneAnchor}`;
    return [
      {
        oldId: record.id,
        record: {
          ...record,
          id: scaffold ? sceneId : newId(),
          sceneId,
          chatId: input.chatId,
          status: !complete ? ("open" as const) : record.status,
          startMessageId: start,
          endMessageId: end,
          messageIds: retained.map((id) => input.messageIds.get(id)!),
          enabled: record.enabled && verified,
        },
      },
    ];
  });
  let retained = candidates;
  // Missing dependencies can cascade after a mid-scene branch; never retain a digest of omitted future facts.
  for (;;) {
    const ids = new Set(retained.map((item) => item.oldId));
    const next = retained.filter(({ record }) =>
      record.dependencies.every((dependency) =>
        dependency.id.startsWith("record:")
          ? ids.has(dependency.id.slice(7))
          : dependency.id.startsWith("summary:")
            ? summaryIds.has(dependency.id.slice(8))
            : dependency.id === "boundary" && dependency.revision
              ? input.messageIds.has(dependency.revision)
              : true,
      ),
    );
    if (next.length === retained.length) break;
    retained = next;
  }
  const recordIds = new Map(retained.map((item) => [item.oldId, item.record.id]));
  for (const { record } of retained) {
    const dependencies = record.dependencies.map((dependency) => ({
      id: dependency.id.startsWith("record:") ? `record:${recordIds.get(dependency.id.slice(7))!}` : dependency.id,
      revision:
        dependency.id === "boundary" && dependency.revision
          ? input.messageIds.get(dependency.revision)!
          : dependency.revision,
    }));
    await input.db.insert(advancedMemoryRecords).values({
      ...record,
      messageIds: JSON.stringify(record.messageIds),
      audienceCharacterIds: JSON.stringify(record.audienceCharacterIds),
      dependencies: JSON.stringify(dependencies),
      enabled: record.enabled ? 1 : 0,
      manualOverride: record.manualOverride ? 1 : 0,
      embedding: null,
      embeddingSpaceId: null,
    });
  }
  if (retained.length) await createAdvancedMemoryService(input.db).refreshTransferredRecords(input.chatId);
}

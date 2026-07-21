// ──────────────────────────────────────────────
// Storage: dangling connection reference cleanup
// ──────────────────────────────────────────────
//
// Deleting a connection currently leaves every stored reference to its id
// untouched: chat.connectionId, agentConfig.connectionId,
// connection.embeddingConnectionId, and the large family of *ConnectionId
// keys stored inside chat.metadata (illustratorPromptConnectionId,
// gameImageConnectionId, gameSceneConnectionId, sceneVideoConnectionId,
// imageGenConnectionId, agentOverrides.<type>.imageConnectionId, …).
//
// Some resolution paths handle a dangling id gracefully (skip the affected
// feature with a warning); others do not, and a dangling id can silently
// misroute a request to an unrelated connection or hang far longer than a
// normal request. Rather than hardening every individual resolution path
// (and every future one that stores a new *ConnectionId field), this module
// removes the dangling reference at the source, the moment the connection
// is deleted.
//
// The sweep over chat.metadata and agentConfig.settings is generic rather
// than a hardcoded field list: any JSON key ending in "ConnectionId" is
// treated as a connection reference, at any nesting depth. This matches the
// naming convention already used consistently for every such field in this
// codebase, and stays correct as new *ConnectionId settings are added
// without requiring this file to be updated in lockstep.

import { eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { apiConnections, chats, agentConfigs } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

const CLEANUP_BATCH_SIZE = 250;

type ConnectionReferenceCleanupResult = {
  chatsUpdated: number;
  agentsUpdated: number;
  connectionsUpdated: number;
};

/**
 * Returns rewritten serialized JSON only when an object contains a matching
 * `*ConnectionId` reference. Malformed and non-object roots are left alone.
 */
function serializeNullifiedConnectionIdReferences(
  raw: unknown,
  deletedConnectionId: string,
): string | undefined {
  if (typeof raw !== "string" && (!raw || typeof raw !== "object" || Array.isArray(raw))) {
    return undefined;
  }

  const serialized = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (serialized === undefined || !serialized.trimStart().startsWith("{")) return undefined;

  let changed = false;
  try {
    const parsed = JSON.parse(serialized, (key, value: unknown) => {
      if (/[Cc]onnectionId$/.test(key) && value === deletedConnectionId) {
        changed = true;
        return null;
      }
      return value;
    }) as unknown;
    return changed ? JSON.stringify(parsed) : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/**
 * Clears every stored reference to `deletedConnectionId`: the direct
 * `connectionId` columns on chats and agent configs, `embeddingConnectionId`
 * on other connections, and any `*ConnectionId` key inside chat metadata or
 * agent settings (however deeply nested). Call this once the connection
 * itself has been removed (or is about to be); it is a no-op if nothing
 * references the id.
 */
export async function sweepDanglingConnectionReferences(
  db: DB,
  deletedConnectionId: string,
): Promise<ConnectionReferenceCleanupResult> {
  const result: ConnectionReferenceCleanupResult = { chatsUpdated: 0, agentsUpdated: 0, connectionsUpdated: 0 };
  if (!deletedConnectionId) return result;

  const danglingEmbeddingRefs = await db
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.embeddingConnectionId, deletedConnectionId));
  if (danglingEmbeddingRefs.length > 0) {
    await db
      .update(apiConnections)
      .set({ embeddingConnectionId: null, updatedAt: now() })
      .where(eq(apiConnections.embeddingConnectionId, deletedConnectionId));
    result.connectionsUpdated = danglingEmbeddingRefs.length;
  }

  for (let offset = 0; ; offset += CLEANUP_BATCH_SIZE) {
    const chatRows = await db
      .select()
      .from(chats)
      .orderBy(chats.id)
      .limit(CLEANUP_BATCH_SIZE)
      .offset(offset);
    for (const chat of chatRows) {
      const metadata = serializeNullifiedConnectionIdReferences(chat.metadata, deletedConnectionId);
      const directMatch = chat.connectionId === deletedConnectionId;
      if (metadata === undefined && !directMatch) continue;

      await db
        .update(chats)
        .set({
          connectionId: directMatch ? null : chat.connectionId,
          metadata: metadata ?? chat.metadata,
          updatedAt: now(),
        })
        .where(eq(chats.id, chat.id));
      result.chatsUpdated += 1;
    }
    if (chatRows.length < CLEANUP_BATCH_SIZE) break;
  }

  for (let offset = 0; ; offset += CLEANUP_BATCH_SIZE) {
    const agentRows = await db
      .select()
      .from(agentConfigs)
      .orderBy(agentConfigs.id)
      .limit(CLEANUP_BATCH_SIZE)
      .offset(offset);
    for (const agent of agentRows) {
      const settings = serializeNullifiedConnectionIdReferences(agent.settings, deletedConnectionId);
      const directMatch = agent.connectionId === deletedConnectionId;
      if (settings === undefined && !directMatch) continue;

      await db
        .update(agentConfigs)
        .set({
          connectionId: directMatch ? null : agent.connectionId,
          settings: settings ?? agent.settings,
          updatedAt: now(),
        })
        .where(eq(agentConfigs.id, agent.id));
      result.agentsUpdated += 1;
    }
    if (agentRows.length < CLEANUP_BATCH_SIZE) break;
  }

  return result;
}

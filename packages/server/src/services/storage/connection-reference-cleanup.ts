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

export type ConnectionReferenceCleanupResult = {
  chatsUpdated: number;
  agentsUpdated: number;
  connectionsUpdated: number;
};

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Recursively replaces any `"...ConnectionId": "<deletedId>"` entry, at any
 * nesting depth, with `null`. Returns the (possibly new) value plus whether
 * anything changed, so callers can skip writing back unchanged rows.
 */
export function nullifyConnectionIdReferences(
  value: unknown,
  deletedConnectionId: string,
): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = nullifyConnectionIdReferences(item, deletedConnectionId);
      if (result.changed) changed = true;
      return result.value;
    });
    return changed ? { value: next, changed: true } : { value, changed: false };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/ConnectionId$/.test(key) && entry === deletedConnectionId) {
        next[key] = null;
        changed = true;
        continue;
      }
      const result = nullifyConnectionIdReferences(entry, deletedConnectionId);
      if (result.changed) changed = true;
      next[key] = result.value;
    }
    return changed ? { value: next, changed: true } : { value, changed: false };
  }

  return { value, changed: false };
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
      const metadata = parseJsonObject(chat.metadata);
      const swept = nullifyConnectionIdReferences(metadata, deletedConnectionId);
      const directMatch = chat.connectionId === deletedConnectionId;
      if (!swept.changed && !directMatch) continue;

      await db
        .update(chats)
        .set({
          connectionId: directMatch ? null : chat.connectionId,
          metadata: swept.changed ? JSON.stringify(swept.value) : chat.metadata,
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
      const settings = parseJsonObject(agent.settings);
      const swept = nullifyConnectionIdReferences(settings, deletedConnectionId);
      const directMatch = agent.connectionId === deletedConnectionId;
      if (!swept.changed && !directMatch) continue;

      await db
        .update(agentConfigs)
        .set({
          connectionId: directMatch ? null : agent.connectionId,
          settings: swept.changed ? JSON.stringify(swept.value) : agent.settings,
          updatedAt: now(),
        })
        .where(eq(agentConfigs.id, agent.id));
      result.agentsUpdated += 1;
    }
    if (agentRows.length < CLEANUP_BATCH_SIZE) break;
  }

  return result;
}

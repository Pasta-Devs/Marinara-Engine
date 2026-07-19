import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { BUILT_IN_AGENT_MANIFESTS } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { capabilityPackageManager } from "../services/capability-packages/package-manager.service.js";
import { capabilityModuleRuntime } from "../services/capability-packages/capability-module-runtime.service.js";
import { refreshCapabilityAgentRegistry } from "../services/capability-packages/capability-agent-registry.service.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";

const packageParams = z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) });

function removeAgentMapEntries(value: unknown, agentIds: ReadonlySet<string>): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  const filtered = entries.filter(([agentId]) => !agentIds.has(agentId));
  return filtered.length === entries.length ? null : Object.fromEntries(filtered);
}

export function buildCapabilityAgentCleanupPatch(
  metadata: Record<string, unknown>,
  packageAgentIds: readonly string[],
): Record<string, unknown> | null {
  const agentIds = new Set(packageAgentIds);
  const patch: Record<string, unknown> = {};
  const activeAgentIds = Array.isArray(metadata.activeAgentIds)
    ? metadata.activeAgentIds.filter((candidate: unknown): candidate is string => typeof candidate === "string")
    : [];
  const filteredActiveAgentIds = activeAgentIds.filter((agentId) => !agentIds.has(agentId));
  if (filteredActiveAgentIds.length !== activeAgentIds.length) patch.activeAgentIds = filteredActiveAgentIds;

  for (const key of ["agentOverrides", "agentPromptTemplateIds", "knowledgeAgentSources"] as const) {
    const filtered = removeAgentMapEntries(metadata[key], agentIds);
    if (filtered) patch[key] = filtered;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function capabilityPackagesRoutes(app: FastifyInstance) {
  app.get("/catalog", async () => capabilityPackageManager.catalog());
  app.get("/installed", async () => capabilityPackageManager.installed());
  app.get("/agents", async () => BUILT_IN_AGENT_MANIFESTS);
  app.get<{ Params: { id: string } }>("/:id/client", async (request, reply) => {
    const { id } = packageParams.parse(request.params);
    const entrypoint = await capabilityPackageManager.clientEntrypoint(id);
    if (!entrypoint) return reply.status(404).send({ error: "Active client package not found" });
    reply.header("Content-Type", "text/javascript; charset=utf-8");
    reply.header("Cache-Control", "no-cache, must-revalidate");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(await readFile(entrypoint.file));
  });
  app.post<{ Params: { id: string } }>("/:id/install", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Agent package installation" })) return;
    const { id } = packageParams.parse(request.params);
    const installed = await capabilityPackageManager.install(id);
    try {
      return installed.manifest.kind.includes("turn-game")
        ? await capabilityModuleRuntime.activatePackage(app, id)
        : installed;
    } finally {
      await refreshCapabilityAgentRegistry();
    }
  });
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Agent package removal" })) return;
    const { id } = packageParams.parse(request.params);
    await capabilityModuleRuntime.deactivatePackage(id);
    const removed = await capabilityPackageManager.uninstall(id);
    if (!removed) return reply.status(404).send({ error: "Package not found" });
    const chats = createChatsStorage(app.db);
    for (const chat of await chats.list()) {
      let metadata: Record<string, unknown> = {};
      try {
        const parsed = typeof chat.metadata === "string" ? (JSON.parse(chat.metadata) as unknown) : chat.metadata;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
      } catch {
        continue;
      }
      const patch = buildCapabilityAgentCleanupPatch(metadata, removed.agentIds);
      if (patch) await chats.patchMetadata(chat.id, patch, { touchUpdatedAt: false });
    }
    const agents = createAgentsStorage(app.db);
    for (const agentId of removed.agentIds) {
      const agentConfig = await agents.getByType(agentId);
      if (agentConfig) await agents.remove(agentConfig.id);
    }
    await refreshCapabilityAgentRegistry();
    return {
      restartRequired:
        !removed.manifest.kind.includes("turn-game") &&
        Boolean(removed.manifest.entrypoints.server || removed.manifest.entrypoints.client),
    };
  });
}

import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { BUILT_IN_AGENT_MANIFESTS } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import {
  capabilityPackageManager,
  CapabilityPackageVersionMismatchError,
} from "../services/capability-packages/package-manager.service.js";
import { capabilityModuleRuntime } from "../services/capability-packages/capability-module-runtime.service.js";
import { refreshCapabilityAgentRegistry } from "../services/capability-packages/capability-agent-registry.service.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";

const packageParams = z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) });
const packageAssetParams = packageParams.extend({ "*": z.string().min(1).max(240) });
const packageVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  .max(80);
const packageUpdateParams = packageParams.extend({ version: packageVersion });
const installBody = z.object({ expectedVersion: packageVersion.optional() }).optional();

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

  for (const key of ["agentOverrides", "agentPromptTemplateIds", "knowledgeAgentSources", "customAgentImageSettings"] as const) {
    const filtered = removeAgentMapEntries(metadata[key], agentIds);
    if (filtered) patch[key] = filtered;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export async function capabilityPackagesRoutes(app: FastifyInstance) {
  app.get("/catalog", async () => capabilityPackageManager.catalog());
  app.get("/installed", async () => capabilityPackageManager.installed());
  app.get("/updates/pending", async () => capabilityPackageManager.pendingUpdates());
  app.get("/agents", async () => BUILT_IN_AGENT_MANIFESTS);
  app.post<{ Params: { id: string; version: string } }>("/:id/updates/:version/decline", async (request, reply) => {
    if (!requirePrivilegedAccess(request, reply, { feature: "Agent update decline" })) return;
    const { id, version } = packageUpdateParams.parse(request.params);
    if (!(await capabilityPackageManager.declineUpdate(id, version))) {
      return reply.status(409).send({ error: "This Agent update is no longer available" });
    }
    return { declined: true };
  });
  app.get<{ Params: { id: string } }>("/:id/client", async (request, reply) => {
    const { id } = packageParams.parse(request.params);
    const entrypoint = await capabilityPackageManager.clientEntrypoint(id);
    if (!entrypoint) return reply.status(404).send({ error: "Active client package not found" });
    reply.header("Content-Type", "text/javascript; charset=utf-8");
    reply.header("Cache-Control", "no-cache, must-revalidate");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(await readFile(entrypoint.file));
  });
  app.get<{ Params: { id: string; "*": string } }>("/:id/assets/*", async (request, reply) => {
    const { id, "*": assetPath } = packageAssetParams.parse(request.params);
    const asset = await capabilityPackageManager.browserTabAsset(id, assetPath);
    if (!asset) return reply.status(404).send({ error: "Active package asset not found" });
    reply.header("Content-Type", asset.contentType);
    reply.header("Cache-Control", "private, no-cache, must-revalidate");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(await readFile(asset.file));
  });
  app.post<{ Params: { id: string }; Body: { expectedVersion?: string } | undefined }>(
    "/:id/install",
    async (request, reply) => {
      if (!requirePrivilegedAccess(request, reply, { feature: "Agent package installation" })) return;
      const { id } = packageParams.parse(request.params);
      const { expectedVersion } = installBody.parse(request.body) ?? {};
      let installed;
      try {
        installed = await capabilityPackageManager.install(id, expectedVersion);
      } catch (error) {
        if (error instanceof CapabilityPackageVersionMismatchError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      try {
        return installed.manifest.kind.includes("turn-game") && installed.status !== "restart-required"
          ? await capabilityModuleRuntime.activatePackage(app, id)
          : installed;
      } finally {
        await refreshCapabilityAgentRegistry();
      }
    },
  );
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

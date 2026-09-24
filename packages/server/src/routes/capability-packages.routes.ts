import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  BUILT_IN_AGENT_MANIFESTS,
  type InstalledRuleset,
  type ListedRulesetDefinition,
  type RulesetCatalogEntry,
  type RulesetCatalogPayload,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { openRulesetCatalog } from "../services/game/ruleset-catalog.service.js";
import { readRulesetRegistry } from "../services/game/ruleset-registry.service.js";
import {
  capabilityPackageManager,
  CapabilityPackageVersionMismatchError,
} from "../services/capability-packages/package-manager.service.js";
import { capabilityModuleRuntime } from "../services/capability-packages/capability-module-runtime.service.js";
import { refreshCapabilityAgentRegistry } from "../services/capability-packages/capability-agent-registry.service.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";

const rulesetVersionQuery = z.object({
  rulesetId: z.string().min(1).max(140),
  version: z.coerce.number().int().min(1),
});
const packageParams = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
});

/** Ids are only ever looked up, never joined into a path: the asset path is built from the catalog
 *  the definition itself declares, so an id nothing matches is a 404 and nothing more. */
const rulesetCatalogQuery = z.object({
  rulesetId: z.string().min(1).max(140),
  catalogId: z.string().min(1).max(40),
  version: z.coerce.number().int().min(1).optional(),
});

/** The definition as the ruleset LIST reports it: an inline catalog's entries are replaced by their
 *  count, because the list is read whenever a sheet editor opens and the entries have a route of
 *  their own. A ruleset with no catalogs is passed through untouched, byte for byte. */
function listedRulesetDefinition(definition: RulesetDefinition): ListedRulesetDefinition {
  if (!definition.catalogs) return definition;
  return {
    ...definition,
    catalogs: definition.catalogs.map(({ entries, ...header }) =>
      entries ? { ...header, entryCount: entries.length } : header,
    ),
  };
}

/** Strong ETag from the manifest-recorded sha256 — the same value the serve
 *  path re-verifies the bytes against, so the validator can never drift. */
function packageFileEtag(sha256Hex: string): string {
  return `"${sha256Hex}"`;
}

function ifNoneMatchSatisfied(headerValue: string | undefined, etag: string): boolean {
  if (!headerValue) return false;
  if (headerValue.trim() === "*") return true;
  // Weak comparison is fine for 304s: a W/-prefixed candidate with the same
  // hash still identifies the same bytes here.
  return headerValue.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === etag);
}
const packageAssetParams = packageParams.extend({ "*": z.string().min(1).max(240) });
const packageVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
  .max(80);
const packageUpdateParams = packageParams.extend({ version: packageVersion });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const installBody = z.object({ expectedVersion: packageVersion, expectedArtifactSha256: sha256 });

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

  for (const key of [
    "agentOverrides",
    "agentPromptTemplateIds",
    "knowledgeAgentSources",
    "customAgentImageSettings",
  ] as const) {
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
  // Every installed ruleset, whole, because the sheet editors are rendered from the definition.
  // A failed read is an error here, never an empty list: the editors call a stored sheet "not
  // installed" when its ruleset is absent, and must not say that because the lookup failed.
  // Imported rulesets are listed whatever the import policy says, for the same reason: an existing
  // sheet has to stay readable after the switch goes off. `source` is what tells the two apart.
  app.get("/rulesets", async (): Promise<InstalledRuleset[]> =>
    [...(await readRulesetRegistry(app.db)).values()].map(({ definition, packageId, source, versions }) => ({
      packageId,
      definition: listedRulesetDefinition(definition),
      ...(source ? { source } : {}),
      ...(versions ? { versions: [...versions.keys()].sort((left, right) => left - right) } : {}),
    })),
  );
  // One stored version of an IMPORTED ruleset. The list above carries only the newest definition,
  // but a game plays on the exact version it pinned, so the in-game sheet has to be able to ask for
  // that one. Official packages install a single version and are answered by the list alone.
  app.get("/rulesets/version", async (request, reply) => {
    const { rulesetId, version } = rulesetVersionQuery.parse(request.query);
    const registered = (await readRulesetRegistry(app.db)).get(rulesetId);
    const definition = registered?.versions?.get(version);
    if (!registered || !definition) {
      return reply
        .status(404)
        .send({ error: "That version of the ruleset is not installed", code: "ruleset_version_missing" });
    }
    const listed: InstalledRuleset = {
      packageId: registered.packageId,
      definition: listedRulesetDefinition(definition),
      ...(registered.source ? { source: registered.source } : {}),
      versions: [...registered.versions!.keys()].sort((left, right) => left - right),
    };
    return listed;
  });
  // Registered before the `/:id/...` routes so a package could never take the path. One catalog's
  // entries, which is the only part of a ruleset big enough to be worth asking for separately. No
  // privileged gate: it is read-only data of a ruleset this install already has, exactly like
  // `/rulesets`, and the picker that reads it is the ordinary sheet editor.
  app.get("/rulesets/catalog", async (request, reply) => {
    const { rulesetId, catalogId, version } = rulesetCatalogQuery.parse(request.query);
    const registered = (await readRulesetRegistry(app.db)).get(rulesetId);
    if (!registered) {
      return reply.status(404).send({ error: "That ruleset is not installed", code: "ruleset_not_installed" });
    }
    let definition = registered.definition;
    if (version !== undefined && version !== definition.version) {
      // A community ruleset keeps every version it was imported at, so a game built on an older one
      // picks its own entries rather than the author's latest.
      const exact = registered.versions?.get(version);
      if (!exact) {
        return reply
          .status(404)
          .send({ error: "That version of the ruleset is not installed", code: "ruleset_version_missing" });
      }
      definition = exact;
    }
    const catalog = definition.catalogs?.find((entry) => entry.id === catalogId);
    if (!catalog) {
      return reply.status(404).send({ error: "That ruleset has no such catalog", code: "ruleset_catalog_missing" });
    }
    const { entries: _inline, asset: _asset, ...header } = catalog;
    const payload = (entries: RulesetCatalogEntry[]): RulesetCatalogPayload => ({
      rulesetId: definition.id,
      version: definition.version,
      catalog: header,
      entries,
    });
    const unusable = (issues: string[]) =>
      reply.status(422).send({ error: "That catalog cannot be read", code: "ruleset_catalog_unusable", issues });
    const opened = await openRulesetCatalog(registered.packageId, definition, catalog);
    if (opened.kind === "missing") {
      return reply.status(404).send({ error: "That ruleset has no such catalog", code: "ruleset_catalog_missing" });
    }
    if (opened.kind === "unusable") return unusable(opened.issues);
    if (opened.kind === "inline") return payload(opened.entries);
    // A catalog can be a megabyte of JSON that is parsed and checked entry by entry. The pinned hash
    // names the file, and the ruleset version plus a digest of the catalog's header name what it was
    // checked against and answered with. A browser that already holds this answer is told so before
    // any of that work. `no-cache` still makes it ask.
    const headerDigest = createHash("sha256").update(JSON.stringify(header)).digest("hex").slice(0, 16);
    const etag = `"${opened.sha256}.${definition.version}.${headerDigest}"`;
    reply.header("ETag", etag).header("Cache-Control", "no-cache");
    if (ifNoneMatchSatisfied(request.headers["if-none-match"], etag)) return reply.status(304).send();
    const read = await opened.read();
    if (!read.ok) return unusable(read.issues);
    return payload(read.entries);
  });
  app.get<{ Params: { id: string } }>("/:id/release-notes", async (request) => {
    const { id } = packageParams.parse(request.params);
    return capabilityPackageManager.releaseNotes(id);
  });
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
    // Deliberately NOT immutable, even though the URL carries ?v=: a package
    // author (or the catalog) can republish the same version string with
    // different bytes during development, and an immutable client bundle would
    // pin the stale copy with no way to evict it short of a hard reload.
    // no-cache + a strong ETag keeps "always revalidate" semantics while
    // letting the revalidation answer 304 instead of re-sending the body.
    const etag = packageFileEtag(entrypoint.sha256);
    reply.header("Cache-Control", "no-cache, must-revalidate");
    reply.header("ETag", etag);
    reply.header("X-Content-Type-Options", "nosniff");
    if (ifNoneMatchSatisfied(request.headers["if-none-match"], etag)) {
      return reply.status(304).send();
    }
    reply.header("Content-Type", "text/javascript; charset=utf-8");
    // The verification step already read and hashed these exact bytes.
    return reply.send(entrypoint.data);
  });
  app.get<{ Params: { id: string; "*": string } }>("/:id/assets/*", async (request, reply) => {
    const { id, "*": assetPath } = packageAssetParams.parse(request.params);
    const asset = await capabilityPackageManager.packageAsset(id, assetPath);
    if (!asset) return reply.status(404).send({ error: "Active package asset not found" });
    const etag = packageFileEtag(asset.sha256);
    // Never `immutable`: install policy permits republishing the SAME version
    // with different bytes (assertNotDowngrade refuses only lower versions),
    // and the URL carries no content digest — an immutable response could pin
    // stale art for a year. no-cache + the hash ETag keeps revalidation cheap:
    // an unchanged asset answers 304 with no body.
    reply.header("Cache-Control", "private, no-cache, must-revalidate");
    reply.header("ETag", etag);
    reply.header("X-Content-Type-Options", "nosniff");
    if (ifNoneMatchSatisfied(request.headers["if-none-match"], etag)) {
      return reply.status(304).send();
    }
    reply.header("Content-Type", asset.contentType);
    // The verification step read and hashed these exact bytes.
    return reply.send(asset.data);
  });
  app.post<{ Params: { id: string }; Body: { expectedVersion: string; expectedArtifactSha256: string } }>(
    "/:id/install",
    async (request, reply) => {
      if (!requirePrivilegedAccess(request, reply, { feature: "Agent package installation" })) return;
      const { id } = packageParams.parse(request.params);
      const { expectedVersion, expectedArtifactSha256 } = installBody.parse(request.body);
      let installed;
      try {
        installed = await capabilityPackageManager.install(id, expectedVersion, expectedArtifactSha256);
      } catch (error) {
        if (error instanceof CapabilityPackageVersionMismatchError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      try {
        const result =
          installed.manifest.kind.includes("turn-game") && installed.status !== "restart-required"
            ? await capabilityModuleRuntime.activatePackage(app, id)
            : installed;
        return { ...result, usesDecisions: installed.usesDecisions };
      } finally {
        // A restart-required update leaves the prior runtime active in this
        // process. Keep its agent definitions visible until startup activates
        // the replacement; refreshing now would make the package disappear.
        if (installed.status !== "restart-required") await refreshCapabilityAgentRegistry();
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
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          metadata = parsed as Record<string, unknown>;
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

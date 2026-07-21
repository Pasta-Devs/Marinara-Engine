// ──────────────────────────────────────────────
// Routes: Installed Extensions
// ──────────────────────────────────────────────
//
// CRUD plus runtime status. Browser extension JS is fetched as part of the
// list payload and loaded client-side by `CustomThemeInjector.tsx`; server
// extension JS is executed by `serverExtensionRuntime`. There is no separate
// script-serving endpoint.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createExtensionSchema,
  extensionStoragePatchSchema,
  updateExtensionSchema,
  type InstalledExtension,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createExtensionsStorage } from "../services/storage/extensions.storage.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createExtensionSettingsStorage } from "../services/extensions/extension-storage.service.js";
import { serverExtensionRuntime } from "../services/extensions/server-extension-runtime.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export async function extensionsRoutes(app: FastifyInstance) {
  const storage = createExtensionsStorage(app.db);
  const extensionSettings = createExtensionSettingsStorage(createAppSettingsStorage(app.db));
  const withStatus = <T extends Awaited<ReturnType<typeof storage.getById>>>(extension: T): T =>
    (extension ? serverExtensionRuntime.withRuntimeStatus(extension) : extension) as T;
  const toPublicExtension = (extension: InstalledExtension): InstalledExtension => {
    const withRuntimeStatus = serverExtensionRuntime.withRuntimeStatus(extension);
    return withRuntimeStatus.runtime === "server" ? { ...withRuntimeStatus, serverJs: null } : withRuntimeStatus;
  };
  const resolveExtensionRef = async (extensionRef: string): Promise<InstalledExtension | null> => {
    const ref = extensionRef.trim();
    if (!ref) return null;
    const byId = ID_PATTERN.test(ref) ? await storage.getById(ref) : null;
    if (byId) return byId;
    const extensions = await storage.list();
    return extensions.find((extension) => extension.name === ref) ?? null;
  };

  app.get("/", async () => {
    const extensions = await storage.list();
    return extensions.map(toPublicExtension);
  });

  app.post("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Extension install/update/delete" })) return;
    const input = createExtensionSchema.parse(req.body);
    const existing = await storage.getByName(input.name);
    const installed = existing ? await storage.update(existing.id, input) : await storage.create(input);
    if (!installed) throw new Error(`Failed to install extension ${input.name}`);
    if (existing?.runtime === "server" || installed?.runtime === "server") {
      await serverExtensionRuntime.reloadExtension(installed.id);
    }
    return withStatus(installed);
  });

  app.get<{ Params: { extensionRef: string } }>("/:extensionRef/storage", async (req, reply) => {
    const extension = await resolveExtensionRef(req.params.extensionRef);
    if (!extension) return reply.status(404).send({ error: "Extension not found" });
    return { value: await extensionSettings.get(extension.id) };
  });

  app.patch<{ Params: { extensionRef: string } }>("/:extensionRef/storage", async (req, reply) => {
    const extension = await resolveExtensionRef(req.params.extensionRef);
    if (!extension) return reply.status(404).send({ error: "Extension not found" });
    const patch = extensionStoragePatchSchema.parse(req.body ?? {});
    return { value: await extensionSettings.patch(extension.id, patch) };
  });

  app.delete<{ Params: { extensionRef: string } }>("/:extensionRef/storage", async (req, reply) => {
    const extension = await resolveExtensionRef(req.params.extensionRef);
    if (!extension) return reply.status(404).send({ error: "Extension not found" });
    await extensionSettings.remove(extension.id);
    return { value: {} };
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Extension install/update/delete" })) return;
    if (!ID_PATTERN.test(req.params.id)) {
      return reply.status(404).send({ error: "Extension not found" });
    }
    const data = updateExtensionSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Extension not found" });
    const updated = await storage.update(req.params.id, data);
    if (existing.runtime === "server" || updated?.runtime === "server") {
      await serverExtensionRuntime.reloadExtension(req.params.id);
    }
    return withStatus(updated);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Extension install/update/delete" })) return;
    if (!ID_PATTERN.test(req.params.id)) {
      return reply.status(404).send({ error: "Extension not found" });
    }
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Extension not found" });
    await extensionSettings.remove(existing.id);
    await storage.remove(req.params.id);
    if (existing.runtime === "server") await serverExtensionRuntime.unloadExtension(existing.id);
    return reply.status(204).send();
  });
}

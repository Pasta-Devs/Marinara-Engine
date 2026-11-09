// ──────────────────────────────────────────────
// Routes: Synced Custom Themes
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createThemeSchema, setActiveThemeSchema, updateThemeSchema } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createThemesStorage } from "../services/storage/themes.storage.js";
import { isStarterThemeId } from "../services/storage/starter-themes.js";

const STARTER_READ_ONLY = "Starter themes are read-only. Clone it to make your own copy.";

export async function themesRoutes(app: FastifyInstance) {
  const storage = createThemesStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.post("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    const input = createThemeSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    if (isStarterThemeId(req.params.id)) return reply.status(403).send({ error: STARTER_READ_ONLY });
    const data = updateThemeSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Theme not found" });
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    if (isStarterThemeId(req.params.id)) return reply.status(403).send({ error: STARTER_READ_ONLY });
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Theme not found" });
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // Activation only selects CSS that a privileged user already installed, so
  // keep it available to same-origin LAN clients such as mobile browsers.
  app.put("/active", async (req, reply) => {
    const input = setActiveThemeSchema.parse(req.body);
    if (input.id !== null) {
      const existing = await storage.getById(input.id);
      if (!existing) return reply.status(404).send({ error: "Theme not found" });
    }
    return storage.setActive(input.id);
  });
}

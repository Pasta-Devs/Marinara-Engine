// ──────────────────────────────────────────────
// Routes: Synced Custom Themes
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createThemeSchema, setActiveThemeSchema, updateThemeSchema } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createThemesStorage } from "../services/storage/themes.storage.js";
import { isStarterThemeId } from "../services/storage/starter-themes.js";
import {
  downloadGalleryTheme,
  fetchThemeGallery,
  ThemeGalleryNotFoundError,
} from "../services/themes/theme-gallery.service.js";
import { logger } from "../lib/logger.js";

const STARTER_READ_ONLY = "Starter themes are read-only. Clone it to make your own copy.";

export async function themesRoutes(app: FastifyInstance) {
  const storage = createThemesStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  // Theme gallery: starter themes are downloaded only when someone picks one.
  app.get<{ Querystring: { refresh?: string } }>("/gallery", async (req, reply) => {
    try {
      const { entries } = await fetchThemeGallery(req.query.refresh === "1");
      return { themes: entries.map(({ file: _file, sha256: _sha, ...entry }) => entry) };
    } catch (error) {
      logger.warn(error, "[themes] Could not load the theme gallery");
      return reply.status(502).send({ error: "Couldn't reach the theme gallery. Check the internet connection." });
    }
  });

  app.post<{ Params: { id: string } }>("/gallery/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    try {
      const theme = await downloadGalleryTheme(req.params.id);
      return await storage.saveStarter(theme);
    } catch (error) {
      if (error instanceof ThemeGalleryNotFoundError) return reply.status(404).send({ error: error.message });
      logger.warn(error, `[themes] Could not download gallery theme ${req.params.id}`);
      return reply.status(502).send({ error: "Couldn't download that theme. Try again in a moment." });
    }
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
    // A starter theme can be removed (it's only a downloaded copy); the gallery can download it again.
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

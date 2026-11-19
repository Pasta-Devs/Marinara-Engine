// ──────────────────────────────────────────────
// Routes: Synced Custom Themes
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createThemeSchema, setActiveThemeSchema, updateThemeSchema } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createThemesStorage } from "../services/storage/themes.storage.js";
import { isStarterThemeId, STARTER_THEME_PREFIX } from "../services/storage/starter-themes.js";
import {
  downloadGalleryTheme,
  fetchThemeGallery,
  ThemeGalleryNotFoundError,
} from "../services/themes/theme-gallery.service.js";
import { logger } from "../lib/logger.js";

function hasTemplates(meta: unknown): boolean {
  const templates = (meta as { templates?: unknown } | null | undefined)?.templates;
  if (!templates || typeof templates !== "object") return false;
  return Object.values(templates as Record<string, unknown>).some((value) =>
    typeof value === "string" ? value.trim().length > 0 : value != null,
  );
}

const STARTER_READ_ONLY = "Starter themes are read-only. Clone it to make your own copy.";
import { notFound } from "../utils/not-found.js";

export async function themesRoutes(app: FastifyInstance) {
  const storage = createThemesStorage(app.db);

  // Starter themes are read-only copies of the gallery, so a newer gallery version replaces them without asking.
  // Otherwise an install keeps an old copy (and its old fixes) until someone opens the gallery and presses Update.
  const updateInstalledStarters = async () => {
    const starters = (await storage.list()).filter((theme) => isStarterThemeId(theme.id));
    if (!starters.length) return;
    const { entries } = await fetchThemeGallery(true);
    for (const theme of starters) {
      const entry = entries.find((item) => `${STARTER_THEME_PREFIX}${item.id}` === theme.id);
      if (!entry?.version || theme.meta?.version === entry.version) continue;
      try {
        const update = await downloadGalleryTheme(entry.id);
        // An update that brings HTML templates the installed copy didn't have waits for someone to press
        // Update in the gallery: new kinds of content are never added to an install in the background.
        if (hasTemplates(update.meta) && !hasTemplates(theme.meta)) {
          logger.info(
            `[themes] Starter theme ${entry.id} ${entry.version} adds HTML templates; left for a manual update`,
          );
          continue;
        }
        await storage.saveStarter(update);
        logger.info(`[themes] Updated starter theme ${entry.id} to ${entry.version}`);
      } catch (error) {
        logger.warn(error, `[themes] Could not update starter theme ${entry.id}`);
      }
    }
  };
  if (process.env.NODE_ENV !== "test") {
    const run = () =>
      void updateInstalledStarters().catch((error) => logger.debug(error, "[themes] Starter update skipped"));
    setTimeout(run, 10_000).unref();
    setInterval(run, 6 * 60 * 60 * 1000).unref();
  }

  // Themes carry their pictures (several MB with a few installed). An ETag lets a browser that already holds
  // this exact list get a 304 instead of the whole body on each app start; "no-cache" still asks every time,
  // so an edit or a new pick shows at once.
  app.get("/", async (req, reply) => {
    const body = JSON.stringify(await storage.list());
    const etag = `"themes-${createHash("sha1").update(body).digest("base64url")}"`;
    reply.header("ETag", etag).header("Cache-Control", "private, no-cache").type("application/json; charset=utf-8");
    const ifNoneMatch = req.headers["if-none-match"];
    if (
      typeof ifNoneMatch === "string" &&
      ifNoneMatch.split(",").some((value) => value.trim().replace(/^W\//u, "") === etag)
    ) {
      return reply.code(304).send();
    }
    return reply.send(body);
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
    if (!existing) return notFound(reply, "Theme not found");
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    // A starter theme can be removed (it's only a downloaded copy); the gallery can download it again.
    const existing = await storage.getById(req.params.id);
    if (!existing) return notFound(reply, "Theme not found");
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // Activation only selects CSS that a privileged user already installed, so
  // keep it available to same-origin LAN clients such as mobile browsers.
  app.put("/active", async (req, reply) => {
    const input = setActiveThemeSchema.parse(req.body);
    if (input.id !== null) {
      const existing = await storage.getById(input.id);
      if (!existing) return notFound(reply, "Theme not found");
    }
    return storage.setActive(input.id);
  });
}

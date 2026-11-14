// ──────────────────────────────────────────────
// Routes: Synced Custom Themes
// ──────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createThemeSchema, setActiveThemeSchema, updateThemeSchema } from "@marinara-engine/shared";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { createThemesStorage } from "../services/storage/themes.storage.js";

export async function themesRoutes(app: FastifyInstance) {
  const storage = createThemesStorage(app.db);

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

  app.post("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    const input = createThemeSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
    const data = updateThemeSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Theme not found" });
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Theme install/update/delete" })) return;
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

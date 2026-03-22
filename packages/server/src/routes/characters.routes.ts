// ──────────────────────────────────────────────
// Routes: Characters, Personas & Groups
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  createCharacterSchema,
  createGroupSchema,
  updateGroupSchema,
  PROFESSOR_MARI_ID,
} from "@marinara-engine/shared";
import type { ExportEnvelope } from "@marinara-engine/shared";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";

export async function charactersRoutes(app: FastifyInstance) {
  const storage = createCharactersStorage(app.db);

  // ── Characters ──

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    return char;
  });

  app.post("/", async (req) => {
    const input = createCharacterSchema.parse(req.body);
    const body = req.body as Record<string, unknown>;
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    return storage.create(input.data, avatarPath);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const body = req.body as Record<string, unknown>;
    const update = createCharacterSchema.partial().parse(req.body);
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    return storage.update(req.params.id, update.data ?? {}, avatarPath);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (req.params.id === PROFESSOR_MARI_ID) {
      return reply.status(403).send({ error: "Professor Mari is a built-in character and cannot be deleted" });
    }
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    const charData = JSON.parse(char.data);
    const envelope: ExportEnvelope = {
      type: "marinara_character",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { spec: "chara_card_v2", spec_version: "2.0", data: charData },
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(charData.name || "character")}.marinara.json"`,
      )
      .send(envelope);
  });

  // ── Avatar Upload ──

  app.post<{ Params: { id: string } }>("/:id/avatar", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const body = req.body as { avatar?: string; filename?: string };
    if (!body.avatar) {
      return reply.status(400).send({ error: "No avatar data provided" });
    }

    // avatar is a base64 data URL or raw base64
    let base64 = body.avatar;
    let ext = "png";
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:image\/([\w+]+);base64,/);
      if (match?.[1]) {
        ext = match[1].replace("+xml", "");
        base64 = base64.slice(base64.indexOf(",") + 1);
      }
    }

    const avatarsDir = join(DATA_DIR, "avatars");
    await mkdir(avatarsDir, { recursive: true });
    const filename = `${id}.${ext}`;
    const filepath = join(avatarsDir, filename);
    await writeFile(filepath, Buffer.from(base64, "base64"));

    const avatarPath = `/api/avatars/file/${filename}`;
    return storage.updateAvatar(id, avatarPath);
  });

  // ── Personas ──

  app.get("/personas/list", async () => {
    return storage.listPersonas();
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    return persona;
  });

  app.post("/personas", async (req) => {
    const { name, description } = req.body as { name: string; description?: string };
    return storage.createPersona(name, description ?? "");
  });

  app.patch<{ Params: { id: string } }>("/personas/:id", async (req) => {
    const body = req.body as Record<string, unknown>;
    return storage.updatePersona(req.params.id, body);
  });

  app.post<{ Params: { id: string } }>("/personas/:id/avatar", async (req, reply) => {
    const body = req.body as { avatar?: string; filename?: string };
    if (!body.avatar) return reply.status(400).send({ error: "No avatar data" });
    let base64 = body.avatar;
    if (base64.includes(",")) base64 = base64.split(",")[1]!;
    const filename = body.filename ?? `persona-${req.params.id}-${Date.now()}.png`;
    const avatarsDir = join(DATA_DIR, "avatars");
    await mkdir(avatarsDir, { recursive: true });
    const filepath = join(avatarsDir, filename);
    await writeFile(filepath, Buffer.from(base64, "base64"));
    const avatarPath = `/api/avatars/file/${filename}`;
    return storage.updatePersona(req.params.id, { avatarPath });
  });

  app.put<{ Params: { id: string } }>("/personas/:id/activate", async (req) => {
    await storage.setActivePersona(req.params.id);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    await storage.removePersona(req.params.id);
    return reply.status(204).send();
  });

  // ── Persona Export ──

  app.get<{ Params: { id: string } }>("/personas/:id/export", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      avatarPath: _a,
      isActive: _ia,
      ...personaData
    } = persona as Record<string, unknown>;
    const envelope: ExportEnvelope = {
      type: "marinara_persona",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: personaData,
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(String(persona.name || "persona"))}.marinara.json"`,
      )
      .send(envelope);
  });

  // ── Character Groups ──

  app.get("/groups/list", async () => {
    return storage.listGroups();
  });

  app.get<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    const group = await storage.getGroupById(req.params.id);
    if (!group) return reply.status(404).send({ error: "Group not found" });
    return group;
  });

  app.post("/groups", async (req) => {
    const input = createGroupSchema.parse(req.body);
    return storage.createGroup(input.name, input.description ?? "", input.characterIds ?? []);
  });

  app.patch<{ Params: { id: string } }>("/groups/:id", async (req) => {
    const input = updateGroupSchema.parse(req.body);
    return storage.updateGroup(req.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    await storage.removeGroup(req.params.id);
    return reply.status(204).send();
  });
}

// ──────────────────────────────────────────────
// Routes: Chat Presets
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  chatModeSchema,
  createChatPresetSchema,
  updateChatPresetSchema,
  chatPresetSettingsSchema,
  type ChatMode,
  type ChatPreset,
  type ChatPresetSettings,
  type ExportEnvelope,
} from "@marinara-engine/shared";
import { createChatPresetsStorage, sanitizePresetSettings } from "../services/storage/chat-presets.storage.js";

function toSafeExportName(name: string, fallback: string) {
  const sanitized = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return sanitized || fallback;
}

interface ChatPresetExportPayload {
  name: string;
  mode: ChatMode;
  settings: ChatPresetSettings;
}

export async function chatPresetsRoutes(app: FastifyInstance) {
  const storage = createChatPresetsStorage(app.db);

  // Make sure system defaults exist before serving any request.
  await storage.ensureDefaults();

  // ── List / Get ──

  app.get("/", async (req) => {
    const query = req.query as { mode?: string };
    if (query.mode) {
      const parsed = chatModeSchema.safeParse(query.mode);
      if (parsed.success) return storage.listByMode(parsed.data);
    }
    return storage.list();
  });

  app.get<{ Params: { mode: string } }>("/active/:mode", async (req, reply) => {
    const parsed = chatModeSchema.safeParse(req.params.mode);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid chat mode" });
    return (await storage.getActive(parsed.data)) ?? (await storage.getDefault(parsed.data));
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Chat preset not found" });
    return preset;
  });

  // ── Create / Update ──

  app.post("/", async (req) => {
    const input = createChatPresetSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const input = updateChatPresetSchema.parse(req.body);
    const updated = await storage.update(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Chat preset not found" });
    return updated;
  });

  /** Save a settings snapshot into a preset (the "Save" button). */
  app.put<{ Params: { id: string } }>("/:id/settings", async (req, reply) => {
    const input = chatPresetSettingsSchema.parse(req.body ?? {});
    const updated = await storage.saveSettings(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Chat preset not found" });
    return updated;
  });

  /** Duplicate a preset (the "Save As" button). */
  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const body = (req.body ?? {}) as { name?: string };
    const duplicated = await storage.duplicate(req.params.id, body.name);
    if (!duplicated) return reply.status(404).send({ error: "Chat preset not found" });
    return duplicated;
  });

  /** Mark a preset as the active one for its mode. */
  app.post<{ Params: { id: string } }>("/:id/set-active", async (req, reply) => {
    const updated = await storage.setActive(req.params.id);
    if (!updated) return reply.status(404).send({ error: "Chat preset not found" });
    return updated;
  });

  /** Apply a preset's settings to an existing chat (replaces preset-controlled settings). */
  app.post<{ Params: { id: string; chatId: string } }>("/:id/apply/:chatId", async (req, reply) => {
    const updated = await storage.applyToChat(req.params.id, req.params.chatId);
    if (!updated) return reply.status(404).send({ error: "Preset or chat not found" });
    return updated;
  });

  // ── Delete ──

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const removed = await storage.remove(req.params.id);
    if (!removed) {
      const existing = await storage.getById(req.params.id);
      if (!existing) return reply.status(404).send({ error: "Chat preset not found" });
      return reply.status(400).send({ error: "Cannot delete the default preset" });
    }
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Chat preset not found" });
    const payload: ChatPresetExportPayload = {
      name: preset.name,
      mode: preset.mode,
      settings: preset.settings,
    };
    const envelope: ExportEnvelope<ChatPresetExportPayload> = {
      type: "marinara_chat_preset",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: payload,
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(toSafeExportName(preset.name, "chat-preset"))}.marinara-chat-preset.json"`,
      )
      .header("Content-Type", "application/json")
      .send(envelope);
  });

  // ── Import ──

  app.post("/import", async (req, reply) => {
    const body = req.body as Partial<ExportEnvelope<ChatPresetExportPayload>> | null;
    if (!body || body.type !== "marinara_chat_preset" || !body.data) {
      return reply.status(400).send({ error: "Invalid chat preset envelope" });
    }
    const data = body.data;
    const modeParsed = chatModeSchema.safeParse(data.mode);
    if (!modeParsed.success) return reply.status(400).send({ error: "Invalid chat mode in envelope" });
    if (typeof data.name !== "string" || !data.name.trim()) {
      return reply.status(400).send({ error: "Preset name is required" });
    }
    const settings = sanitizePresetSettings(data.settings ?? {});
    const created = (await storage.importPreset({
      name: data.name.trim().slice(0, 120),
      mode: modeParsed.data,
      settings,
    })) as ChatPreset | null;
    return created;
  });
}

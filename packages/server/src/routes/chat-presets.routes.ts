// ──────────────────────────────────────────────
// Routes: Chat settings profiles (legacy route/storage names use "chat preset")
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  chatModeSchema,
  createChatPresetSchema,
  updateChatPresetSchema,
  chatPresetSettingsSchema,
  type ChatMode,
  type ChatPresetSettings,
  type ExportEnvelope,
} from "@marinara-engine/shared";
import { createChatPresetsStorage } from "../services/storage/chat-presets.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";

function toSafeExportName(name: string, fallback: string) {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

interface ChatSettingsProfileExportPayload {
  name: string;
  mode: ChatMode | "visual_novel";
  settings: ChatPresetSettings;
}

export async function chatPresetsRoutes(app: FastifyInstance) {
  const storage = createChatPresetsStorage(app.db);
  const chatsStorage = createChatsStorage(app.db);

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
    if (!preset) return reply.status(404).send({ error: "Settings profile not found" });
    return preset;
  });

  // ── Create / Update ──

  app.post("/", async (req) => {
    const input = createChatPresetSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const input = updateChatPresetSchema.parse(req.body);
    const existing = await storage.getById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Settings profile not found" });
    if (existing.isDefault && input.name !== undefined && input.name !== existing.name) {
      return reply.status(400).send({ error: "Cannot rename the Default settings profile" });
    }
    const updated = await storage.update(req.params.id, input);
    return updated;
  });

  /** Save a settings snapshot into a profile (the "Save" button). */
  app.put<{ Params: { id: string } }>("/:id/settings", async (req, reply) => {
    const input = chatPresetSettingsSchema.parse(req.body ?? {});
    const updated = await storage.saveSettings(req.params.id, input);
    if (!updated) return reply.status(404).send({ error: "Settings profile not found" });
    return updated;
  });

  /** Duplicate a profile (the "Save As" button). */
  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const body = (req.body ?? {}) as { name?: string };
    const duplicated = await storage.duplicate(req.params.id, body.name);
    if (!duplicated) return reply.status(404).send({ error: "Settings profile not found" });
    return duplicated;
  });

  /** Mark a profile as the active one for its mode. */
  app.post<{ Params: { id: string } }>("/:id/set-active", async (req, reply) => {
    const updated = await storage.setActive(req.params.id);
    if (!updated) return reply.status(404).send({ error: "Settings profile not found" });
    return updated;
  });

  /** Apply a profile's settings to an existing chat (replaces profile-controlled settings). */
  app.post<{ Params: { id: string; chatId: string } }>("/:id/apply/:chatId", async (req, reply) => {
    const [preset, chat] = await Promise.all([storage.getById(req.params.id), chatsStorage.getById(req.params.chatId)]);
    if (!preset || !chat) return reply.status(404).send({ error: "Settings profile or chat not found" });
    if (preset.mode !== chat.mode) {
      return reply.status(409).send({ error: "Settings profile mode does not match chat mode" });
    }
    const body = (req.body ?? {}) as { connectionId?: unknown };
    const connectionId =
      typeof body.connectionId === "string" ? body.connectionId : body.connectionId === null ? null : undefined;
    const updated = await storage.applyToChat(req.params.id, req.params.chatId, { connectionId });
    if (!updated) return reply.status(404).send({ error: "Settings profile or chat not found" });
    return updated;
  });

  // ── Delete ──

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const removed = await storage.remove(req.params.id);
    if (!removed) {
      const existing = await storage.getById(req.params.id);
      if (!existing) return reply.status(404).send({ error: "Settings profile not found" });
      return reply.status(400).send({ error: "Cannot delete the default settings profile" });
    }
    return reply.status(204).send();
  });

  // ── Export ──

  app.get<{ Params: { id: string } }>("/:id/export", async (req, reply) => {
    const preset = await storage.getById(req.params.id);
    if (!preset) return reply.status(404).send({ error: "Settings profile not found" });
    const payload: ChatSettingsProfileExportPayload = {
      name: preset.name,
      mode: preset.mode,
      settings: preset.settings,
    };
    const envelope: ExportEnvelope<ChatSettingsProfileExportPayload> = {
      type: "marinara_chat_settings_profile",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: payload,
    };
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(toSafeExportName(preset.name, "settings-profile"))}.marinara-settings-profile.json"`,
      )
      .header("Content-Type", "application/json")
      .send(envelope);
  });

  // ── Import ──

  app.post("/import", async (req, reply) => {
    const body = req.body as Partial<ExportEnvelope<ChatSettingsProfileExportPayload>> | null;
    if (
      !body ||
      (body.type !== "marinara_chat_settings_profile" && body.type !== "marinara_chat_preset") ||
      !body.data
    ) {
      return reply.status(400).send({ error: "Invalid settings profile file" });
    }
    const data = body.data;
    const modeParsed = chatModeSchema.safeParse(data.mode === "visual_novel" ? "roleplay" : data.mode);
    if (!modeParsed.success) return reply.status(400).send({ error: "Invalid chat mode in envelope" });
    if (typeof data.name !== "string" || !data.name.trim()) {
      return reply.status(400).send({ error: "Profile name is required" });
    }
    const settingsParsed = chatPresetSettingsSchema.safeParse(data.settings ?? {});
    if (!settingsParsed.success) {
      return reply.status(400).send({ error: "Invalid settings profile settings" });
    }
    const created = await storage.create({
      name: data.name.trim().slice(0, 120),
      mode: modeParsed.data,
      settings: settingsParsed.data,
    });
    return created;
  });
}

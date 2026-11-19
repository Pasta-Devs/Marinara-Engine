// ──────────────────────────────────────────────
// Routes: streaming emotion classifier for avatars (lane: director)
// ──────────────────────────────────────────────
// Registered at /api/avatar-classify (AVATAR_API_PREFIXES.classify):
//   POST /       AvatarClassifyRequest (avatarClassifyRequestSchema) → AvatarClassifyResponse
//   GET  /model  AvatarEmotionModelStatus: the local model's download and load state, for the agents' pages
//   POST /model  { chatId } → AvatarEmotionModelStatus. Downloads (when missing) and loads the local model, only
//                for a Roleplay chat that has 2D or 3D Avatars turned on and installed; 409 otherwise.
//   POST /model/download  → AvatarEmotionModelStatus. The Built-in model (emotions) page's Download (privileged).
//   POST /model/remove    → AvatarEmotionModelStatus. Unloads it and deletes its files (privileged).
// Backed by services/avatars/emotion-classifier.ts. Rate limited in middleware/rate-limit.ts.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AVATAR_AGENT_IDS,
  avatarClassifyRequestSchema,
  isInstalledCapabilityReady,
  parseAgentSettingsRecord,
} from "@marinara-engine/shared";
import { AVATAR_CLASSIFY_RATE_LIMIT } from "../middleware/rate-limit.js";
import {
  avatarEmotionModelStatus,
  classifyAvatarEmotions,
  prepareAvatarEmotionModel,
  isAvatarEmotionModelLoading,
  removeAvatarEmotionModel,
} from "../services/avatars/emotion-classifier.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { capabilityPackageManager } from "../services/capability-packages/package-manager.service.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";

const prepareModelSchema = z.object({ chatId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).strict();

export interface AvatarClassifyRoutesOptions {
  /** Whether the chat is a Roleplay chat with an installed avatar agent turned on (regressions replace it). */
  avatarAgentOnInChat?: (chatId: string) => Promise<boolean>;
}

export async function avatarClassifyRoutes(app: FastifyInstance, options: AvatarClassifyRoutesOptions = {}) {
  const avatarAgentOnInChat =
    options.avatarAgentOnInChat ??
    (async (chatId: string) => {
      const chat = await createChatsStorage(app.db).getById(chatId);
      if (!chat || chat.mode !== "roleplay") return false;
      const metadata = parseAgentSettingsRecord(chat.metadata);
      if (metadata.enableAgents !== true && metadata.enableAgents !== "true") return false;
      const active = Array.isArray(metadata.activeAgentIds) ? (metadata.activeAgentIds as unknown[]) : [];
      const turnedOn = AVATAR_AGENT_IDS.filter((id) => active.includes(id));
      if (turnedOn.length === 0) return false;
      const installed = await capabilityPackageManager.installed();
      return installed.some((item) => (turnedOn as string[]).includes(item.id) && isInstalledCapabilityReady(item));
    });

  app.post("/", { config: { rateLimit: AVATAR_CLASSIFY_RATE_LIMIT } }, async (req, reply) => {
    const parsed = avatarClassifyRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid classify request" });
    return classifyAvatarEmotions(parsed.data);
  });

  app.get("/model", { config: { rateLimit: AVATAR_CLASSIFY_RATE_LIMIT } }, async () => avatarEmotionModelStatus());

  app.post("/model", { config: { rateLimit: AVATAR_CLASSIFY_RATE_LIMIT } }, async (req, reply) => {
    const parsed = prepareModelSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid model request" });
    if (!(await avatarAgentOnInChat(parsed.data.chatId))) {
      return reply.status(409).send({ error: "No avatar agent is on in this Roleplay chat" });
    }
    // The download and load run on; the agents' pages follow them through GET /model.
    void prepareAvatarEmotionModel();
    return avatarEmotionModelStatus();
  });

  app.post("/model/download", { config: { rateLimit: AVATAR_CLASSIFY_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in emotion model download" })) return;
    if (avatarEmotionModelStatus().unsupported) return reply.status(409).send({ error: "This server cannot run it" });
    void prepareAvatarEmotionModel(true);
    return avatarEmotionModelStatus();
  });

  app.post("/model/remove", { config: { rateLimit: AVATAR_CLASSIFY_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Built-in emotion model removal" })) return;
    if (isAvatarEmotionModelLoading()) {
      return reply.status(409).send({ error: "Wait until the emotion model has finished downloading or starting" });
    }
    await removeAvatarEmotionModel();
    return avatarEmotionModelStatus();
  });
}

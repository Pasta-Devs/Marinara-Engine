// ──────────────────────────────────────────────
// Routes: Agents
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  createAgentConfigSchema,
  updateAgentConfigSchema,
  BUILT_IN_AGENTS,
  DEFAULT_AGENT_TOOLS,
  getDefaultBuiltInAgentSettings,
  normalizeAgentPhaseForType,
} from "@marinara-engine/shared";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../utils/security.js";
import { z } from "zod";

const AGENT_IMAGES_DIR = join(DATA_DIR, "agents", "images");

const updateAgentRunSchema = z.object({
  resultData: z.unknown(),
});

const secretPlotArcSchema = z
  .object({
    description: z.string().optional(),
    protagonistArc: z.string().optional(),
    characterArc: z.string().optional(),
    completed: z.boolean().optional(),
  })
  .passthrough();

const secretPlotDirectionTextSchema = z.string().trim().min(1);

const secretPlotMemoryPatchSchema = z
  .object({
    overarchingArc: z.union([z.string(), secretPlotArcSchema, z.null()]).optional(),
    sceneDirections: z
      .union([
        z.array(
          z.object({
            direction: secretPlotDirectionTextSchema,
            fulfilled: z.boolean().optional(),
          }),
        ),
        z.null(),
      ])
      .optional(),
    recentlyFulfilled: z.union([z.array(z.string()), z.null()]).optional(),
    staleDetected: z.union([z.boolean(), z.null()]).optional(),
    pacing: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

function normalizeSecretPlotMemoryPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const parsed = secretPlotMemoryPatchSchema.parse(patch);
  const normalized: Record<string, unknown> = { ...parsed };
  if ("sceneDirections" in parsed) {
    normalized.sceneDirections = (parsed.sceneDirections ?? [])
      .map((entry) => ({ ...entry, direction: entry.direction.trim() }))
      .filter((entry) => entry.direction.length > 0);
  }
  if ("recentlyFulfilled" in parsed) normalized.recentlyFulfilled = parsed.recentlyFulfilled ?? [];
  if ("staleDetected" in parsed) normalized.staleDetected = parsed.staleDetected === true;
  return normalized;
}

function parseAgentSettings(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeRunInterval(value: unknown, fallback: number, max = 100): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(max, Math.floor(parsed)) : fallback;
}

function parseImageUpload(image: string): { buffer: Buffer; hintedExt: string } {
  let base64 = image;
  let hintedExt = "png";
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:image\/([\w.+-]+);base64,/i);
    if (match?.[1]) {
      hintedExt = match[1].replace("+xml", "");
      base64 = base64.slice(base64.indexOf(",") + 1);
    }
  }
  return { buffer: Buffer.from(base64, "base64"), hintedExt };
}

function getSafeAgentImagePath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  try {
    return assertInsideDir(AGENT_IMAGES_DIR, join(AGENT_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

export async function agentsRoutes(app: FastifyInstance) {
  const storage = createAgentsStorage(app.db);
  const chats = createChatsStorage(app.db);
  const getOrCreateConfigByType = async (agentType: string) => {
    const existing = await storage.getByType(agentType);
    if (existing) return existing;
    const builtIn = BUILT_IN_AGENTS.find((a) => a.id === agentType);
    if (!builtIn) return null;
    return storage.create({
      type: builtIn.id,
      name: builtIn.name,
      description: builtIn.description,
      phase: normalizeAgentPhaseForType(builtIn.id, builtIn.phase),
      connectionId: null,
      imagePath: null,
      promptTemplate: "",
      settings: {
        ...getDefaultBuiltInAgentSettings(builtIn.id),
        ...(DEFAULT_AGENT_TOOLS[builtIn.id]?.length ? { enabledTools: DEFAULT_AGENT_TOOLS[builtIn.id] } : {}),
      },
    });
  };

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { filename: string } }>("/images/file/:filename", async (req, reply) => {
    const filepath = getSafeAgentImagePath(req.params.filename);
    if (!filepath || !existsSync(filepath)) return reply.status(404).send({ error: "Image not found" });

    const buffer = await readFile(filepath);
    const imageInfo = isAllowedImageBuffer(buffer, extname(filepath));
    if (!imageInfo) return reply.status(404).send({ error: "Image not found" });

    return reply
      .header("Content-Type", imageInfo.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(buffer);
  });

  /** Get editable custom-agent outputs for a roleplay chat. */
  app.get<{ Params: { chatId: string }; Querystring: { limit?: string } }>("/runs/:chatId/custom", async (req) => {
    const parsed = req.query.limit ? Number.parseInt(req.query.limit, 10) : undefined;
    const parsedLimit = Number.isFinite(parsed) ? parsed : undefined;
    return storage.listCustomRunsForChat(req.params.chatId, parsedLimit);
  });

  /** Get run interval status for built-in cadence-gated agents. */
  app.get<{ Params: { agentType: string; chatId: string } }>("/cadence/:agentType/:chatId", async (req, reply) => {
    const { agentType, chatId } = req.params;
    const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentType);
    if (!builtIn) return reply.status(404).send({ error: "Unknown agent type" });

    const defaults = getDefaultBuiltInAgentSettings(agentType);
    if (defaults.runInterval === undefined) {
      return reply.status(404).send({ error: "Agent does not use run intervals" });
    }
    const fallback = normalizeRunInterval(defaults.runInterval, 1);
    const config = await storage.getByType(agentType);
    const settings = { ...defaults, ...parseAgentSettings(config?.settings) };
    const runInterval = normalizeRunInterval(settings.runInterval, fallback);

    const lastRun = await storage.getLastSuccessfulRunByType(agentType, chatId);
    const messages = await chats.listMessages(chatId);
    let assistantMessagesSinceLastRun: number | null = null;
    let lastRunMessageFound: boolean | null = null;

    if (lastRun) {
      const lastRunIdx = messages.findIndex((message: any) => message.id === lastRun.messageId);
      lastRunMessageFound = lastRunIdx >= 0;
      assistantMessagesSinceLastRun =
        lastRunIdx >= 0
          ? messages.slice(lastRunIdx + 1).filter((message: any) => message.role === "assistant").length
          : runInterval;
    }

    const remainingAssistantMessages =
      runInterval <= 1 || !lastRun ? 0 : Math.max(0, runInterval - ((assistantMessagesSinceLastRun ?? 0) + 1));

    return {
      agentType,
      runInterval,
      lastSuccessfulRun: lastRun ? { messageId: lastRun.messageId, createdAt: lastRun.createdAt } : null,
      assistantMessagesSinceLastRun,
      remainingAssistantMessages,
      runsNextAssistantMessage: remainingAssistantMessages === 0,
      lastRunMessageFound,
    };
  });

  /** Edit the persisted output of a custom agent run. */
  app.patch<{ Params: { runId: string } }>("/runs/:runId", async (req, reply) => {
    const input = updateAgentRunSchema.parse(req.body);
    const run = await storage.getRunWithConfig(req.params.runId);
    if (!run) return reply.status(404).send({ error: "Agent run not found" });
    if (BUILT_IN_AGENTS.some((agent) => agent.id === run.agentType)) {
      return reply.status(403).send({ error: "Built-in agent runs are not editable here" });
    }
    return storage.updateRunResultData(req.params.runId, input.resultData);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const agent = await storage.getById(req.params.id);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });
    return agent;
  });

  app.post("/", async (req) => {
    const input = createAgentConfigSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { agentType: string } }>("/type/:agentType", async (req, reply) => {
    const config = await getOrCreateConfigByType(req.params.agentType);
    if (!config) {
      return reply.status(404).send({ error: "Agent is not configured" });
    }
    const data = updateAgentConfigSchema.parse(req.body);
    return storage.update(config.id, data);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = updateAgentConfigSchema.parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const config = (await storage.getById(req.params.id)) ?? (await getOrCreateConfigByType(req.params.id));
    if (!config) return reply.status(404).send({ error: "Agent not found" });

    const body = req.body as { image?: string };
    if (!body.image) return reply.status(400).send({ error: "No image data provided" });

    const { buffer, hintedExt } = parseImageUpload(body.image);
    const imageInfo = isAllowedImageBuffer(buffer, `.${hintedExt}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid agent image" });

    const ext = extensionFromImageMime(imageInfo.mimeType);
    await mkdir(AGENT_IMAGES_DIR, { recursive: true });
    const filename = `agent-${config.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(AGENT_IMAGES_DIR, join(AGENT_IMAGES_DIR, filename));
    await writeFile(filepath, buffer);

    const updated = await storage.update(config.id, { imagePath: `/api/agents/images/file/${filename}` });
    if (!updated) return reply.status(404).send({ error: "Agent not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const builtInByType = BUILT_IN_AGENTS.find((agent) => agent.id === req.params.id);
      const existing = builtInByType ? null : await storage.getById(req.params.id);
      const existingBuiltInType =
        existing && BUILT_IN_AGENTS.some((agent) => agent.id === existing.type) ? existing.type : null;

      if (builtInByType || existingBuiltInType) {
        await storage.softDeleteBuiltIn(builtInByType?.id ?? existingBuiltInType!);
      } else {
        await storage.remove(req.params.id);
      }
      return reply.status(204).send();
    } catch (err) {
      req.log.error(err, "Failed to delete agent %s", req.params.id);
      return reply.status(500).send({ error: "Failed to delete agent. Try restarting the server and retrying." });
    }
  });

  /** Legacy endpoint retained for compatibility. Agent activation is chat-scoped. */
  app.put<{ Params: { agentType: string } }>("/toggle/:agentType", async (req, reply) => {
    const { agentType } = req.params;
    const builtIn = BUILT_IN_AGENTS.find((a) => a.id === agentType);
    if (!builtIn) {
      return reply.status(404).send({ error: "Unknown agent type" });
    }

    const existing = await storage.getByType(agentType);
    if (existing) {
      return existing;
    }

    // First toggle — create a normal config; chats decide whether it runs.
    return storage.create({
      type: builtIn.id,
      name: builtIn.name,
      description: builtIn.description,
      phase: normalizeAgentPhaseForType(builtIn.id, builtIn.phase),
      connectionId: null,
      imagePath: null,
      promptTemplate: "",
      settings: {
        ...getDefaultBuiltInAgentSettings(builtIn.id),
        ...(DEFAULT_AGENT_TOOLS[builtIn.id]?.length ? { enabledTools: DEFAULT_AGENT_TOOLS[builtIn.id] } : {}),
      },
    });
  });

  /** Get echo chamber messages for a chat (for persistence across refreshes). */
  app.get<{ Params: { chatId: string } }>("/echo-messages/:chatId", async (req) => {
    return storage.getEchoMessages(req.params.chatId);
  });

  /** Clear all echo chamber messages for a chat. */
  app.delete<{ Params: { chatId: string } }>("/echo-messages/:chatId", async (req, reply) => {
    await storage.clearEchoMessages(req.params.chatId);
    return reply.status(204).send();
  });

  /** Clear all agent runs and memory for a specific chat. */
  app.delete<{ Params: { chatId: string } }>("/runs/:chatId", async (req, reply) => {
    const chatId = req.params.chatId;

    // Before wiping all memory, preserve Narrative Director's secret plot arc.
    // The arc is long-term structure that only clears when the Director is removed from the chat.
    let preservedArc: unknown;
    let preservedConfigId: string | null = null;
    try {
      for (const type of ["director", "secret-plot-driver"]) {
        const config = await storage.getByType(type);
        if (!config) continue;
        const mem = await storage.getMemory(config.id, chatId);
        if (mem.overarchingArc !== undefined && mem.overarchingArc !== null) {
          preservedArc = mem.overarchingArc;
          preservedConfigId = config.id;
          break;
        }
      }
    } catch {
      /* non-critical */
    }

    await storage.clearRunsForChat(chatId);
    await storage.clearMemoryForChat(chatId);

    // Restore the overarching arc
    if (preservedArc !== undefined && preservedConfigId) {
      try {
        await storage.setMemory(preservedConfigId, chatId, "overarchingArc", preservedArc);
      } catch {
        /* non-critical */
      }
    }

    return reply.status(204).send();
  });

  /** Read persistent memory for an agent in a chat (JSON values). */
  app.get<{ Params: { agentType: string; chatId: string } }>("/memory/:agentType/:chatId", async (req, reply) => {
    const config = await storage.getByType(req.params.agentType);
    if (!config) {
      return reply.status(404).send({ error: "Agent is not configured" });
    }
    const memory = await storage.getMemory(config.id, req.params.chatId);
    return { agentConfigId: config.id, memory };
  });

  /** Patch memory keys for an agent in a chat. Body: { patch: { key: value, ... } } */
  app.patch<{
    Params: { agentType: string; chatId: string };
    Body: { patch?: Record<string, unknown> };
  }>("/memory/:agentType/:chatId", async (req, reply) => {
    const config = await getOrCreateConfigByType(req.params.agentType);
    if (!config) {
      return reply.status(404).send({ error: "Agent is not configured" });
    }
    const body = (req.body ?? {}) as { patch?: Record<string, unknown> };
    const patch = body.patch;
    if (!patch || typeof patch !== "object") {
      return reply.status(400).send({ error: "Body must be { patch: { key: value, ... } }" });
    }
    let normalizedPatch: Record<string, unknown>;
    try {
      normalizedPatch =
        req.params.agentType === "director" || req.params.agentType === "secret-plot-driver"
          ? normalizeSecretPlotMemoryPatch(patch)
          : patch;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: "Invalid Secret Plot memory patch",
          issues: err.issues,
        });
      }
      throw err;
    }
    await storage.setMemories(config.id, req.params.chatId, normalizedPatch);
    const memory = await storage.getMemory(config.id, req.params.chatId);
    return { agentConfigId: config.id, memory };
  });

  /** Clear all memory for a specific agent in a specific chat (used when removing an agent from a chat). */
  app.delete<{ Params: { agentType: string; chatId: string } }>("/memory/:agentType/:chatId", async (req, reply) => {
    const config = await storage.getByType(req.params.agentType);
    if (config) {
      await storage.clearMemoryForAgentInChat(config.id, req.params.chatId);
    }
    return reply.status(204).send();
  });
}

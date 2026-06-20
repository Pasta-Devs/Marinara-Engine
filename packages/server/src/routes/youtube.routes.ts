// ──────────────────────────────────────────────
// Routes: Music DJ YouTube source (Data API v3 search)
// ──────────────────────────────────────────────
// Music DJ can return a YouTube search query; the client plays the result in
// an embedded YouTube IFrame player. These routes (a) store the user's free
// YouTube Data API key encrypted at rest and (b) resolve a query → video on the
// server so the key never reaches the browser. No OAuth, no playback control.
import type { FastifyInstance } from "fastify";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { decryptApiKey, encryptApiKey } from "../utils/crypto.js";
import { logger } from "../lib/logger.js";

function parseSettings(agent: { settings?: unknown } | null): Record<string, unknown> {
  if (!agent?.settings) return {};
  if (typeof agent.settings === "string") {
    try {
      return JSON.parse(agent.settings) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return agent.settings as Record<string, unknown>;
}

function readApiKey(settings: Record<string, unknown>): string {
  const value = settings.youtubeApiKey;
  if (typeof value !== "string" || !value) return "";
  // Stored encrypted; tolerate a plaintext value too (decryptApiKey returns "" on non-ciphertext).
  return decryptApiKey(value) || value;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeEntities(str: string): string {
  return str.replace(/&amp;|&quot;|&#39;|&lt;|&gt;/g, (m) => HTML_ENTITIES[m] ?? m);
}

/** Translate a YouTube Data API error body into a clear, actionable message. */
function friendlyYoutubeError(status: number, body: string): string {
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    reason = (parsed.error?.errors?.[0]?.reason ?? "").toLowerCase();
    message = parsed.error?.message ?? "";
  } catch {
    /* non-JSON body */
  }
  const blob = `${reason} ${message} ${body}`.toLowerCase();

  if (
    blob.includes("api keys are not supported") ||
    reason === "accessnotconfigured" ||
    blob.includes("has not been used in project") ||
    blob.includes("it is disabled")
  ) {
    return "YouTube Data API v3 is not enabled for this key's Google Cloud project. Open the Google Cloud Console API Library, enable “YouTube Data API v3”, wait a minute, then try again.";
  }
  if (reason === "keyinvalid" || blob.includes("api key not valid")) {
    return "This YouTube Data API key is invalid. Re-check the key pasted in Music DJ settings.";
  }
  if (reason === "keyexpired") {
    return "This YouTube Data API key has expired. Create a new key in Google Cloud Console.";
  }
  if (blob.includes("referer") || blob.includes("referrer")) {
    return "This key is restricted to HTTP referrers, but searches run server-side (no referrer). Set the key's Application restriction to None or IP addresses.";
  }
  if (reason === "quotaexceeded" || reason === "dailylimitexceeded" || blob.includes("quota")) {
    return "YouTube Data API daily quota exceeded for this key. Try again tomorrow, or use a different key.";
  }
  return `YouTube API error (${status}): ${message || body.slice(0, 160)}`;
}

export async function youtubeRoutes(app: FastifyInstance) {
  const storage = createAgentsStorage(app.db);

  /** Resolve the target Music DJ config, with a legacy YouTube config fallback for older local profiles. */
  async function resolveAgent(agentId?: string) {
    if (agentId) return storage.getById(agentId);
    return (await storage.getByType("spotify")) ?? (await storage.getByType("youtube"));
  }

  /**
   * POST /api/youtube/save-key
   * Body: { agentId?, apiKey }
   * Encrypts and stores the YouTube Data API key. agentId is optional — if the
   * built-in Music DJ config doesn't exist yet, it is created automatically so
   * the user never has to save the agent first.
   */
  app.post<{ Body: { agentId?: string; apiKey?: string } }>("/save-key", async (req, reply) => {
    const { agentId, apiKey } = req.body ?? {};
    const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmed) return reply.status(400).send({ error: "apiKey is required" });

    const agent = (agentId ? await storage.getById(agentId) : null) ?? (await storage.ensureBuiltinConfig("spotify"));
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const settings = parseSettings(agent);
    await storage.update(agent.id, {
      settings: { ...settings, youtubeApiKey: encryptApiKey(trimmed) },
    });
    return { success: true, agentId: agent.id };
  });

  /**
   * GET /api/youtube/status?agentId=xxx
   * Returns whether a YouTube Data API key is configured.
   */
  app.get<{ Querystring: { agentId?: string } }>("/status", async (req, reply) => {
    const agent = await resolveAgent(req.query.agentId);
    if (!agent) return { configured: false };
    return { configured: !!readApiKey(parseSettings(agent)) };
  });

  /**
   * POST /api/youtube/disconnect
   * Body: { agentId }
   * Removes the stored API key.
   */
  app.post<{ Body: { agentId?: string } }>("/disconnect", async (req, reply) => {
    const agent = await resolveAgent(req.body?.agentId);
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const { youtubeApiKey, ...rest } = parseSettings(agent);
    await storage.update(agent.id, { settings: rest });
    return { success: true };
  });

  /**
   * GET /api/youtube/search?q=...&agentId=...&limit=...
   * Resolves a query to embeddable YouTube videos. The client plays the first.
   */
  app.get<{ Querystring: { q?: string; agentId?: string; limit?: string } }>("/search", async (req, reply) => {
    const q = (req.query.q ?? "").trim().slice(0, 200);
    if (!q) return reply.status(400).send({ error: "q is required" });

    const agent = await resolveAgent(req.query.agentId);
    const apiKey = agent ? readApiKey(parseSettings(agent)) : "";
    if (!apiKey) {
      return reply
        .status(400)
        .send({ error: "YouTube not configured. Add a YouTube Data API key in the Music DJ agent settings." });
    }

    const limit = Math.max(1, Math.min(10, Number(req.query.limit ?? 5) || 5));

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
        part: "snippet",
        type: "video",
        videoEmbeddable: "true",
        maxResults: String(limit),
        q,
        key: apiKey,
      })}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        const body = await res.text();
        return reply.status(res.status).send({ error: friendlyYoutubeError(res.status, body) });
      }
      const data = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } };
        }>;
      };
      const results = (data.items ?? [])
        .filter((item) => item.id?.videoId)
        .map((item) => ({
          videoId: item.id!.videoId!,
          title: decodeEntities(item.snippet?.title ?? ""),
          channel: decodeEntities(item.snippet?.channelTitle ?? ""),
          thumbnail: item.snippet?.thumbnails?.medium?.url ?? null,
        }));
      return { query: q, results, count: results.length };
    } catch (err) {
      logger.error(err, "YouTube search failed");
      return reply.status(500).send({ error: err instanceof Error ? err.message : "YouTube search failed" });
    }
  });
}

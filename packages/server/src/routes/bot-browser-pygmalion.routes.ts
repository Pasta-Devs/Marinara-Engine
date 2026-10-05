// ──────────────────────────────────────────────
// Routes: Browser — Pygmalion provider
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { logger } from "../lib/logger.js";
import { BotBrowserUpstreamError, fetchBotBrowserJson } from "../services/bot-browser/fetch-json.js";
import { resolveValidatedImage, safeFetch } from "../utils/security.js";

const PYGMALION_API_HOSTS = ["server.pygmalion.chat"];
const PYGMALION_API_BASE = "https://server.pygmalion.chat/galatea.v1.PublicCharacterService";
const PYGMALION_ASSETS_BASE = "https://assets.pygmalion.chat";
// Base64url/JWT characters only: a pasted value can never smuggle text into the Authorization header.
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]{1,8192}$/;

// Requests that carry the token answer with one of these fixed reasons, never upstream error text.
type PygmalionFailure = "unreachable" | "rejected" | "busy";
const FAILURES: Record<PygmalionFailure, { status: number; error: string }> = {
  unreachable: { status: 502, error: "Couldn't reach Pygmalion" },
  rejected: { status: 400, error: "Pygmalion rejected the token" },
  busy: { status: 503, error: "Pygmalion is busy, try again" },
};

// In-memory token store (persists until server restart)
let pygToken: string = "";

function failureForStatus(status: number): PygmalionFailure {
  if (status === 401 || status === 403) return "rejected";
  return status === 408 || status === 429 || status >= 500 ? "busy" : "unreachable";
}

/** Status or error code only: an error message can quote the Authorization header. */
function failureDetail(err: unknown): string | number {
  if (err instanceof BotBrowserUpstreamError) return err.upstreamStatus;
  const { code, cause } = (err ?? {}) as { code?: unknown; cause?: { code?: unknown } };
  const detail = code ?? cause?.code;
  if (typeof detail === "string") return detail;
  return err instanceof Error ? err.name : "unknown";
}

/** Checks a token with Pygmalion; resolves to the failure reason, or null when it is accepted. */
async function checkToken(token: string): Promise<PygmalionFailure | null> {
  try {
    const res = await safeFetch(`${PYGMALION_API_BASE}/CharacterSearch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: "",
        orderBy: "downloads",
        orderDescending: true,
        pageSize: 1,
        page: 0,
        includeSensitive: true,
      }),
      signal: AbortSignal.timeout(15_000),
      policy: { allowedProtocols: ["https:"], allowedHostnames: PYGMALION_API_HOSTS, maxRedirects: 0 },
      maxResponseBytes: 1024 * 1024,
    });
    if (res.ok) return null;
    logger.warn("[bot-browser] Pygmalion token check failed: HTTP %d", res.status);
    return failureForStatus(res.status);
  } catch (err) {
    logger.warn("[bot-browser] Pygmalion token check failed: %s", failureDetail(err));
    return "unreachable";
  }
}

/** Authenticated Connect call; a rejected token ends the session so the client can ask for a new login. */
async function fetchWithToken(reply: FastifyReply, procedure: string, message: Record<string, unknown>) {
  const token = pygToken;
  try {
    return await fetchBotBrowserJson(`${PYGMALION_API_BASE}/${procedure}`, {
      allowedHosts: PYGMALION_API_HOSTS,
      maxResponseBytes: 8 * 1024 * 1024,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(message),
    });
  } catch (err) {
    const detail = failureDetail(err);
    logger.warn("[bot-browser] Pygmalion %s request failed: %s", procedure, detail);
    // Connect answers 401 (unauthenticated) for a token it no longer accepts. A 403 is permission_denied
    // for one item, which any page could request, so it must not end the login.
    if (detail === 401) {
      if (pygToken === token) pygToken = "";
      return reply.status(401).send({ error: "Pygmalion session expired", reason: "rejected", sessionExpired: true });
    }
    const failure = typeof detail === "number" ? failureForStatus(detail) : "unreachable";
    return reply.status(FAILURES[failure].status).send({ error: FAILURES[failure].error, reason: failure });
  }
}

function isPygmalionHost(hostname: string): boolean {
  return hostname === "pygmalion.chat" || hostname.endsWith(".pygmalion.chat");
}

export async function botBrowserPygmalionRoutes(app: FastifyInstance) {
  // ── Store token directly (user pastes their auth token) ──
  // The token is checked with Pygmalion first and stored only when accepted.
  app.post<{ Body: { token?: unknown } }>("/pygmalion/set-token", async (req, reply) => {
    const { token } = req.body ?? {};
    let value = typeof token === "string" ? token.trim() : "";

    // Normalize: strip "Bearer " prefix if pasted with it
    if (value.toLowerCase().startsWith("bearer ")) {
      value = value.slice("bearer ".length).trim();
    }

    if (!TOKEN_PATTERN.test(value)) {
      return reply.status(400).send({
        error: "Paste only the token. It can't contain spaces or line breaks.",
        reason: "invalid",
        active: !!pygToken,
      });
    }

    const failure = await checkToken(value);
    if (failure) {
      const { status, error } = FAILURES[failure];
      return reply.status(status).send({ error, reason: failure, active: !!pygToken });
    }

    pygToken = value;
    logger.info("[bot-browser] Pygmalion token stored");
    return { ok: true, active: true };
  });

  // ── Validate stored token by making a test authenticated search ──
  app.get("/pygmalion/validate", async () => {
    if (!pygToken) {
      return { valid: false, reason: "no token stored" };
    }
    const token = pygToken;
    const failure = await checkToken(token);
    if (!failure) {
      logger.info("[bot-browser] Pygmalion token validated");
      return { valid: true };
    }
    if (failure === "rejected" && pygToken === token) pygToken = "";
    return { valid: false, reason: FAILURES[failure].error };
  });

  // ── Logout (clear stored token) ──
  app.post("/pygmalion/logout", async () => {
    pygToken = "";
    logger.info("[bot-browser] Pygmalion token cleared");
    return { ok: true };
  });

  // ── Check session status ──
  app.get("/pygmalion/session", async () => {
    return { active: !!pygToken, hasToken: !!pygToken };
  });

  // ── Search characters on Pygmalion via Connect RPC ──
  app.get<{
    Querystring: {
      q?: string;
      page?: string;
      pageSize?: string;
      orderBy?: string;
      orderDescending?: string;
      tagsInclude?: string;
      tagsExclude?: string;
      includeSensitive?: string;
    };
  }>("/pygmalion/search", async (req, reply) => {
    const {
      q = "",
      page = "0",
      pageSize = "48",
      orderBy = "downloads",
      orderDescending = "true",
      tagsInclude,
      tagsExclude,
      includeSensitive = "false",
    } = req.query;

    const message: Record<string, unknown> = {
      query: q,
      orderBy,
      orderDescending: orderDescending === "true",
      pageSize: parseInt(pageSize) || 48,
      page: parseInt(page) || 0,
    };

    if (tagsInclude) {
      message.tagsNamesInclude = tagsInclude
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (tagsExclude) {
      message.tagsNamesExclude = tagsExclude
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Authenticated search with NSFW
    if (includeSensitive === "true" && pygToken) {
      message.includeSensitive = true;
      return fetchWithToken(reply, "CharacterSearch", message);
    }

    // Unauthenticated GET — public SFW results only
    const params = new URLSearchParams({
      connect: "v1",
      encoding: "json",
      message: JSON.stringify(message),
    });
    return fetchBotBrowserJson(`${PYGMALION_API_BASE}/CharacterSearch?${params}`, {
      allowedHosts: PYGMALION_API_HOSTS,
    });
  });

  // ── Get full character detail from Pygmalion ──
  app.get<{
    Querystring: {
      id: string;
      versionId?: string;
    };
  }>("/pygmalion/character", async (req, reply) => {
    const { id, versionId } = req.query;
    if (!id) throw new Error("Missing character id");

    const message: Record<string, unknown> = { characterMetaId: id };
    if (versionId) message.characterVersionId = versionId;

    // Authenticated detail fetch (needed for NSFW characters)
    if (pygToken) return fetchWithToken(reply, "Character", message);

    const params = new URLSearchParams({
      connect: "v1",
      encoding: "json",
      message: JSON.stringify(message),
    });
    return fetchBotBrowserJson(`${PYGMALION_API_BASE}/Character?${params}`, {
      allowedHosts: PYGMALION_API_HOSTS,
      maxResponseBytes: 8 * 1024 * 1024,
    });
  });

  // ── Proxy Pygmalion avatar images ──
  // Relative paths live on assets.pygmalion.chat; absolute URLs must stay on Pygmalion's own domain.
  app.get<{ Params: { "*": string } }>("/pygmalion/avatar/*", async (req, reply) => {
    const assetPath = (req.params as Record<string, string>)["*"];
    if (!assetPath) throw new Error("Missing asset path");

    const url = URL.parse(assetPath.startsWith("http") ? assetPath : `${PYGMALION_ASSETS_BASE}/${assetPath}`);
    if (!url || url.protocol !== "https:" || !isPygmalionHost(url.hostname)) {
      return reply.status(400).send({ error: "Avatar must come from Pygmalion" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await safeFetch(url, {
        signal: controller.signal,
        // Redirect hops must stay on the host that passed the check above.
        policy: { allowedProtocols: ["https:"], allowedHostnames: [url.hostname] },
        maxResponseBytes: 25 * 1024 * 1024,
      });
      if (!res.ok) return reply.status(404).send({ error: "Avatar not found" });
      const buf = Buffer.from(await res.arrayBuffer());
      const image = resolveValidatedImage(buf);
      if (!image) {
        logger.warn(
          "[bot-browser] Pygmalion avatar returned unsupported content type: %s",
          res.headers.get("content-type") || "(missing)",
        );
        return reply.status(415).send({ error: "Unsupported avatar content type" });
      }
      return reply.header("Content-Type", image.mimeType).header("Cache-Control", "public, max-age=86400").send(buf);
    } finally {
      clearTimeout(timeout);
    }
  });
}

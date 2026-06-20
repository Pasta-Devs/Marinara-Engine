// ──────────────────────────────────────────────
// Routes: Connections
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { extname, join } from "path";
import { MODEL_LISTS, createConnectionSchema, inferImageSource } from "@marinara-engine/shared";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { fetchOpenAIChatGPTModels, getOpenAIChatGPTAuth } from "../services/llm/openai-chatgpt-auth.js";
import { buildGoogleVertexModelUrl, googleAuthHeadersForVertex } from "../services/llm/providers/google.provider.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { isImageLocalUrlsEnabled, isProviderLocalUrlsEnabled } from "../config/runtime-config.js";
import { logDebugOverride } from "../lib/logger.js";
import {
  assertInsideDir,
  extensionFromImageMime,
  isAllowedImageBuffer,
  normalizeLoopbackUrl,
  safeFetch,
} from "../utils/security.js";
import { DATA_DIR } from "../utils/data-dir.js";

const CONNECTION_TEST_ERROR_PREVIEW_CHARS = 2000;
const CONNECTION_IMAGES_DIR = join(DATA_DIR, "connections", "images");

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readDebugMode(body: unknown): boolean {
  return isRecord(body) && body.debugMode === true;
}

function trimProviderError(value: string, maxLen = CONNECTION_TEST_ERROR_PREVIEW_CHARS): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function providerJsonMessage(json: unknown): string | null {
  if (!isRecord(json)) return null;

  const nestedError = json.error;
  const message =
    (isRecord(nestedError) && typeof nestedError.message === "string" && nestedError.message) ||
    (typeof nestedError === "string" && nestedError) ||
    (typeof json.message === "string" && json.message) ||
    (typeof json.detail === "string" && json.detail) ||
    null;

  if (!message) return null;

  const markers = [
    typeof json.type === "string" ? `type: ${json.type}` : null,
    typeof json.code === "string" && json.code !== json.type ? `code: ${json.code}` : null,
  ].filter(Boolean);

  return markers.length > 0 ? `${message} (${markers.join(", ")})` : message;
}

function formatProviderErrorBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "No response body";

  if (/<(?:!doctype|html)\b/i.test(trimmed)) {
    const titleMatch = trimmed.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch?.[1]) return trimProviderError(titleMatch[1]);
    return trimProviderError(trimmed.replace(/<[^>]+>/g, " "));
  }

  try {
    const json = JSON.parse(trimmed) as unknown;
    const message = providerJsonMessage(json);
    if (message) return trimProviderError(message);
  } catch {
    // Raw text response; fall through to preview.
  }

  return trimProviderError(trimmed);
}

function isOpenAICompatibleProvider(provider: string): boolean {
  return ["openai", "openrouter", "nanogpt", "xai", "mistral", "custom", "cohere"].includes(provider);
}

function usesResponsesEndpointForTestMessage(provider: string, model: string): boolean {
  if (!isOpenAICompatibleProvider(provider) || provider === "custom") return false;
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gpt-5.5") ||
    normalized.startsWith("gpt-5.4") ||
    normalized.startsWith("codex-") ||
    normalized.endsWith("-codex") ||
    normalized.endsWith("-codex-max") ||
    normalized.endsWith("-codex-mini")
  );
}

function describeTestMessageTarget(provider: string, baseUrl: string, model: string): string {
  if (provider === "claude_subscription") return "Claude Agent SDK";
  if (provider === "openai_chatgpt") return "local ChatGPT session";
  if (!baseUrl) return "(no base URL)";
  if (provider === "google_vertex") return buildGoogleVertexModelUrl(baseUrl, model, "generateContent");
  if (isOpenAICompatibleProvider(provider)) {
    return `${baseUrl}${usesResponsesEndpointForTestMessage(provider, model) ? "/responses" : "/chat/completions"}`;
  }
  if (provider === "anthropic") return `${baseUrl}/messages`;
  return baseUrl;
}

function resolveImageGenerationSource(conn: Record<string, unknown>, baseUrl: string): string {
  const explicitSource = typeof conn.imageGenerationSource === "string" ? conn.imageGenerationSource : "";
  const model = typeof conn.model === "string" ? conn.model : "";
  return inferImageSource(explicitSource || model, baseUrl);
}

function localUrlPolicyForProvider(provider: string, imageSource: string) {
  const isLocalImageBackend =
    provider === "image_generation" && (imageSource === "comfyui" || imageSource === "automatic1111");
  const isImage = provider === "image_generation";
  return {
    allowLocal: isLocalImageBackend || (isImage && isImageLocalUrlsEnabled()) ? true : isProviderLocalUrlsEnabled(),
    allowLoopback: true,
    allowMdns: provider !== "image_generation" || isLocalImageBackend || isImageLocalUrlsEnabled(),
    allowedProtocols: ["https:", "http:"],
    flagName: isImage ? "IMAGE_LOCAL_URLS_ENABLED" : "PROVIDER_LOCAL_URLS_ENABLED",
  };
}

function normalizeConnectionTestBaseUrl(baseUrl: string, provider: string): string {
  if (provider !== "image_generation") return baseUrl;
  try {
    return normalizeLoopbackUrl(baseUrl).replace(/\/+$/, "");
  } catch {
    return baseUrl;
  }
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

function getSafeConnectionImagePath(filename: string): string | null {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  try {
    return assertInsideDir(CONNECTION_IMAGES_DIR, join(CONNECTION_IMAGES_DIR, filename));
  } catch {
    return null;
  }
}

function buildStabilityUrl(baseUrl: string, targetPath: string): string {
  try {
    const url = new URL(baseUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const versionIndex = parts.findIndex((part) => part === "v1" || part === "v2beta");
    const prefix = versionIndex >= 0 ? parts.slice(0, versionIndex) : parts;
    url.pathname = `/${[...prefix, ...targetPath.split("/").filter(Boolean)].join("/")}`;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/${targetPath.replace(/^\/+/, "")}`;
  }
}

function buildHordeUrl(baseUrl: string, targetPath: string): string {
  try {
    const url = new URL(baseUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const versionIndex = parts.findIndex((part, index) => part === "api" && parts[index + 1] === "v2");
    const prefix = versionIndex >= 0 ? parts.slice(0, versionIndex + 2) : [...parts, "api", "v2"];
    url.pathname = `/${[...prefix, ...targetPath.split("/").filter(Boolean)].join("/")}`;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/api/v2/${targetPath.replace(/^\/+/, "")}`;
  }
}

function hordeHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: apiKey.trim() || "0000000000",
    "Client-Agent": "Marinara-Engine",
  };
}

function isStabilityV1Base(baseUrl: string): boolean {
  try {
    const parts = new URL(baseUrl).pathname.split("/").filter(Boolean);
    return parts.includes("v1") && !parts.includes("v2beta");
  } catch {
    return /\/v1(?:\/|$)/i.test(baseUrl) && !/\/v2beta(?:\/|$)/i.test(baseUrl);
  }
}

function knownStabilityImageModels() {
  return MODEL_LISTS.image_generation
    .filter((model) => {
      const id = model.id.toLowerCase();
      return id.startsWith("sd3") || id.startsWith("stable-image");
    })
    .map((model) => ({ id: model.id, name: model.name }));
}

export async function connectionsRoutes(app: FastifyInstance) {
  const storage = createConnectionsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { filename: string } }>("/images/file/:filename", async (req, reply) => {
    const filepath = getSafeConnectionImagePath(req.params.filename);
    if (!filepath || !existsSync(filepath)) return reply.status(404).send({ error: "Image not found" });

    const buffer = await readFile(filepath);
    const imageInfo = isAllowedImageBuffer(buffer, extname(filepath));
    if (!imageInfo) return reply.status(404).send({ error: "Image not found" });

    return reply
      .header("Content-Type", imageInfo.mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(buffer);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const conn = await storage.getById(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    // Mask key in response
    return { ...conn, apiKeyEncrypted: conn.apiKeyEncrypted ? "••••••••" : "" };
  });

  app.post("/", async (req) => {
    const input = createConnectionSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = createConnectionSchema.partial().parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.post<{ Params: { id: string } }>("/:id/image", async (req, reply) => {
    const connection = await storage.getById(req.params.id);
    if (!connection) return reply.status(404).send({ error: "Connection not found" });

    const body = req.body as { image?: string };
    if (!body.image) return reply.status(400).send({ error: "No image data provided" });

    const { buffer, hintedExt } = parseImageUpload(body.image);
    const imageInfo = isAllowedImageBuffer(buffer, `.${hintedExt}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid connection image" });

    const ext = extensionFromImageMime(imageInfo.mimeType);
    await mkdir(CONNECTION_IMAGES_DIR, { recursive: true });
    const filename = `connection-${req.params.id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(CONNECTION_IMAGES_DIR, join(CONNECTION_IMAGES_DIR, filename));
    await writeFile(filepath, buffer);

    const updated = await storage.update(req.params.id, { imagePath: `/api/connections/images/file/${filename}` });
    if (!updated) return reply.status(404).send({ error: "Connection not found" });
    return updated;
  });

  // Save default generation parameters for a connection
  app.put<{ Params: { id: string } }>("/:id/default-parameters", async (req, reply) => {
    const conn = await storage.getById(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    const raw = req.body;
    if (raw !== null && (typeof raw !== "object" || Array.isArray(raw))) {
      return reply.status(400).send({ error: "Body must be a JSON object or null" });
    }
    const params = raw as Record<string, unknown> | null;
    await storage.updateDefaultParameters(req.params.id, params);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // Duplicate a connection (copies everything including the encrypted API key)
  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const result = await storage.duplicate(req.params.id);
    if (!result) return reply.status(404).send({ error: "Connection not found" });
    return result;
  });

  // Test connection (sends a tiny ping to the API)
  app.post<{ Params: { id: string } }>("/:id/test", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    const requestDebug = readDebugMode(req.body);
    const debugLog = (message: string, ...args: any[]) => logDebugOverride(requestDebug, message, ...args);
    const start = Date.now();
    try {
      if (conn.provider === "claude_subscription") {
        if (!conn.model) {
          return {
            success: false,
            message: "No model configured. Set a Claude subscription model first.",
            latencyMs: Date.now() - start,
            modelName: null,
          };
        }
        const provider = createLLMProvider(
          conn.provider,
          "",
          conn.apiKey,
          conn.maxContext,
          conn.openrouterProvider,
          conn.maxTokensOverride,
          conn.claudeFastMode === "true",
        );
        let responseText = "";
        for await (const chunk of provider.chat([{ role: "user", content: "Reply with OK." }], {
          model: conn.model,
          maxTokens: 32,
          stream: false,
        })) {
          responseText += chunk;
        }
        return {
          success: true,
          message: `Claude Agent SDK completed a real request: ${responseText.trim().slice(0, 120) || "OK"}`,
          latencyMs: Date.now() - start,
          modelName: conn.model,
        };
      }

      if (conn.provider === "openai_chatgpt") {
        const auth = await getOpenAIChatGPTAuth();
        const detail = auth.planType ? ` (${auth.planType})` : "";
        return {
          success: true,
          message: `ChatGPT login found via Codex auth${detail}. Requests will use the local ChatGPT session.`,
          latencyMs: Date.now() - start,
          modelName: conn.model,
        };
      }

      // Simple models list fetch to verify the key works
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const provider = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      let baseUrl = conn.baseUrl || provider?.defaultBaseUrl || "";

      if (!baseUrl) {
        return {
          success: false,
          message: "No base URL configured for this provider",
          latencyMs: 0,
          modelName: null,
        };
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider?.usesAuthHeader) {
        headers["Authorization"] = `Bearer ${conn.apiKey}`;
      }
      if (provider?.apiKeyHeader) {
        headers[provider.apiKeyHeader] = conn.apiKey;
      }
      if (conn.provider === "google_vertex") {
        Object.assign(headers, await googleAuthHeadersForVertex(conn.apiKey));
      }
      if (conn.provider === "anthropic") {
        headers["anthropic-version"] = "2023-06-01";
      }

      const imageSource =
        conn.provider === "image_generation" ? resolveImageGenerationSource(conn as any, baseUrl) : "";
      baseUrl = normalizeConnectionTestBaseUrl(baseUrl, conn.provider);
      // image_generation has no standard modelsEndpoint — use provider-specific checks
      let testUrl: string;
      if (conn.provider === "image_generation" && imageSource === "novelai") {
        // NovelAI: validate the API key via the user subscription endpoint
        testUrl = "https://api.novelai.net/user/subscription";
      } else if (conn.provider === "image_generation" && imageSource === "horde") {
        // Horde: heartbeat is the lightweight health endpoint for the public API.
        testUrl = buildHordeUrl(baseUrl, "status/heartbeat");
      } else if (conn.provider === "image_generation" && imageSource === "stability") {
        // Stability's generation endpoints live under v2beta, but account/key checks are v1.
        testUrl = buildStabilityUrl(baseUrl, "v1/user/account");
      } else if (conn.provider === "image_generation" && imageSource === "comfyui") {
        // ComfyUI: ping the system stats endpoint
        testUrl = `${baseUrl}/system_stats`;
      } else if (conn.provider === "image_generation" && imageSource === "automatic1111") {
        // AUTOMATIC1111 / SD Web UI: ping the internal ping endpoint
        testUrl = `${baseUrl}/sdapi/v1/options`;
      } else if (conn.provider === "image_generation" && imageSource === "runpod_comfyui") {
        // RunPod: use Test Image to verify — no cheap endpoint test available
        return {
          success: true,
          message: "RunPod endpoint configured. Use 'Test Image' to verify generation works.",
          latencyMs: Date.now() - start,
          modelName: conn.model,
        };
      } else if (conn.provider === "google_vertex") {
        testUrl = buildGoogleVertexModelUrl(baseUrl, conn.model, "models");
      } else {
        testUrl = `${baseUrl}${provider?.modelsEndpoint || "/models"}`;
      }

      const testHeaders =
        conn.provider === "image_generation" && imageSource === "horde" ? hordeHeaders(conn.apiKey) : headers;
      debugLog("[connections/test] provider=%s model=%s catalogUrl=%s", conn.provider, conn.model ?? "", testUrl);
      const res = await safeFetch(testUrl, {
        headers: testHeaders,
        policy: localUrlPolicyForProvider(conn.provider, imageSource),
        maxResponseBytes: 2 * 1024 * 1024,
        decodeCompressedResponse: true,
      });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return { success: true, message: "Connection successful", latencyMs, modelName: conn.model };
      } else {
        const body = await res.text();
        const detail = formatProviderErrorBody(body);
        debugLog(
          "[connections/test] provider=%s catalogUrl=%s returned %d: %s",
          conn.provider,
          testUrl,
          res.status,
          detail,
        );
        return {
          success: false,
          message: `API returned ${res.status}: ${detail}`,
          latencyMs,
          modelName: null,
        };
      }
    } catch (err) {
      debugLog(
        "[connections/test] provider=%s failed: %s",
        conn.provider,
        err instanceof Error ? err.message : "Unknown error",
      );
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        latencyMs: Date.now() - start,
        modelName: null,
      };
    }
  });

  // ── Fetch available models from the provider API ──
  app.get<{ Params: { id: string } }>("/:id/models", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    try {
      // Claude (Subscription) has no remote /models endpoint — return the
      // curated static list for the subscription path.
      if (conn.provider === "claude_subscription") {
        const { MODEL_LISTS } = await import("@marinara-engine/shared");
        const models = MODEL_LISTS.claude_subscription.map((m) => ({ id: m.id, name: m.name }));
        return { models };
      }

      if (conn.provider === "openai_chatgpt") {
        try {
          const models = await fetchOpenAIChatGPTModels();
          if (models.length > 0) return { models };
        } catch {
          // Fall through to the curated list so the selector remains usable
          // before the host has run `codex login`.
        }
        return { models: MODEL_LISTS.openai_chatgpt.map((m) => ({ id: m.id, name: m.name })) };
      }

      const { PROVIDERS } = await import("@marinara-engine/shared");
      const provider = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      let baseUrl = conn.baseUrl || provider?.defaultBaseUrl || "";

      if (!baseUrl) {
        return reply.status(400).send({ error: "No base URL configured" });
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider?.usesAuthHeader) {
        headers["Authorization"] = `Bearer ${conn.apiKey}`;
      }
      if (provider?.apiKeyHeader) {
        headers[provider.apiKeyHeader] = conn.apiKey;
      }
      if (conn.provider === "google_vertex") {
        Object.assign(headers, await googleAuthHeadersForVertex(conn.apiKey));
      }

      // Anthropic requires version header for models endpoint
      if (conn.provider === "anthropic") {
        headers["anthropic-version"] = "2023-06-01";
      }

      // ── Special handling for local image gen services ──
      const imageSource =
        conn.provider === "image_generation" ? resolveImageGenerationSource(conn as any, baseUrl) : "";
      baseUrl = normalizeConnectionTestBaseUrl(baseUrl, conn.provider);
      const lowerBase = baseUrl.toLowerCase();
      const sanitizeProviderBody = (body: string): string => {
        if (body.includes("<html") || body.includes("<!DOCTYPE")) {
          return "Provider returned an HTML page instead of JSON. Check the Base URL for this image service.";
        }
        return body.slice(0, 300);
      };

      // Stability AI: v2beta has task-specific generation endpoints, not /models.
      // Validate the key via v1 account, then either fetch legacy v1 engines or return the curated v2beta list.
      if (conn.provider === "image_generation" && imageSource === "stability") {
        const accountRes = await safeFetch(buildStabilityUrl(baseUrl, "v1/user/account"), {
          headers,
          policy: localUrlPolicyForProvider(conn.provider, imageSource),
          maxResponseBytes: 2 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!accountRes.ok) {
          const body = await accountRes.text();
          return reply.status(502).send({
            error: `Stability AI returned ${accountRes.status}: ${sanitizeProviderBody(body)}`,
          });
        }

        if (isStabilityV1Base(baseUrl)) {
          const res = await safeFetch(buildStabilityUrl(baseUrl, "v1/engines/list"), {
            headers,
            policy: localUrlPolicyForProvider(conn.provider, imageSource),
            maxResponseBytes: 5 * 1024 * 1024,
            decodeCompressedResponse: true,
          });
          if (!res.ok) {
            const body = await res.text();
            return reply.status(502).send({
              error: `Stability AI returned ${res.status}: ${sanitizeProviderBody(body)}`,
            });
          }

          const text = await res.text();
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            return reply.status(502).send({
              error: `Failed to fetch models: ${sanitizeProviderBody(text)}`,
            });
          }

          const engines = Array.isArray(json)
            ? json
            : Array.isArray((json as { engines?: unknown }).engines)
              ? (json as { engines: unknown[] }).engines
              : [];
          const models = engines
            .map((engine) => {
              if (!engine || typeof engine !== "object") return null;
              const record = engine as { id?: string; name?: string; description?: string };
              const id = record.id ?? "";
              return id ? { id, name: record.name ?? record.description ?? id } : null;
            })
            .filter((model): model is { id: string; name: string } => Boolean(model));
          return { models: models.length ? models : knownStabilityImageModels() };
        }

        return { models: knownStabilityImageModels() };
      }

      // ComfyUI: fetch checkpoints from object_info
      if (conn.provider === "image_generation" && imageSource === "comfyui") {
        const res = await safeFetch(`${baseUrl}/object_info/CheckpointLoaderSimple`, {
          policy: localUrlPolicyForProvider(conn.provider, imageSource),
          maxResponseBytes: 5 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!res.ok) {
          return reply.status(502).send({ error: `ComfyUI returned ${res.status}` });
        }
        const info = (await res.json()) as {
          CheckpointLoaderSimple?: { input?: { required?: { ckpt_name?: [string[]] } } };
        };
        const ckpts = info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
        return { models: ckpts.map((name: string) => ({ id: name, name })) };
      }

      // AUTOMATIC1111 / SD Web UI: fetch models from /sdapi/v1/sd-models
      if (conn.provider === "image_generation" && imageSource === "automatic1111") {
        const res = await safeFetch(`${baseUrl}/sdapi/v1/sd-models`, {
          policy: localUrlPolicyForProvider(conn.provider, imageSource),
          maxResponseBytes: 5 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!res.ok) {
          return reply.status(502).send({ error: `SD Web UI returned ${res.status}` });
        }
        const sdModels = (await res.json()) as Array<{ title?: string; model_name?: string }>;
        return {
          models: sdModels
            .map((m) => ({ id: m.title ?? m.model_name ?? "", name: m.title ?? m.model_name ?? "" }))
            .filter((m) => m.id),
        };
      }

      if (conn.provider === "image_generation" && lowerBase.includes("nano-gpt.com")) {
        const res = await safeFetch(`${baseUrl}/image-models`, {
          headers,
          policy: {
            allowLocal: isProviderLocalUrlsEnabled(),
            allowLoopback: true,
            allowMdns: true,
            allowedProtocols: ["https:", "http:"],
            flagName: "PROVIDER_LOCAL_URLS_ENABLED",
          },
          maxResponseBytes: 5 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!res.ok) {
          const body = await res.text();
          return reply.status(502).send({ error: `Provider returned ${res.status}: ${sanitizeProviderBody(body)}` });
        }
        const text = await res.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return reply.status(502).send({
            error: `Failed to fetch models: ${sanitizeProviderBody(text)}`,
          });
        }
        const data = (json.data ?? []) as Array<{ id?: string; name?: string }>;
        return {
          models: data.map((m) => ({ id: m.id ?? "", name: m.name ?? m.id ?? "" })).filter((m) => m.id),
        };
      }

      if (conn.provider === "image_generation" && imageSource === "openrouter") {
        const modelsUrl = `${baseUrl}/models?output_modalities=image`;
        const res = await safeFetch(modelsUrl, {
          headers,
          policy: localUrlPolicyForProvider(conn.provider, imageSource),
          maxResponseBytes: 5 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!res.ok) {
          const body = await res.text();
          return reply.status(502).send({
            error: `OpenRouter returned ${res.status}: ${sanitizeProviderBody(body)}`,
          });
        }
        const text = await res.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return reply.status(502).send({
            error: `Failed to fetch models: ${sanitizeProviderBody(text)}`,
          });
        }
        return { models: normalizeModelsResponse("openrouter", json) };
      }

      if (conn.provider === "image_generation" && imageSource === "horde") {
        const res = await safeFetch(`${buildHordeUrl(baseUrl, "status/models")}?type=image`, {
          headers: hordeHeaders(conn.apiKey),
          policy: localUrlPolicyForProvider(conn.provider, imageSource),
          maxResponseBytes: 5 * 1024 * 1024,
          decodeCompressedResponse: true,
        });
        if (!res.ok) {
          const body = await res.text();
          return reply.status(502).send({
            error: `Horde returned ${res.status}: ${sanitizeProviderBody(body)}`,
          });
        }
        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return reply.status(502).send({
            error: `Failed to fetch models: ${sanitizeProviderBody(text)}`,
          });
        }
        const models = (Array.isArray(json) ? json : [])
          .map((model) => {
            if (!model || typeof model !== "object") return null;
            const record = model as { name?: string; id?: string };
            const id = record.name ?? record.id ?? "";
            return id ? { id, name: id } : null;
          })
          .filter((model): model is { id: string; name: string } => Boolean(model));
        return { models };
      }

      let modelsUrl =
        conn.provider === "google_vertex"
          ? buildGoogleVertexModelUrl(baseUrl, conn.model, "models")
          : `${baseUrl}${provider?.modelsEndpoint ?? "/models"}`;
      if (conn.provider === "google") {
        modelsUrl += `?key=${conn.apiKey}`;
      }

      const res = await safeFetch(modelsUrl, {
        headers,
        policy: {
          allowLocal: isProviderLocalUrlsEnabled(),
          allowLoopback: true,
          allowMdns: true,
          allowedProtocols: ["https:", "http:"],
          flagName: "PROVIDER_LOCAL_URLS_ENABLED",
        },
        maxResponseBytes: 5 * 1024 * 1024,
        decodeCompressedResponse: true,
      });
      if (!res.ok) {
        const body = await res.text();
        return reply.status(502).send({
          error: `Provider returned ${res.status}: ${sanitizeProviderBody(body)}`,
        });
      }

      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return reply.status(502).send({
          error: `Failed to fetch models: ${sanitizeProviderBody(text)}`,
        });
      }

      // Normalize across providers
      const models = normalizeModelsResponse(conn.provider, json);
      return { models };
    } catch (err) {
      return reply.status(502).send({
        error: `Failed to fetch models: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  });

  // ── Test image generation — generates a small fixed test image ──
  app.post<{ Params: { id: string } }>("/:id/test-image", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    if (conn.provider !== "image_generation") {
      return reply.status(400).send({ error: "Not an image generation connection" });
    }

    const { PROVIDERS } = await import("@marinara-engine/shared");
    const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
    const baseUrl = (conn.baseUrl || providerDef?.defaultBaseUrl || "").replace(/\/+$/, "");

    const { generateImage } = await import("../services/image/image-generation.js");
    const imgModel = conn.model || "";
    const imgApiKey = conn.apiKey || "";
    const imgSource = conn.imageGenerationSource || imgModel;
    const imgServiceHint = conn.imageService || imgSource;
    const imageDefaults = resolveConnectionImageDefaults(conn);

    const BASE_PROMPT = "plate of spaghetti with marinara sauce";

    const start = Date.now();
    try {
      const result = await generateImage(imgSource, baseUrl, imgApiKey, imgServiceHint, {
        prompt: BASE_PROMPT,
        model: imgModel || undefined,
        imageEndpointId: (conn.imageEndpointId as string | undefined) ?? undefined,
        width: 512,
        height: 512,
        comfyWorkflow: conn.comfyuiWorkflow || undefined,
        imageDefaults,
      });
      return {
        success: true,
        base64: result.base64,
        mimeType: result.mimeType,
        latencyMs: Date.now() - start,
        prompt: BASE_PROMPT,
      };
    } catch (err) {
      return {
        success: false,
        base64: null,
        mimeType: null,
        latencyMs: Date.now() - start,
        prompt: BASE_PROMPT,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  // ── Diagnose Claude (Subscription) — verifies which model the SDK actually
  //    billed against. The Claude Agent SDK can silently route a request to a
  //    smaller model (fast mode, post-rate-limit `cooldown` state, account-tier
  //    gating) without surfacing the swap to the caller. We send a tiny prompt
  //    through the SDK with fast mode forced off, then return the model(s) the
  //    SDK reports in `modelUsage` plus its `fast_mode_state` so the UI can
  //    show "you asked for X, the SDK billed Y." ──
  app.post<{ Params: { id: string } }>("/:id/diagnose-claude-subscription", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    if (conn.provider !== "claude_subscription") {
      return reply.status(400).send({ error: "Not a Claude (Subscription) connection" });
    }
    if (!conn.model) {
      return reply.status(400).send({ error: "No model configured. Pick a model first." });
    }

    const start = Date.now();
    const requestedModel = conn.model;
    let responseText = "";
    let modelsBilled: string[] = [];
    let modelUsageDetail: Array<{ model: string; inputTokens: number; outputTokens: number }> = [];
    let fastModeState: string | null = null;
    const errors: string[] = [];

    try {
      const sdk = await import("@anthropic-ai/claude-agent-sdk");
      // The user's empirically reliable self-ID prompt. Asking the model "which
      // Claude family are you (Opus/Sonnet/Haiku)" with a one-word constraint
      // produces consistent, non-hallucinated answers — versions are unreliable
      // but the family tier is not. Combined with the SDK-side `modelUsage`
      // readout below, this gives two independent signals on the same call.
      const fastMode = conn.claudeFastMode === "true";
      // Use the Claude Code preset for `systemPrompt`. Without it the SDK
      // strips the model's version awareness and every model falsely answers
      // "Sonnet" — see the chat provider for the full explanation. Passing the
      // preset gives a clean signal on the model's true identity.
      const queryHandle = sdk.query({
        prompt:
          "[OOC, hold on for one second, and tell me which claude model you are, you don't need to give me the version, are you Opus, Sonnet, Or Haiku? Answer with only the 1 word model name.]",
        options: {
          model: requestedModel,
          systemPrompt: { type: "preset", preset: "claude_code" },
          tools: [],
          permissionMode: "bypassPermissions",
          includePartialMessages: false,
          settings: { fastMode },
          ...(conn.apiKey ? { env: { ...process.env, ANTHROPIC_API_KEY: conn.apiKey } } : {}),
        },
      });

      for await (const message of queryHandle) {
        if (message.type === "assistant") {
          const blocks = (message.message?.content ?? []) as Array<{ type: string; text?: string }>;
          for (const block of blocks) {
            if (block.type === "text" && block.text) responseText += block.text;
          }
        } else if (message.type === "result") {
          const usage = message.modelUsage ?? {};
          modelsBilled = Object.keys(usage);
          modelUsageDetail = Object.entries(usage).map(([model, u]) => ({
            model,
            inputTokens: (u as { inputTokens?: number }).inputTokens ?? 0,
            outputTokens: (u as { outputTokens?: number }).outputTokens ?? 0,
          }));
          fastModeState = message.fast_mode_state ?? null;
          if (message.subtype !== "success") {
            const detail = message.errors?.length ? message.errors.join("; ") : message.subtype;
            errors.push(detail);
          }
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown error");
    }

    const latencyMs = Date.now() - start;
    const billedDifferent = modelsBilled.length > 0 && !modelsBilled.includes(requestedModel);
    return {
      success: errors.length === 0,
      requestedModel,
      modelsBilled,
      modelUsageDetail,
      billedDifferent,
      fastModeState,
      response: responseText.slice(0, 500),
      errors,
      latencyMs,
    };
  });

  // ── Test message — sends "hi" to the model and returns the response ──
  app.post<{ Params: { id: string } }>("/:id/test-message", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    if (!conn.model) {
      return reply.status(400).send({ error: "No model configured. Set a model first." });
    }

    const { PROVIDERS } = await import("@marinara-engine/shared");
    const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
    const baseUrl = (conn.baseUrl || providerDef?.defaultBaseUrl || "").replace(/\/+$/, "");

    // Local subscription/session providers manage their own endpoint, so skip
    // the baseUrl precondition. Every HTTP provider still requires one.
    if (!baseUrl && conn.provider !== "claude_subscription" && conn.provider !== "openai_chatgpt") {
      return reply.status(400).send({ error: "No base URL configured" });
    }

    const start = Date.now();
    const requestDebug = readDebugMode(req.body);
    const debugLog = (message: string, ...args: any[]) => logDebugOverride(requestDebug, message, ...args);
    const targetUrl = describeTestMessageTarget(conn.provider, baseUrl, conn.model);
    try {
      debugLog("[connections/test-message] provider=%s model=%s url=%s", conn.provider, conn.model, targetUrl);
      const provider = createLLMProvider(
        conn.provider,
        baseUrl,
        conn.apiKey,
        conn.maxContext,
        conn.openrouterProvider,
        conn.maxTokensOverride,
        conn.claudeFastMode === "true",
      );

      let fullResponse = "";
      for await (const chunk of provider.chat([{ role: "user", content: "hi" }], {
        model: conn.model,
        temperature: 0.7,
        maxTokens: 200,
        stream: false,
      })) {
        fullResponse += chunk;
      }

      const latencyMs = Date.now() - start;
      debugLog(
        "[connections/test-message] url=%s success in %dms: %s",
        targetUrl,
        latencyMs,
        fullResponse.slice(0, 500),
      );
      return {
        success: true,
        response: fullResponse.slice(0, 500),
        latencyMs,
        model: conn.model,
      };
    } catch (err) {
      debugLog(
        "[connections/test-message] provider=%s model=%s url=%s failed: %s",
        conn.provider,
        conn.model,
        targetUrl,
        err instanceof Error ? err.message : "Unknown error",
      );
      return {
        success: false,
        response: "",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown error",
        model: conn.model,
      };
    }
  });
}

// ──────────────────────────────────────────────
// Normalize models response from different providers
// ──────────────────────────────────────────────
interface RemoteModel {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
}

function readProviderMetadataRecord(value: unknown): Record<string, unknown> | null {
  return !!value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readPositiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function readOpenAICompatibleModelLimits(model: Record<string, unknown>): Pick<RemoteModel, "context" | "maxOutput"> {
  const topProvider = readProviderMetadataRecord(model.top_provider);
  const context =
    readPositiveInteger(model.context_length) ??
    readPositiveInteger(model.context_window) ??
    readPositiveInteger(model.contextWindow) ??
    readPositiveInteger(model.max_input_tokens) ??
    readPositiveInteger(model.input_token_limit) ??
    readPositiveInteger(model.inputTokenLimit) ??
    readPositiveInteger(topProvider?.context_length);
  const maxOutput =
    readPositiveInteger(topProvider?.max_completion_tokens) ??
    readPositiveInteger(model.max_completion_tokens) ??
    readPositiveInteger(model.max_output_tokens) ??
    readPositiveInteger(model.max_tokens) ??
    readPositiveInteger(model.maxOutputTokens) ??
    readPositiveInteger(model.output_token_limit) ??
    readPositiveInteger(model.outputTokenLimit);

  return {
    ...(context ? { context } : {}),
    ...(maxOutput ? { maxOutput } : {}),
  };
}

function normalizeModelsResponse(provider: string, json: Record<string, unknown>): RemoteModel[] {
  switch (provider) {
    case "google": {
      // Google returns { models: [{ name: "models/gemini-...", displayName: "..." }] }
      const models = (json.models ?? []) as Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
        inputTokenLimit?: number;
        outputTokenLimit?: number;
      }>;
      return models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({
          id: (m.name ?? "").replace(/^models\//, ""),
          name: m.displayName ?? (m.name ?? "").replace(/^models\//, ""),
          ...readOpenAICompatibleModelLimits(m as Record<string, unknown>),
        }))
        .filter((m) => m.id);
    }

    case "google_vertex": {
      // Vertex AI returns { publisherModels: [{ name: "publishers/google/models/gemini-...", ... }] }
      const models = (json.publisherModels ?? []) as Array<{
        name?: string;
        displayName?: string;
        supportedActions?: { viewRestApi?: unknown };
        inputTokenLimit?: number;
        outputTokenLimit?: number;
      }>;
      return models
        .filter((m) => m.name?.includes("/models/"))
        .map((m) => ({
          id: (m.name ?? "").replace(/^.*\/models\//, ""),
          name: m.displayName ?? (m.name ?? "").replace(/^.*\/models\//, ""),
          ...readOpenAICompatibleModelLimits(m as Record<string, unknown>),
        }))
        .filter((m) => m.id);
    }

    case "anthropic": {
      // Anthropic returns { data: [{ id: "claude-...", display_name: "..." }] }
      const data = (json.data ?? []) as Array<{
        id?: string;
        display_name?: string;
        type?: string;
        context_window?: number;
        max_output_tokens?: number;
      }>;
      return data
        .filter((m) => m.type === "model" || m.id)
        .map((m) => ({
          id: m.id ?? "",
          name: m.display_name ?? m.id ?? "",
          ...readOpenAICompatibleModelLimits(m as Record<string, unknown>),
        }))
        .filter((m) => m.id);
    }

    case "cohere": {
      // Cohere native v2 returns { models: [{ name: "command-r-plus", ... }] }.
      // The OpenAI compatibility endpoint returns { data: [{ id: "command-r-plus", ... }] }.
      const data = (json.data ?? []) as Array<{
        id?: string;
        name?: string;
        context_length?: number;
        max_output_tokens?: number;
        max_completion_tokens?: number;
      }>;
      if (data.length > 0) {
        return data
          .map((m) => ({
            id: m.id ?? "",
            name: m.name ?? m.id ?? "",
            ...readOpenAICompatibleModelLimits(m as Record<string, unknown>),
          }))
          .filter((m) => m.id);
      }

      const models = (json.models ?? []) as Array<{
        name?: string;
        endpoints?: string[];
        context_length?: number;
        max_output_tokens?: number;
        max_completion_tokens?: number;
      }>;
      return models
        .filter((m) => m.endpoints?.includes("chat"))
        .map((m) => ({
          id: m.name ?? "",
          name: m.name ?? "",
          ...readOpenAICompatibleModelLimits(m as Record<string, unknown>),
        }))
        .filter((m) => m.id);
    }

    default: {
      // OpenAI-compatible: { data: [{ id: "gpt-4o", ... }] }
      // This covers openai, mistral, openrouter, custom
      const data = (json.data ?? []) as Array<Record<string, unknown> & { id?: string; name?: string }>;
      return data
        .map((m) => ({
          id: m.id ?? "",
          name: m.name ?? m.id ?? "",
          ...readOpenAICompatibleModelLimits(m),
        }))
        .filter((m) => m.id);
    }
  }
}

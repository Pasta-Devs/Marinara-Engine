// ──────────────────────────────────────────────
// Routes: Connections
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createConnectionSchema } from "@marinara-engine/shared";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { validateExternalUrl } from "../utils/url-validation.js";

export async function connectionsRoutes(app: FastifyInstance) {
  const storage = createConnectionsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
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

    const start = Date.now();
    try {
      // Simple models list fetch to verify the key works
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const provider = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      const baseUrl = conn.baseUrl || provider?.defaultBaseUrl || "";

      // Validate baseUrl against SSRF
      if (baseUrl) {
        const urlError = validateExternalUrl(baseUrl);
        if (urlError) {
          return { success: false, message: `Base URL rejected: ${urlError}`, latencyMs: 0, modelName: null };
        }
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider?.usesAuthHeader) {
        headers["Authorization"] = `Bearer ${conn.apiKey}`;
      }
      if (provider?.apiKeyHeader) {
        headers[provider.apiKeyHeader] = conn.apiKey;
      }

      // image_generation has no standard modelsEndpoint; try /models as a connectivity check
      let testUrl = `${baseUrl}${provider?.modelsEndpoint || "/models"}`;

      const res = await fetch(testUrl, { headers });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return { success: true, message: "Connection successful", latencyMs, modelName: conn.model };
      } else {
        const body = await res.text();
        return {
          success: false,
          message: `API returned ${res.status}: ${body.slice(0, 200)}`,
          latencyMs,
          modelName: null,
        };
      }
    } catch (err) {
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
      const { PROVIDERS } = await import("@marinara-engine/shared");
      const provider = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      const baseUrl = conn.baseUrl || provider?.defaultBaseUrl || "";

      if (!baseUrl) {
        return reply.status(400).send({ error: "No base URL configured" });
      }

      // Validate baseUrl against SSRF
      const urlError = validateExternalUrl(baseUrl);
      if (urlError) {
        return reply.status(400).send({ error: `Base URL rejected: ${urlError}` });
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider?.usesAuthHeader) {
        headers["Authorization"] = `Bearer ${conn.apiKey}`;
      }
      if (provider?.apiKeyHeader) {
        headers[provider.apiKeyHeader] = conn.apiKey;
      }

      // Anthropic requires version header for models endpoint
      if (conn.provider === "anthropic") {
        headers["anthropic-version"] = "2023-06-01";
      }

      let modelsUrl = `${baseUrl}${provider?.modelsEndpoint ?? "/models"}`;
      if (conn.provider === "google") {
        modelsUrl += `?key=${conn.apiKey}`;
      }

      const res = await fetch(modelsUrl, { headers });
      if (!res.ok) {
        const body = await res.text();
        return reply.status(502).send({
          error: `Provider returned ${res.status}: ${body.slice(0, 300)}`,
        });
      }

      const json = (await res.json()) as Record<string, unknown>;

      // Normalize across providers
      const models = normalizeModelsResponse(conn.provider, json);
      return { models };
    } catch (err) {
      return reply.status(502).send({
        error: `Failed to fetch models: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
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

    if (!baseUrl) {
      return reply.status(400).send({ error: "No base URL configured" });
    }

    const start = Date.now();
    try {
      const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);

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
      return {
        success: true,
        response: fullResponse.slice(0, 500),
        latencyMs,
        model: conn.model,
      };
    } catch (err) {
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
}

function normalizeModelsResponse(provider: string, json: Record<string, unknown>): RemoteModel[] {
  switch (provider) {
    case "google": {
      // Google returns { models: [{ name: "models/gemini-...", displayName: "..." }] }
      const models = (json.models ?? []) as Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
      return models
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({
          id: (m.name ?? "").replace(/^models\//, ""),
          name: m.displayName ?? (m.name ?? "").replace(/^models\//, ""),
        }))
        .filter((m) => m.id);
    }

    case "anthropic": {
      // Anthropic returns { data: [{ id: "claude-...", display_name: "..." }] }
      const data = (json.data ?? []) as Array<{
        id?: string;
        display_name?: string;
        type?: string;
      }>;
      return data
        .filter((m) => m.type === "model" || m.id)
        .map((m) => ({
          id: m.id ?? "",
          name: m.display_name ?? m.id ?? "",
        }))
        .filter((m) => m.id);
    }

    case "cohere": {
      // Cohere returns { models: [{ name: "command-r-plus", ... }] }
      const models = (json.models ?? []) as Array<{
        name?: string;
        endpoints?: string[];
      }>;
      return models
        .filter((m) => m.endpoints?.includes("chat"))
        .map((m) => ({
          id: m.name ?? "",
          name: m.name ?? "",
        }))
        .filter((m) => m.id);
    }

    default: {
      // OpenAI-compatible: { data: [{ id: "gpt-4o", ... }] }
      // This covers openai, mistral, openrouter, custom
      const data = (json.data ?? []) as Array<{
        id?: string;
        name?: string;
      }>;
      return data
        .map((m) => ({
          id: m.id ?? "",
          name: m.name ?? m.id ?? "",
        }))
        .filter((m) => m.id);
    }
  }
}

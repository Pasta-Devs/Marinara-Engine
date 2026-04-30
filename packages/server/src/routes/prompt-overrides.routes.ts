// ──────────────────────────────────────────────
// Routes: Prompt Overrides
//
// Lists registered overridable prompts, returns
// canonical defaults, and accepts user templates
// validated against each prompt's declared
// variable schema.
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import {
  PROMPT_OVERRIDE_REGISTRY,
  getPromptOverrideDef,
  renderTemplate,
  validateTemplate,
} from "../services/prompt-overrides/index.js";

const upsertBodySchema = z.object({
  template: z.string().min(1, "Template must not be empty"),
  enabled: z.boolean().optional().default(true),
});

const previewBodySchema = z.object({
  template: z.string(),
  context: z.record(z.union([z.string(), z.number()])).optional(),
});

export async function promptOverridesRoutes(app: FastifyInstance) {
  const storage = createPromptOverridesStorage(app.db);

  /** List every registered key with override status. */
  app.get("/", async () => {
    const overrides = await storage.list();
    const overrideByKey = new Map(overrides.map((row) => [row.key, row]));
    return PROMPT_OVERRIDE_REGISTRY.map((def) => {
      const row = overrideByKey.get(def.key);
      return {
        key: def.key,
        description: def.description,
        variables: def.variables,
        hasOverride: !!row,
        enabled: row?.enabled ?? false,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  });

  /** Read the current override (if any) for a single key. */
  app.get<{ Params: { key: string } }>("/:key", async (req, reply) => {
    const def = getPromptOverrideDef(req.params.key);
    if (!def) return reply.status(404).send({ error: "Unknown prompt key" });
    const row = await storage.get(def.key);
    return {
      key: def.key,
      description: def.description,
      variables: def.variables,
      override: row ?? null,
    };
  });

  /** Render the canonical default with the registered example context. */
  app.get<{ Params: { key: string } }>("/:key/default", async (req, reply) => {
    const def = getPromptOverrideDef(req.params.key);
    if (!def) return reply.status(404).send({ error: "Unknown prompt key" });
    return {
      key: def.key,
      template: def.defaultBuilder(def.exampleContext),
      exampleContext: def.exampleContext,
    };
  });

  /** Save or replace an override for the given key. */
  app.put<{ Params: { key: string } }>("/:key", async (req, reply) => {
    const def = getPromptOverrideDef(req.params.key);
    if (!def) return reply.status(404).send({ error: "Unknown prompt key" });
    const input = upsertBodySchema.parse(req.body);
    const declared = def.variables.map((v) => v.name);
    const validation = validateTemplate(input.template, declared);
    if (!validation.valid) {
      return reply.status(400).send({
        error: "Template references unknown variables",
        unknownVariables: validation.unknownVariables,
        declaredVariables: declared,
      });
    }
    return storage.upsert({ key: def.key, template: input.template, enabled: input.enabled });
  });

  /** Reset a key by removing its override row. */
  app.delete<{ Params: { key: string } }>("/:key", async (req, reply) => {
    const def = getPromptOverrideDef(req.params.key);
    if (!def) return reply.status(404).send({ error: "Unknown prompt key" });
    await storage.remove(def.key);
    return reply.status(204).send();
  });

  /** Render an arbitrary template with optional caller-supplied context (defaults to example). */
  app.post<{ Params: { key: string } }>("/:key/preview", async (req, reply) => {
    const def = getPromptOverrideDef(req.params.key);
    if (!def) return reply.status(404).send({ error: "Unknown prompt key" });
    const input = previewBodySchema.parse(req.body);
    const declared = def.variables.map((v) => v.name);
    const validation = validateTemplate(input.template, declared);
    if (!validation.valid) {
      return reply.status(400).send({
        error: "Template references unknown variables",
        unknownVariables: validation.unknownVariables,
        declaredVariables: declared,
      });
    }
    const ctx = { ...def.exampleContext, ...(input.context ?? {}) };
    return { rendered: renderTemplate(input.template, ctx, declared) };
  });
}

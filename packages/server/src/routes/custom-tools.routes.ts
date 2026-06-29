// ──────────────────────────────────────────────
// Routes: Custom Tools
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import {
  BUILT_IN_TOOLS,
  createCustomToolSchema,
  reorderCustomToolsSchema,
  updateCustomToolSchema,
} from "@marinara-engine/shared";
import { createCustomToolsStorage } from "../services/storage/custom-tools.storage.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { isCustomToolScriptEnabled } from "../config/runtime-config.js";

const SCRIPT_TOOL_DISABLED_MESSAGE =
  "Script custom tools are disabled. Set CUSTOM_TOOL_SCRIPT_ENABLED=true in your .env and restart Marinara only for trusted in-process script tools.";

function isReservedBuiltInToolName(name: string): boolean {
  return BUILT_IN_TOOLS.some((tool) => tool.name === name);
}

export async function customToolsRoutes(app: FastifyInstance) {
  const storage = createCustomToolsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.get("/capabilities", async () => {
    return { scriptExecutionEnabled: isCustomToolScriptEnabled() };
  });

  app.put("/reorder", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Custom tool reorder" })) return;
    const input = reorderCustomToolsSchema.parse(req.body);
    return storage.reorder(input.toolIds);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const tool = await storage.getById(req.params.id);
    if (!tool) return reply.status(404).send({ error: "Tool not found" });
    return tool;
  });

  app.post("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Custom tool creation" })) return;
    const input = createCustomToolSchema.parse(req.body);
    if (input.executionType === "script" && !isCustomToolScriptEnabled()) {
      return reply.status(403).send({ error: SCRIPT_TOOL_DISABLED_MESSAGE });
    }
    if (isReservedBuiltInToolName(input.name)) {
      return reply.status(409).send({ error: `"${input.name}" is a reserved built-in tool name.` });
    }
    // Check name uniqueness
    const existing = await storage.getByName(input.name);
    if (existing) {
      return reply.status(409).send({ error: `A tool named "${input.name}" already exists.` });
    }
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Custom tool update" })) return;
    const data = updateCustomToolSchema.parse(req.body);
    const current = await storage.getById(req.params.id);
    if (!current) return reply.status(404).send({ error: "Tool not found" });

    const nextExecutionType = data.executionType ?? current.executionType;
    if (nextExecutionType === "script" && !isCustomToolScriptEnabled()) {
      return reply.status(403).send({ error: SCRIPT_TOOL_DISABLED_MESSAGE });
    }
    if (data.name !== undefined) {
      if (isReservedBuiltInToolName(data.name)) {
        return reply.status(409).send({ error: `"${data.name}" is a reserved built-in tool name.` });
      }
      const existing = await storage.getByName(data.name);
      if (existing && existing.id !== req.params.id) {
        return reply.status(409).send({ error: `A tool named "${data.name}" already exists.` });
      }
    }

    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Custom tool deletion" })) return;
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });
}

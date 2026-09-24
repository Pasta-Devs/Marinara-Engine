import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentConfigSchema, homeAgentWidgetsSchema } from "../../packages/shared/src/schemas/agent.schema.js";

const widget = { id: "status", title: "Status", description: "Current status", size: "compact" as const };
assert.equal(homeAgentWidgetsSchema.safeParse([widget, widget]).success, false);
assert.equal(homeAgentWidgetsSchema.safeParse([widget, widget, widget, widget]).success, false);
assert.equal(homeAgentWidgetsSchema.safeParse([{ ...widget, title: "" }]).success, false);
assert.equal(createAgentConfigSchema.shape.settings.safeParse({ homeWidgets: [widget] }).success, true);
assert.equal(createAgentConfigSchema.shape.settings.safeParse({ homeWidgets: [widget, widget] }).success, false);

const dataDir = mkdtempSync(join(tmpdir(), "marinara-agent-widget-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
try {
  const db = await getDB();
  const storage = createAgentsStorage(db);
  const agent = await storage.create({
    type: "custom-widget-proof",
    name: "Widget proof",
    phase: "post_processing",
    settings: { homeWidgets: [widget] },
    promptTemplate: "",
  });
  assert.ok(agent);
  assert.deepEqual(await storage.readHomeWidgetState(agent.id, widget.id), { text: "", updatedAt: null });
  await storage.publishHomeWidgetState(agent.id, widget.id, "Ready");
  assert.equal((await storage.readHomeWidgetState(agent.id, widget.id))?.text, "Ready");
  const mari = new MariDbService(db);
  const mariUpdate = await mari.executeAction({
    action: "agent.update",
    agentId: agent.id,
    data: { settings: { homeWidgets: [{ ...widget, title: "Mari changed this" }] } },
    apply: true,
  });
  assert.equal(mariUpdate.ok, false);
  const reorderedWidget = {
    size: widget.size,
    description: widget.description,
    title: widget.title,
    id: widget.id,
  };
  const mariEquivalentUpdate = await mari.executeAction({
    action: "agent.update",
    agentId: agent.id,
    data: { settings: { homeWidgets: [reorderedWidget] } },
    apply: true,
  });
  assert.equal(mariEquivalentUpdate.ok, true);
  const mariWidgetPublish = await mari.executeAction({
    action: "db.update",
    table: "app_settings",
    id: `agent_home_widget:${agent.id}:${widget.id}`,
    data: { value: JSON.stringify({ text: "Bypassed", updatedAt: new Date().toISOString() }) },
    apply: true,
  });
  assert.equal(mariWidgetPublish.ok, false);
  await assert.rejects(storage.publishHomeWidgetState(agent.id, "other", "Forbidden"));
  await assert.rejects(storage.publishHomeWidgetState(agent.id, widget.id, "x".repeat(501)));
  await storage.update(agent.id, { settings: { homeWidgets: [] } });
  assert.equal(await storage.readHomeWidgetState(agent.id, widget.id), null);
  await storage.update(agent.id, { settings: { homeWidgets: [widget] } });
  assert.deepEqual(await storage.readHomeWidgetState(agent.id, widget.id), { text: "", updatedAt: null });
  await storage.remove(agent.id);
  assert.equal(await storage.readHomeWidgetState(agent.id, widget.id), null);
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}

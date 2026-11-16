// Mari's Home widget actions: previews, one write per catalog revision, and a conflicting restore that fails safely
// and stays available to retry or keep. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import {
  HomeWidgetCatalogConflictError,
  readHomeWidgetCatalog,
  replaceHomeWidgetCatalog,
} from "../../../packages/server/src/services/home-widget-catalog.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-home-widget-actions-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  const widgetPreview = await mariDb.executeAction({
    action: "home_widget.create",
    data: {
      title: "Tonight's menu",
      description: "A tiny reminder to choose a chat mood before cooking.",
      accent: "orange",
      icon: "note",
    },
    apply: false,
  });
  assert.equal(widgetPreview.ok, true);
  assert.equal(widgetPreview.mode, "dry-run", "Professor Mari must preview a custom widget before confirmation");
  assert.deepEqual((await mariDb.executeAction({ action: "home_widget.list" })).output, []);
  const approvalsBeforeWidgetCreate = new Set(mariDb.getPendingApprovals().map((approval) => approval.id));
  const widgetCreate = await mariDb.executeAction({
    action: "home_widget.create",
    data: {
      title: "Tonight's menu",
      description: "A tiny reminder to choose a chat mood before cooking.",
      accent: "orange",
      icon: "note",
    },
    apply: true,
  });
  assert.equal(widgetCreate.ok, true);
  const widgetList = await mariDb.executeAction({ action: "home_widget.list" });
  const createdWidget = (widgetList.output as Array<{ id: string; title: string }>)[0];
  assert.equal(createdWidget?.title, "Tonight's menu");
  assert.equal((await mariDb.executeAction({ action: "home_widget.get", widgetId: createdWidget.id })).ok, true);
  const catalogBeforeConcurrentWrites = await readHomeWidgetCatalog(db);
  const concurrentCatalogWrites = await Promise.allSettled([
    replaceHomeWidgetCatalog(db, catalogBeforeConcurrentWrites.revision, catalogBeforeConcurrentWrites.widgets),
    replaceHomeWidgetCatalog(db, catalogBeforeConcurrentWrites.revision, catalogBeforeConcurrentWrites.widgets),
  ]);
  assert.equal(
    concurrentCatalogWrites.filter((result) => result.status === "fulfilled").length,
    1,
    "Only one write may commit for a Home widget catalog revision",
  );
  const rejectedCatalogWrite = concurrentCatalogWrites.find((result) => result.status === "rejected");
  assert.equal(
    rejectedCatalogWrite?.status === "rejected" &&
      rejectedCatalogWrite.reason instanceof HomeWidgetCatalogConflictError,
    true,
  );
  const widgetApproval = mariDb.getPendingApprovals().find((approval) => !approvalsBeforeWidgetCreate.has(approval.id));
  assert.ok(widgetApproval, "Applying a Home widget change must create a review approval");
  await assert.rejects(
    mariDb.restoreAppliedReview(widgetApproval.id),
    HomeWidgetCatalogConflictError,
    "A conflicting Home widget restore must fail safely",
  );
  assert.equal(
    mariDb.getPendingApprovals().some((approval) => approval.id === widgetApproval.id),
    true,
    "A failed Home widget restore must remain available to retry or keep",
  );
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}

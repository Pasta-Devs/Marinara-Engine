import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import {
  createPersonalExtensionSchema,
  updatePersonalExtensionSchema,
} from "../../packages/shared/src/schemas/personal-extension.schema.js";
import type { DB } from "../../packages/server/src/db/connection.js";
import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { appSettings, installedExtensions } from "../../packages/server/src/db/schema/index.js";
import {
  getPersonalExtensionPolicy,
  setExternalExtensionsEnabled,
} from "../../packages/server/src/services/extensions/personal-extension-policy.service.js";
import { getPersonalExtensionSandboxStatus } from "../../packages/server/src/services/extensions/personal-extension-sandbox.js";
import { createPersonalExtensionSettingsStorage } from "../../packages/server/src/services/extensions/personal-extension-settings.service.js";
import { createPersonalExtensionsStorage } from "../../packages/server/src/services/extensions/personal-extension-storage.service.js";
import { PersonalServerExtensionRuntime } from "../../packages/server/src/services/extensions/personal-server-extension-runtime.js";
import { getMariDbService } from "../../packages/server/src/services/mari-db/mari-db.service.js";
import { preparePersonalExtensionTrust } from "../../packages/server/src/services/setup/personal-extension-trust.js";
import { createAppSettingsStorage } from "../../packages/server/src/services/storage/app-settings.storage.js";

const readSource = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const clientInjectorSource = readSource("../../packages/client/src/components/layout/PersonalExtensionInjector.tsx");
const clientContextSource = readSource("../../packages/client/src/lib/personal-extension-context.ts");
const clientContributionSource = readSource("../../packages/client/src/lib/personal-extension-contributions.ts");
const clientContributionPanelSource = readSource(
  "../../packages/client/src/components/panels/PersonalExtensionPanel.tsx",
);
const clientContributionSlotSource = readSource(
  "../../packages/client/src/components/extensions/PersonalExtensionContributionSlot.tsx",
);
const clientContributionIconSource = readSource(
  "../../packages/client/src/components/extensions/PersonalExtensionContributionIcon.tsx",
);
const clientContributionMenuSource = readSource(
  "../../packages/client/src/components/layout/PersonalExtensionContributionsMenu.tsx",
);
const rightPanelSource = readSource("../../packages/client/src/components/layout/RightPanel.tsx");
const chatSidebarSource = readSource("../../packages/client/src/components/layout/ChatSidebar.tsx");
const clientSettingsSource = readSource(
  "../../packages/client/src/components/panels/settings/PersonalExtensionsSettings.tsx",
);
const settingsPanelSource = readSource("../../packages/client/src/components/panels/SettingsPanel.tsx");
const clientHooksSource = readSource("../../packages/client/src/hooks/use-personal-extensions.ts");
const clientImportSource = readSource("../../packages/client/src/lib/personal-extension-import.ts");
const localizationSource = readSource("../../packages/client/src/localization/locales/en.json");
const routeSource = readSource("../../packages/server/src/routes/personal-extensions.routes.ts");
const runtimeSource = readSource("../../packages/server/src/services/extensions/personal-server-extension-runtime.ts");
const sandboxSource = readSource("../../packages/server/src/services/extensions/personal-extension-sandbox.ts");
const schemaSource = readSource("../../packages/shared/src/schemas/personal-extension.schema.ts");
const backupSource = readSource("../../packages/server/src/routes/backup.routes.ts");
const professorMariSource = readSource("../../packages/server/src/services/professor-mari/workspace-agent.service.ts");

assert.match(
  localizationSource,
  /Ask Professor Mari to create an extension for you\. Nothing runs until you enable it and approve the exact code hash\./u,
);
assert.match(localizationSource, /read-only active chat and Character IDs\./u);
assert.match(localizationSource, /It also requests: \{\{permissions\}\}\./u);
assert.match(localizationSource, /Read active Character cards/u);
assert.match(localizationSource, /Read active Persona/u);
assert.match(localizationSource, /Full page access/u);
assert.match(localizationSource, /call same-origin Marinara APIs with your current session/u);
assert.match(clientSettingsSource, /mode="personal"/u);
assert.match(clientSettingsSource, /mode="external"/u);
assert.match(clientSettingsSource, /isExternal && \(/u);
assert.match(clientSettingsSource, /settings\.externalExtensions\.formats\.title/u);
assert.match(localizationSource, /"settings\.externalExtensions\.formats\.title": "Supported local formats"/u);
assert.match(clientSettingsSource, /const fingerprint = extension\.contentHash/u);
assert.match(clientSettingsSource, /settings\.personalExtensions\.capabilities\.title/u);
assert.match(clientSettingsSource, /PERSONAL_EXTENSION_CAPABILITIES\.filter/u);
assert.match(clientSettingsSource, /settings\.personalExtensions\.approval\.titleFullPage/u);
assert.match(clientSettingsSource, /acknowledgeFullPageAccess:\s*fullPageAccess/u);
assert.doesNotMatch(clientSettingsSource, /\+ New Draft/u);
assert.match(settingsPanelSource, /extensionPolicy\?\.externalExtensionsEnabled && <ExternalExtensionsSettings/u);
assert.match(settingsPanelSource, /settings\.externalExtensions\.warning/u);

assert.match(clientInjectorSource, /iframe\.setAttribute\("sandbox", "allow-scripts"\)/u);
assert.doesNotMatch(clientInjectorSource, /allow-same-origin/u);
assert.match(clientInjectorSource, /event\.origin !== "null"/u);
assert.match(clientInjectorSource, /extension\.executionMode === "full-page"/u);
assert.match(clientInjectorSource, /document\.createElement\("script"\)/u);
assert.match(clientInjectorSource, /__marinaraRunFullPageExtension/u);
assert.match(clientInjectorSource, /activeFullPageExtensions\.get\(identity\.id\)/u);
assert.match(clientInjectorSource, /identity\.contentHash !== active\.contentHash/u);
assert.match(clientInjectorSource, /const stale = activeFullPageExtensions\.get\(identity\.id\) !== active/u);
assert.match(clientInjectorSource, /late cleanup failed/u);
assert.match(clientInjectorSource, /Full-page extension runtime could not be loaded/u);
assert.match(
  clientInjectorSource,
  /activeFullPageExtensions\.get\(extension\.id\)\?\.script === script[\s\S]*cleanupExtension\(extension\.id\)/u,
);
assert.match(clientInjectorSource, /registerPersonalExtensionContribution/u);
assert.match(clientInjectorSource, /removePersonalExtensionContributions/u);
assert.match(clientInjectorSource, /message\.contentHash === active\.contentHash/u);
assert.match(clientInjectorSource, /useChatStore\.subscribe/u);
assert.match(clientInjectorSource, /type:\s*"context-update"/u);
assert.match(clientInjectorSource, /contentHash:\s*active\.contentHash/u);
assert.doesNotMatch(clientInjectorSource, /activeChat\.messages/u);
assert.match(clientInjectorSource, /activeChat\.personaId/u);
assert.match(clientInjectorSource, /canReadPersona \? context\.personaId : null/u);
assert.doesNotMatch(clientContextSource, /\bmessages?\b|\bfetch\b/iu);
assert.match(clientInjectorSource, /extensionFetch\(active\.extension\.id,\s*"context"/u);
assert.match(clientContributionSource, /PERSONAL_EXTENSION_UI_LIMITS/u);
assert.match(clientContributionSource, /PERSONAL_EXTENSION_CONTRIBUTION_SURFACES/u);
assert.match(clientContributionSource, /PERSONAL_EXTENSION_CONTRIBUTION_POSITIONS/u);
assert.match(clientContributionSlotSource, /contribution\.surface === surface/u);
assert.match(clientContributionSlotSource, /activatePersonalExtensionContribution\(contribution\.key\)/u);
assert.match(clientContributionIconSource, /lucide-react\/dynamic/u);
assert.match(clientContributionIconSource, /CONTRIBUTION_ICON_NAMES\.has\(name\)/u);
assert.match(clientContributionMenuSource, /menuContributionCount = menuItems\.length \+ panels\.length/u);
assert.doesNotMatch(
  clientContributionMenuSource,
  /const buttons = contributions\.filter\(\(contribution\) => contribution\.kind === "button"\);/u,
);
for (const [panel, surface] of [
  ["bot-browser", "bots"],
  ["characters", "characters"],
  ["personas", "personas"],
  ["lorebooks", "lorebooks"],
  ["presets", "presets"],
  ["connections", "connections"],
  ["agents", "agents"],
  ["settings", "settings"],
]) {
  assert.match(rightPanelSource, new RegExp(`(?:"${panel}"|${panel}): "${surface}"`, "u"));
}
for (const position of ["header", "before-content", "after-content"]) {
  assert.match(chatSidebarSource, new RegExp(`surface="chats"[\\s\\S]{0,80}position="${position}"`, "u"));
  assert.match(rightPanelSource, new RegExp(`position="${position}"`, "u"));
}
assert.doesNotMatch(clientContributionPanelSource, /dangerouslySetInnerHTML|innerHTML/u);
assert.match(clientContributionPanelSource, /aria-label=\{element\.label \? undefined :/u);
assert.match(clientContributionPanelSource, /\[activePanelKey, defaultsKey\]/u);
assert.doesNotMatch(clientContributionPanelSource, /\[activePanelKey, defaultsKey, elements\]/u);
assert.doesNotMatch(clientHooksSource, /refetchInterval/u);
assert.match(clientHooksSource, /staleTime:\s*30_000/u);
assert.match(routeSource, /worker-src blob:/u);
assert.match(routeSource, /connect-src 'none'/u);
assert.match(routeSource, /new Worker\(workerUrl\)/u);
assert.match(routeSource, /sandbox became unresponsive/u);
assert.match(routeSource, /canExecutePersonalExtension/u);
assert.match(routeSource, /ENABLE_EXTERNAL_EXTENSIONS=true/u);
assert.match(routeSource, /panel control id contains unsupported characters/u);
assert.match(routeSource, /read_active_characters/u);
assert.match(routeSource, /read_active_persona/u);
assert.match(routeSource, /parseContextCharacterIds\(chat\.characterIds\)/u);
assert.match(routeSource, /allowedIds\.has\(id\)/u);
assert.match(routeSource, /approvedFullPageExtension/u);
assert.match(routeSource, /page-runtime\.js/u);
assert.match(routeSource, /page-style\.css/u);
assert.match(routeSource, /Full page access must be explicitly acknowledged/u);
assert.match(routeSource, /isExternalPersonalExtensionSource\(extension\.source\)/u);
assert.match(clientImportSource, /kind === "marinara\.extension"/u);
assert.match(clientImportSource, /hasOwnProperty\.call\(record, "capabilities"\)/u);

assert.match(schemaSource, /acknowledgeSandboxedCode:\s*z\.literal\(true\)/u);
assert.match(schemaSource, /acknowledgeFullPageAccess:\s*z\.literal\(true\)\.optional/u);
assert.match(runtimeSource, /spawnSandboxedPersonalExtension/u);
assert.doesNotMatch(runtimeSource, /pathToFileURL|safeFetch|await import\(/u);
assert.match(sandboxSource, /--permission/u);
assert.match(sandboxSource, /--unshare-all/u);
assert.match(sandboxSource, /macos-seatbelt/u);
assert.match(sandboxSource, /linux-bubblewrap/u);

assert.match(backupSource, /quarantineProfilePersonalExtensionRow/u);
assert.match(backupSource, /approvedHash: null/u);
assert.match(professorMariSource, /Never claim to approve, enable, or run an extension/u);
assert.doesNotMatch(professorMariSource, /personal_extension\.approve|personal_extension\.enable/u);

const manifestWithEnabled = createPersonalExtensionSchema.parse({
  name: "Manifest tries to self-enable",
  runtime: "client",
  js: "globalThis.__manifestShouldNotRun = true;",
  enabled: true,
});
assert.equal("enabled" in manifestWithEnabled, false);

const sourceOverOneMiB = `/*${"x".repeat(1024 * 1024)}*/`;
assert.equal(
  createPersonalExtensionSchema.parse({ name: "Large browser draft", runtime: "client", js: sourceOverOneMiB }).js,
  sourceOverOneMiB,
);
assert.equal(
  createPersonalExtensionSchema.parse({ name: "Large server draft", runtime: "server", serverJs: sourceOverOneMiB })
    .serverJs,
  sourceOverOneMiB,
);
assert.equal(updatePersonalExtensionSchema.parse({ js: sourceOverOneMiB }).js, sourceOverOneMiB);
assert.equal(updatePersonalExtensionSchema.parse({ serverJs: sourceOverOneMiB }).serverJs, sourceOverOneMiB);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-personal-extension-security-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousExternalGate = process.env.ENABLE_EXTERNAL_EXTENSIONS;
const previousSandboxSecret = process.env.MARINARA_EXTENSION_SANDBOX_SECRET;
process.env.FILE_STORAGE_DIR = storageDir;
process.env.ENABLE_EXTERNAL_EXTENSIONS = "false";
process.env.MARINARA_EXTENSION_SANDBOX_SECRET = "must-not-leak";
const outsideSecretPath = join(storageDir, "outside-secret.txt");
writeFileSync(outsideSecretPath, "outside-secret", "utf8");
const fileDb = await createFileNativeDB();
const db = fileDb as unknown as DB;
try {
  const timestamp = new Date(0).toISOString();
  await db.insert(installedExtensions).values({
    id: "legacy-local-extension",
    name: "Legacy local extension",
    description: "Regression fixture",
    runtime: "client",
    css: null,
    js: "globalThis.__legacyShouldWaitForApproval = true;",
    serverJs: null,
    enabled: "true",
    installedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(appSettings).values({
    key: "extension-storage:legacy-local-extension",
    value: '{"kept":true}',
    updatedAt: timestamp,
  });

  const migration = await preparePersonalExtensionTrust(db);
  assert.deepEqual(migration, { legacyRecordsQuarantined: 1, changedRecordsDisabled: 0 });
  const migratedRows = await db.select().from(installedExtensions);
  assert.equal(migratedRows[0]!.enabled, "false");
  assert.equal(migratedRows[0]!.approvedHash, null);
  assert.equal(migratedRows[0]!.source, "legacy");

  const storage = createPersonalExtensionsStorage(db);
  const largeDraft = await storage.create({
    name: "Large source draft",
    runtime: "client",
    js: sourceOverOneMiB,
  });
  assert.ok(largeDraft);
  assert.equal(largeDraft.js, sourceOverOneMiB);
  const largeServerUpdate = await storage.update(largeDraft.id, {
    runtime: "server",
    serverJs: sourceOverOneMiB,
  });
  assert.equal(largeServerUpdate?.serverJs, sourceOverOneMiB);
  assert.equal(largeServerUpdate?.revisions[0]?.js, sourceOverOneMiB);

  const externalDraft = await storage.create(
    {
      name: "Dropped external extension",
      runtime: "client",
      js: "marinara.log.info('external');",
    },
    { source: "external" },
  );
  assert.ok(externalDraft);
  assert.equal(externalDraft.enabled, false);
  assert.deepEqual(externalDraft.capabilities, []);

  const fullPageDraft = await storage.create(
    {
      name: "Trusted legacy page extension",
      runtime: "client",
      capabilities: ["full_page_access"],
      js: "document.documentElement.dataset.fullPageProof = 'active';",
    },
    { source: "external" },
  );
  assert.ok(fullPageDraft);
  assert.deepEqual(fullPageDraft.capabilities, ["full_page_access"]);
  await assert.rejects(
    storage.create(
      {
        name: "Professor full page attempt",
        runtime: "client",
        capabilities: ["full_page_access"],
        js: "document.body.remove();",
      },
      { source: "professor_mari" },
    ),
    /Professor Mari extensions cannot request full page access/u,
  );

  const capabilityDraft = await storage.create(
    {
      name: "Scoped context extension",
      runtime: "client",
      capabilities: ["read_active_characters"],
      js: "marinara.log.info('scoped');",
    },
    { source: "professor_mari" },
  );
  assert.ok(capabilityDraft);
  assert.deepEqual(capabilityDraft.capabilities, ["read_active_characters"]);
  const approvedCapabilityDraft = await storage.approve(capabilityDraft.id, capabilityDraft.contentHash);
  assert.equal(approvedCapabilityDraft?.enabled, true);
  const changedCapabilityDraft = await storage.update(capabilityDraft.id, {
    capabilities: ["read_active_persona"],
  });
  assert.ok(changedCapabilityDraft);
  assert.notEqual(changedCapabilityDraft.contentHash, capabilityDraft.contentHash);
  assert.equal(changedCapabilityDraft.enabled, false);
  assert.equal(changedCapabilityDraft.approvedHash, null);
  assert.deepEqual(changedCapabilityDraft.capabilities, ["read_active_persona"]);
  assert.deepEqual(changedCapabilityDraft.revisions[0]?.capabilities, ["read_active_characters"]);
  const rolledBackCapabilityDraft = await storage.rollback(capabilityDraft.id, capabilityDraft.contentHash);
  assert.deepEqual(rolledBackCapabilityDraft?.capabilities, ["read_active_characters"]);
  assert.equal(rolledBackCapabilityDraft?.enabled, false);
  assert.equal(rolledBackCapabilityDraft?.approvedHash, null);

  await createAppSettingsStorage(db).set("external-extensions-enabled", "true");
  let policy = await getPersonalExtensionPolicy(db);
  assert.equal(policy.externalExtensionsEnvEnabled, false);
  assert.equal(policy.externalExtensionsEnabled, false);

  const directlyApprovedExternal = await storage.approve(externalDraft.id, externalDraft.contentHash);
  assert.equal(directlyApprovedExternal?.enabled, true);
  const policyRuntime = new PersonalServerExtensionRuntime();
  await policyRuntime.start(db);
  assert.equal((await storage.getById(externalDraft.id))?.enabled, false);
  await policyRuntime.stop();

  process.env.ENABLE_EXTERNAL_EXTENSIONS = "true";
  await setExternalExtensionsEnabled(db, false);
  policy = await getPersonalExtensionPolicy(db);
  assert.equal(policy.externalExtensionsEnvEnabled, true);
  assert.equal(policy.externalExtensionsEnabled, false);
  policy = await setExternalExtensionsEnabled(db, true);
  assert.equal(policy.externalExtensionsEnabled, true);

  const mariDb = getMariDbService(db);
  const mariCreate = await mariDb.executeAction({
    action: "personal_extension.create",
    data: {
      name: "Professor Mari draft",
      runtime: "client",
      js: "marinara.log.info('draft');",
    },
    apply: true,
    sessionId: "personal-extension-regression",
  });
  assert.equal(mariCreate.ok, true, JSON.stringify(mariCreate));
  const mariDraft = await storage.getByName("Professor Mari draft");
  assert.ok(mariDraft);
  assert.equal(mariDraft.source, "professor_mari");
  assert.equal(mariDraft.enabled, false);
  assert.equal(mariDraft.approvedHash, null);

  const forbiddenMariApproval = await mariDb.executeAction({
    action: "personal_extension.approve",
    extensionId: mariDraft.id,
    apply: true,
    sessionId: "personal-extension-regression",
  });
  assert.equal(forbiddenMariApproval.ok, false);

  const rawApprovalAttempt = await mariDb.executeCli({
    argv: [
      "db",
      "patch",
      "installed_extensions",
      mariDraft.id,
      "--json",
      JSON.stringify({ enabled: "true", approvedHash: mariDraft.contentHash }),
      "--apply",
    ],
    command: "mari db patch installed_extensions <id> --json <approval> --apply",
    sessionId: "personal-extension-regression",
  });
  assert.equal(rawApprovalAttempt.ok, false);
  assert.match(
    JSON.stringify(rawApprovalAttempt.validation),
    /cannot mutate Personal Extensions through raw DB actions/u,
  );

  const sandbox = getPersonalExtensionSandboxStatus();
  if (!sandbox.available) {
    assert.ok(sandbox.reason.length > 0);
    console.log(`Server extension sandbox runtime proof skipped: ${sandbox.reason}`);
  } else {
    const serverDraft = await storage.create(
      {
        name: "Sandbox capability proof",
        runtime: "server",
        serverJs: `
          ${sourceOverOneMiB}
          const escapedProcess = globalThis.constructor.constructor("return process")();
          const fs = escapedProcess.getBuiltinModule("node:fs");
          const childProcess = escapedProcess.getBuiltinModule("node:child_process");
          const net = escapedProcess.getBuiltinModule("node:net");
          let outsideReadBlocked = false;
          let arbitraryWriteBlocked = false;
          let childProcessBlocked = false;
          let parentSignalBlocked = false;
          let networkBlocked = false;
          try { fs.readFileSync(${JSON.stringify(outsideSecretPath)}, "utf8"); } catch { outsideReadBlocked = true; }
          try { fs.writeFileSync(escapedProcess.env.HOME + "/extension-owned.txt", "unsafe"); } catch { arbitraryWriteBlocked = true; }
          try { childProcess.spawnSync("/bin/echo", ["unsafe"]); } catch { childProcessBlocked = true; }
          try { escapedProcess.kill(escapedProcess.ppid, 0); } catch { parentSignalBlocked = true; }
          await new Promise((resolve) => {
            let socket;
            try {
              socket = net.connect({ host: "127.0.0.1", port: 9 });
            } catch {
              networkBlocked = true;
              resolve();
              return;
            }
            socket.once("error", () => {
              networkBlocked = true;
              resolve();
            });
            marinara.setTimeout(() => {
              socket.destroy();
              resolve();
            }, 500);
          });
          await marinara.storage.patch({
            started: true,
            processType: typeof process,
            fetchType: typeof fetch,
            documentType: typeof document,
            inheritedSecret: escapedProcess.env.MARINARA_EXTENSION_SANDBOX_SECRET ?? null,
            outsideReadBlocked,
            arbitraryWriteBlocked,
            childProcessBlocked,
            parentSignalBlocked,
            networkBlocked,
          });
          marinara.onCleanup(async () => {
            await marinara.storage.patch({ stopped: true });
          });
        `,
      },
      { source: "professor_mari" },
    );
    assert.ok(serverDraft);
    const approvedServer = await storage.approve(serverDraft.id, serverDraft.contentHash);
    assert.ok(approvedServer?.enabled);
    const runtime = new PersonalServerExtensionRuntime();
    const extensionSettings = createPersonalExtensionSettingsStorage(createAppSettingsStorage(db));
    await runtime.start(db);
    assert.equal(runtime.withRuntimeStatus(approvedServer).serverStatus, "running");
    assert.deepEqual(await extensionSettings.get(serverDraft.id), {
      started: true,
      processType: "undefined",
      fetchType: "undefined",
      documentType: "undefined",
      inheritedSecret: null,
      outsideReadBlocked: true,
      arbitraryWriteBlocked: true,
      childProcessBlocked: true,
      parentSignalBlocked: true,
      networkBlocked: true,
    });
    await runtime.stop();
    assert.deepEqual(await extensionSettings.get(serverDraft.id), {
      started: true,
      stopped: true,
      processType: "undefined",
      fetchType: "undefined",
      documentType: "undefined",
      inheritedSecret: null,
      outsideReadBlocked: true,
      arbitraryWriteBlocked: true,
      childProcessBlocked: true,
      parentSignalBlocked: true,
      networkBlocked: true,
    });
    console.log(`Server extension sandbox runtime proof passed with ${sandbox.backend}.`);
  }

  await setExternalExtensionsEnabled(db, false);
  const approvedAgain = await storage.approve(externalDraft.id, externalDraft.contentHash);
  assert.equal(approvedAgain?.enabled, true);
  const closedGateRuntime = new PersonalServerExtensionRuntime();
  await closedGateRuntime.start(db);
  assert.equal((await storage.getById(externalDraft.id))?.enabled, false);
  await closedGateRuntime.stop();
} finally {
  await fileDb._fileStore.close();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  if (previousExternalGate === undefined) delete process.env.ENABLE_EXTERNAL_EXTENSIONS;
  else process.env.ENABLE_EXTERNAL_EXTENSIONS = previousExternalGate;
  if (previousSandboxSecret === undefined) delete process.env.MARINARA_EXTENSION_SANDBOX_SECRET;
  else process.env.MARINARA_EXTENSION_SANDBOX_SECRET = previousSandboxSecret;
  rmSync(storageDir, { recursive: true, force: true });
}

// Constrained browser UI capability — assert the security invariants of the
// generated worker/bootstrap source so a regression cannot silently widen the
// sandbox (e.g. reintroduce innerHTML or leak DOM/network to the extension).
{
  const { browserWorkerSource, fullPageExtensionSource, sandboxDocument } =
    await import("../../packages/server/src/routes/personal-extensions.routes.js");
  const uiExtension = {
    id: "ui-demo",
    name: "UI Demo",
    contentHash: "sha256:demo",
    runtime: "client" as const,
    capabilities: ["read_active_characters", "read_active_persona"] as const,
    css: "",
    js: `
      marinara.ui.showWindow({ title: "Bunny", elements: [{ kind: "pre", text: "(\\u2022_\\u2022)" }] });
      marinara.ui.registerContribution({
        id: "weather",
        kind: "panel",
        label: "Weather",
        icon: "sparkles",
        elements: [
          { kind: "select", id: "kind", options: [{ value: "rain", label: "Rain" }] },
          { kind: "toggle", id: "lightning", label: "Lightning" },
          { kind: "slider", id: "intensity", min: 0, max: 100, value: 50 },
          { kind: "color", id: "tint", value: "#6d8cff" },
          { kind: "button", id: "apply", label: "Apply" },
        ],
      });
    `,
    serverJs: null,
    description: "",
    version: null,
    enabled: true,
    approvedHash: "sha256:demo",
    source: "professor_mari" as const,
    revisions: [],
    installedAt: "",
    createdAt: "",
    updatedAt: "",
  };
  const worker = browserWorkerSource(uiExtension);
  assert.match(worker, /version:\s*5/u, "Worker must advertise context-capable API version 5");
  assert.match(worker, /capabilities:\s*Object\.freeze/u, "Worker must expose its approved capabilities");
  assert.match(worker, /context:\s*Object\.freeze\(\{\s*get:/u);
  assert.match(worker, /"context-update"/u, "Worker must receive bounded context snapshots");
  assert.match(worker, /allowedIds\.has\(id\)/u, "Worker must reject Character records outside the active ID set");
  assert.match(worker, /id !== expectedId/u, "Worker must reject Persona records outside the active ID");
  assert.match(worker, /MAX_CONTEXT_TEXT/u, "Worker must bound active-record context");
  assert.match(
    worker,
    /if \(!contextSubscriptions\.has\(subscription\)\) return/u,
    "Worker must cancel queued context callbacks after unsubscribe",
  );
  assert.match(worker, /await initialContextReady/u, "Extension startup must wait for its initial context snapshot");
  assert.match(worker, /ui:\s*Object\.freeze\(\{\s*showWindow,\s*registerContribution/u);
  assert.match(worker, /"ui-show"/u, "Worker must send a ui-show descriptor message");
  assert.match(worker, /"ui-event"/u, "Worker must receive button events via ui-event");
  assert.match(worker, /"ui-contribution-register"/u, "Worker must register declarative host contributions");
  assert.match(worker, /"ui-contribution-activate"/u, "Worker must receive host contribution activation");
  assert.match(worker, /"ui-contribution-event"/u, "Worker must receive host-rendered control events");
  assert.match(worker, /contributionSurfaces/u, "Worker must validate safe contribution surfaces");
  assert.match(worker, /contributionPositions/u, "Worker must validate safe contribution positions");
  assert.doesNotMatch(worker, /\bdocument\b/u, "Worker source must never touch the DOM");

  const surfaceMessages: Array<{ type?: string; contribution?: Record<string, unknown> }> = [];
  let dispatchSurfaceMessage: ((event: { data: unknown }) => void) | undefined;
  const surfaceWorker = browserWorkerSource({
    ...uiExtension,
    id: "surface-demo",
    name: "Surface Demo",
    capabilities: [],
    js: `
      marinara.ui.registerContribution({
        id: "preset-helper",
        kind: "button",
        label: "Preset helper",
        icon: "list-sparkles",
        surface: "presets",
        position: "before-content",
      });
    `,
  });
  runInNewContext(surfaceWorker, {
    self: {
      postMessage: (message: { type?: string; contribution?: Record<string, unknown> }) =>
        surfaceMessages.push(message),
      setTimeout,
      clearTimeout,
      setInterval: () => 0,
      clearInterval: () => undefined,
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === "message") dispatchSurfaceMessage = listener;
      },
      close: () => undefined,
    },
  });
  assert.ok(dispatchSurfaceMessage, "Surface worker must register its host message listener");
  dispatchSurfaceMessage({ data: { type: "context-update", context: { chatId: null, characterIds: [] } } });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const surfaceContribution = surfaceMessages.find(
    (message) => message.type === "ui-contribution-register",
  )?.contribution;
  assert.deepEqual(JSON.parse(JSON.stringify(surfaceContribution)), {
    id: "preset-helper",
    kind: "button",
    label: "Preset helper",
    icon: "list-sparkles",
    surface: "presets",
    position: "before-content",
  });
  dispatchSurfaceMessage({ data: { type: "stop" } });

  const lifecycleMessages: Array<{ type?: string; level?: string; args?: unknown[] }> = [];
  let dispatchLifecycleMessage: ((event: { data: unknown }) => void) | undefined;
  const lifecycleWorker = browserWorkerSource({
    ...uiExtension,
    id: "context-lifecycle",
    name: "Context Lifecycle",
    capabilities: [],
    js: `
      const resubscribeCalls = [];
      const resubscribeListener = (context) => resubscribeCalls.push(context.chatId);
      const unsubscribeFirst = marinara.context.subscribe(resubscribeListener);
      unsubscribeFirst();
      const unsubscribeReplacement = marinara.context.subscribe(resubscribeListener);
      await Promise.resolve();
      unsubscribeReplacement();

      const duplicateCalls = [];
      const duplicateListener = (context) => duplicateCalls.push(context.chatId);
      const unsubscribeDuplicateFirst = marinara.context.subscribe(duplicateListener);
      const unsubscribeDuplicateSecond = marinara.context.subscribe(duplicateListener);
      unsubscribeDuplicateFirst();
      await Promise.resolve();
      unsubscribeDuplicateSecond();

      const updateListener = (context) => marinara.log.info("context-update-delivery", context.chatId);
      marinara.context.subscribe(updateListener);
      await Promise.resolve();

      marinara.log.info(
        "context-subscription-proof",
        resubscribeCalls.length,
        duplicateCalls.length,
      );
    `,
  });
  const lifecycleSelf = {
    postMessage: (message: { type?: string; level?: string; args?: unknown[] }) => lifecycleMessages.push(message),
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => undefined,
    addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
      if (type === "message") dispatchLifecycleMessage = listener;
    },
    close: () => undefined,
  };
  runInNewContext(lifecycleWorker, { self: lifecycleSelf });
  assert.ok(dispatchLifecycleMessage, "Worker must register its host message listener");
  dispatchLifecycleMessage({
    data: {
      type: "context-update",
      context: { chatId: "chat-1", characterIds: ["character-1"] },
    },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const lifecycleProof = lifecycleMessages.find(
    (message) => message.type === "log" && message.args?.[0] === "context-subscription-proof",
  );
  assert.deepEqual(
    Array.from(lifecycleProof?.args ?? []),
    ["context-subscription-proof", 1, 1],
    "Cancelled subscriptions must stay cancelled across re-subscribe and duplicate callback identities",
  );
  dispatchLifecycleMessage({
    data: {
      type: "context-update",
      context: { chatId: "chat-2", characterIds: ["character-1"] },
    },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(
    lifecycleMessages
      .filter((message) => message.type === "log" && message.args?.[0] === "context-update-delivery")
      .map((message) => message.args?.[1]),
    ["chat-1", "chat-2"],
    "Active subscription records must receive initial and changed context exactly once",
  );
  dispatchLifecycleMessage({ data: { type: "stop" } });
  dispatchLifecycleMessage({
    data: {
      type: "context-update",
      context: { chatId: "chat-3", characterIds: ["character-1"] },
    },
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    lifecycleMessages.filter((message) => message.type === "log" && message.args?.[0] === "context-update-delivery")
      .length,
    2,
    "Stopping the worker must cancel every remaining context subscription",
  );

  const doc = sandboxDocument(uiExtension, "test-nonce");
  assert.match(doc, /textContent/u, "Sandbox bootstrap must render window text via textContent");
  assert.doesNotMatch(doc, /innerHTML/u, "Sandbox bootstrap must never assign innerHTML");
  assert.match(doc, /ui-contribution-register/u, "Sandbox must forward declarative contributions to the host");
  assert.match(doc, /message\.type === "context-update"/u, "Sandbox must forward host context to the worker");
  assert.match(
    doc,
    /message\.contentHash === extension\.contentHash/u,
    "Sandbox must bind context updates to the approved extension hash",
  );
  assert.match(doc, /contentHash:\s*extension\.contentHash/u, "Sandbox messages must carry the exact content hash");
  assert.match(doc, /ui-window-open/u, "Sandbox reveals the iframe only through the ui-window-open signal");
  assert.match(doc, /ui-resize/u, "Sandbox reports its content size so the host can fit the floating panel");
  assert.doesNotMatch(
    doc,
    /rgba\(0,\s*0,\s*0,\s*0\.45\)/u,
    "The extension window is a floating panel, not a full-screen backdrop takeover",
  );
  assert.ok(
    doc.includes("new Worker(") && doc.includes("marinara.ui.showWindow"),
    "Extension JS must run in the worker embedded by the bootstrap, not in the document",
  );

  const fullPageExtension = {
    ...uiExtension,
    id: "legacy-page-demo",
    name: "Legacy Page Demo",
    contentHash: "sha256:full-page-demo",
    capabilities: ["full_page_access"] as const,
    source: "external" as const,
    js: `
      document.documentElement.dataset.fullPageProof = marinara.extension.id;
      marinara.onCleanup(() => delete document.documentElement.dataset.fullPageProof);
    `,
  };
  let fullPageMain:
    | ((api: {
        extension: Readonly<{ id: string; name: string; contentHash: string }>;
        onCleanup: (cleanup: () => unknown) => void;
      }) => unknown)
    | undefined;
  const fullPageIdentity: Array<{ id: string; name: string; contentHash: string }> = [];
  const fullPageDocument = { documentElement: { dataset: {} as Record<string, string> } };
  runInNewContext(fullPageExtensionSource(fullPageExtension), {
    document: fullPageDocument,
    window: {
      __marinaraRunFullPageExtension: (
        identity: { id: string; name: string; contentHash: string },
        main: typeof fullPageMain,
      ) => {
        fullPageIdentity.push(identity);
        fullPageMain = main;
      },
    },
  });
  assert.deepEqual(Array.from(fullPageIdentity[0] ? Object.values(fullPageIdentity[0]) : []), [
    "legacy-page-demo",
    "Legacy Page Demo",
    "sha256:full-page-demo",
  ]);
  assert.ok(fullPageMain);
  const fullPageCleanups: Array<() => unknown> = [];
  await fullPageMain({
    extension: Object.freeze(fullPageIdentity[0]!),
    onCleanup: (cleanup) => fullPageCleanups.push(cleanup),
  });
  assert.equal(fullPageDocument.documentElement.dataset.fullPageProof, "legacy-page-demo");
  assert.equal(fullPageCleanups.length, 1);
  fullPageCleanups[0]!();
  assert.equal(fullPageDocument.documentElement.dataset.fullPageProof, undefined);

  const { createPersonalExtensionRecordContext } =
    await import("../../packages/server/src/routes/personal-extensions.routes.js");
  const recordContext = createPersonalExtensionRecordContext({
    capabilities: ["read_active_characters", "read_active_persona"],
    characters: [
      {
        id: "character-1",
        data: {
          name: "Aster",
          description: "x".repeat(40_000),
          personality: "Patient",
          scenario: "A laboratory",
          first_mes: "Welcome",
          mes_example: "Example",
          creator_notes: "private creator notes",
          system_prompt: "private system prompt",
          post_history_instructions: "private post-history instructions",
          tags: ["scientist"],
          creator: "Pasta-Devs",
          character_version: "1.0",
          alternate_greetings: [],
          extensions: {
            talkativeness: 0.5,
            fav: false,
            world: "",
            depth_prompt: { prompt: "", depth: 4, role: "system" },
            backstory: "History",
            appearance: "Blue hair",
            aboutMe: "Researcher",
            convoDisplayName: "Doctor Aster",
          },
          character_book: null,
        },
      },
    ],
    persona: {
      id: "persona-1",
      name: "Mari",
      description: "Engineer",
      personality: "Curious",
      scenario: "A laboratory",
      backstory: "History",
      appearance: "Red hair",
      tags: ["maintainer"],
      aboutMe: "Builds Marinara",
      convoDisplayName: "Mari",
      creatorNotes: "private creator notes",
      avatarPath: "/private/avatar.png",
    },
  });
  assert.equal(recordContext.characters[0]?.description.length, 32_000);
  assert.equal("creator_notes" in recordContext.characters[0]!, false);
  assert.equal("system_prompt" in recordContext.characters[0]!, false);
  assert.equal("post_history_instructions" in recordContext.characters[0]!, false);
  assert.equal("creatorNotes" in recordContext.persona!, false);
  assert.equal("avatarPath" in recordContext.persona!, false);
  assert.deepEqual(
    createPersonalExtensionRecordContext({
      capabilities: [],
      characters: [{ id: "character-1", data: {} as never }],
      persona: null,
    }),
    { characters: [], persona: null },
  );
}

{
  const {
    normalizePersonalExtensionImportEntry,
    personalExtensionEntriesFromJson,
    personalExtensionEntryFromSourceFile,
  } = await import("../../packages/client/src/lib/personal-extension-import.js");
  const [legacyEntry] = personalExtensionEntriesFromJson(
    {
      kind: "marinara.extension",
      version: 1,
      config: { name: "WeatherTweaker", js: "document.querySelector('canvas');" },
    },
    "weatherTweaker.extension.json",
  );
  assert.ok(legacyEntry);
  const legacyDraft = normalizePersonalExtensionImportEntry(legacyEntry, "WeatherTweaker");
  assert.deepEqual(legacyDraft?.capabilities, ["full_page_access"]);

  const [explicitSandboxEntry] = personalExtensionEntriesFromJson(
    {
      kind: "marinara.extension",
      version: 1,
      config: { name: "Safe modern package", capabilities: [], js: "marinara.log.info('safe');" },
    },
    "safe.extension.json",
  );
  assert.ok(explicitSandboxEntry);
  const explicitSandboxDraft = normalizePersonalExtensionImportEntry(explicitSandboxEntry, "Safe");
  assert.deepEqual(explicitSandboxDraft?.capabilities, []);

  for (const [fileName, runtime, sourceField] of [
    ["large-browser.js", "client", "js"],
    ["large-server.server.js", "server", "serverJs"],
  ] as const) {
    const entry = personalExtensionEntryFromSourceFile(fileName, sourceOverOneMiB);
    assert.ok(entry);
    const draft = normalizePersonalExtensionImportEntry(entry, fileName);
    assert.equal(draft?.runtime, runtime);
    assert.equal(draft?.[sourceField], sourceOverOneMiB);
  }
}

{
  const { createPersonalExtensionContextSnapshot, personalExtensionContextKey } =
    await import("../../packages/client/src/lib/personal-extension-context.js");
  const single = createPersonalExtensionContextSnapshot("chat-1", ["character-1", "character-1", "", 42]);
  assert.deepEqual(single, {
    chatId: "chat-1",
    characterId: "character-1",
    characterIds: ["character-1"],
    personaId: null,
    characters: [],
    persona: null,
  });
  assert.equal(Object.isFrozen(single), true);
  assert.equal(Object.isFrozen(single.characterIds), true);

  const personaContext = createPersonalExtensionContextSnapshot("chat-1", ["character-1"], "persona-1");
  assert.equal(personaContext.personaId, "persona-1");
  assert.notEqual(personalExtensionContextKey(single), personalExtensionContextKey(personaContext));

  const group = createPersonalExtensionContextSnapshot("chat-2", ["character-1", "character-2"]);
  assert.equal(group.characterId, null);
  assert.deepEqual(group.characterIds, ["character-1", "character-2"]);

  assert.deepEqual(createPersonalExtensionContextSnapshot(null, ["stale-character"]), {
    chatId: null,
    characterId: null,
    characterIds: [],
    personaId: null,
    characters: [],
    persona: null,
  });

  const bounded = createPersonalExtensionContextSnapshot("chat-3", [
    "x".repeat(257),
    ...Array.from({ length: 300 }, (_, index) => `character-${index}`),
  ]);
  assert.equal(bounded.characterIds.length, 256);
  assert.equal(bounded.characterIds.includes("x".repeat(257)), false);
}

{
  const { normalizePersonalExtensionContribution } =
    await import("../../packages/client/src/lib/personal-extension-contributions.js");
  const normalized = normalizePersonalExtensionContribution({
    id: "weather.panel",
    kind: "panel",
    label: "Weather controls",
    description: "A settings-heavy safe contribution",
    icon: "sparkles",
    html: "<script>unsafe()</script>",
    style: "position:fixed",
    url: "https://example.invalid",
    elements: [
      {
        kind: "select",
        id: "weather",
        value: "rain",
        options: [
          { value: "rain", label: "Rain" },
          { value: "snow", label: "Snow" },
        ],
      },
      { kind: "toggle", id: "lightning", label: "Lightning", checked: true },
      { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 50 },
      { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
      { kind: "button", id: "apply", label: "Apply" },
    ],
  });
  assert.ok(normalized);
  assert.equal("html" in normalized, false);
  assert.equal("style" in normalized, false);
  assert.equal("url" in normalized, false);
  assert.equal(normalized.elements?.length, 5);

  assert.equal(
    normalizePersonalExtensionContribution({
      id: "duplicate-controls",
      kind: "panel",
      label: "Invalid",
      elements: [
        { kind: "input", id: "same" },
        { kind: "button", id: "same", label: "Same" },
      ],
    }),
    null,
  );
  assert.deepEqual(
    normalizePersonalExtensionContribution({
      id: "unknown-icon",
      kind: "button",
      label: "Fallback icon",
      icon: "remote-image-url",
    }),
    {
      id: "unknown-icon",
      kind: "button",
      label: "Fallback icon",
      icon: "remote-image-url",
      surface: "top-bar",
    },
  );
  assert.equal(
    normalizePersonalExtensionContribution({
      id: "unsafe-icon",
      kind: "button",
      label: "Invalid",
      icon: "https://example.invalid/icon.svg",
    }),
    null,
  );
  assert.equal(
    normalizePersonalExtensionContribution({
      id: "foreign-select-value",
      kind: "panel",
      label: "Invalid",
      elements: [
        {
          kind: "select",
          id: "choice",
          value: "not-listed",
          options: [{ value: "listed", label: "Listed" }],
        },
      ],
    }),
    null,
  );
}

console.log("Personal Extension sandbox and policy regression passed.");

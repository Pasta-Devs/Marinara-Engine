// #5725: Professor Mari's Permissions Mode (Auto / Manual / Accept edits /
// Plan / Bypass). Functional checks on the pure pieces plus source pins on the
// enforcement seams.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MARI_PERMISSIONS_MODE,
  isMariPermissionsMode,
  MARI_PERMISSIONS_MODE_LABELS,
  MARI_PERMISSIONS_MODES,
} from "../../packages/shared/src/constants/mari-permissions-mode.js";
import {
  mariPermissionsModePrompt,
  readStoredMariPermissionsMode,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  awaitMariPermissionsModeWrites,
  enqueueMariPermissionsModeWrite,
} from "../../packages/client/src/lib/mari-permissions-write-chain.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── Constants are self-consistent ───────────────────────────────────────────
assert.equal(DEFAULT_MARI_PERMISSIONS_MODE, "auto");
assert.deepEqual([...MARI_PERMISSIONS_MODES], ["auto", "manual", "accept-edits", "plan", "bypass"]);
for (const mode of MARI_PERMISSIONS_MODES) {
  assert.ok(isMariPermissionsMode(mode));
  assert.ok(MARI_PERMISSIONS_MODE_LABELS[mode].label.length > 0);
  assert.ok(MARI_PERMISSIONS_MODE_LABELS[mode].description.length > 0);
}
assert.equal(isMariPermissionsMode("yolo"), false);
assert.equal(isMariPermissionsMode(null), false);

// ── The stored-mode reader tolerates junk, absence, and storage failure ─────
const fakeStorage = (value: string | null, throws = false) => ({
  get: async () => {
    if (throws) throw new Error("storage down");
    return value;
  },
});
assert.equal(await readStoredMariPermissionsMode(fakeStorage("plan")), "plan");
assert.equal(await readStoredMariPermissionsMode(fakeStorage(null)), "auto");
assert.equal(await readStoredMariPermissionsMode(fakeStorage("garbage")), "auto");
assert.equal(await readStoredMariPermissionsMode(fakeStorage(null, true)), "auto");

// ── The prompt renderer: auto is silent; every other mode instructs ─────────
assert.equal(mariPermissionsModePrompt("auto"), null);
for (const mode of ["manual", "plan", "accept-edits", "bypass"] as const) {
  const block = mariPermissionsModePrompt(mode);
  assert.ok(block && block.startsWith("<permissions_mode>") && block.endsWith("</permissions_mode>"), mode);
  assert.match(block, /may further RESTRICT but never loosen/u, `${mode}: memory precedence rule`);
}
assert.match(mariPermissionsModePrompt("plan") ?? "", /refused by the server/u);
assert.match(mariPermissionsModePrompt("accept-edits") ?? "", /Every applied change shows the user a change card with Undo/u);
assert.match(
  mariPermissionsModePrompt("bypass") ?? "",
  /Sensitive file changes and dependency installs still require/u,
);

// ── Enforcement seams (source pins) ─────────────────────────────────────────
const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");
// Mode read fresh per run and per status call - never latched at construction.
assert.match(
  workspaceAgent,
  /const \{ mode: permissionsMode \} = await this\.resolvePermissionsMode\(args\.chatId\);/u,
);
assert.match(workspaceAgent, /permissionsMode: resolved\.mode,/u);
assert.doesNotMatch(
  workspaceAgent,
  /activeRunPermissionsMode\s*=\s*await/u,
  "the transient run field must be assigned from the per-run read, synchronously",
);
// Plan mode is a hard server-side floor in the executor, dry-runs allowed.
assert.match(
  workspaceAgent,
  /activeRunPermissionsMode === "plan" && isMutatingWorkspaceCommand\(command\)/u,
  "plan mode must refuse mutating commands in the executor, not just in the prompt",
);
// Manual forces the deferral; Bypass suppresses it. The run loop reads the
// run's LOCAL mode so an overlapping prompt() cannot change decisions
// mid-flight (the executor's instance-field reads sit behind signal checks).
assert.match(workspaceAgent, /permissionsMode !== "bypass" &&/u);
// Plan never defers - accepting a deferral would be a dead end (the next Plan
// run refuses the commands); the executor floor's refusal drives the plan.
assert.match(workspaceAgent, /permissionsMode !== "plan" &&/u);
assert.match(workspaceAgent, /permissionsMode === "manual" \|\|/u);
// Manual is also a FLOOR: silent (empty-say) mutating frames execute only in
// a run that began right after an approved deferral; otherwise the executor
// refuses them with describe-and-ask guidance.
// The arming flag is a PERSISTED message-extra flag - the stored content is
// only the visible say text, so a content scan can never see the deferral
// (CodeRabbit round 1: the substring check never armed, deadlocking Manual).
assert.match(
  workspaceAgent,
  /const manualApprovalArmed = parseExtra\(lastAssistant\?\.extra\)\.mariDeferredMutations === true;/u,
);
assert.match(workspaceAgent, /if \(runEndedWithDeferral\) extraUpdate\.mariDeferredMutations = true;/u);
// The deferral marker is retryable: the row is retained across a failed extra
// write and the persisted flag flips only after the extras land.
assert.match(workspaceAgent, /persistedAssistantMessage \?\?/u);
const persistIdx = workspaceAgent.indexOf("persistedAssistantMessage ??");
const persistedFlagIdx = workspaceAgent.indexOf("assistantMessagePersisted = true;", persistIdx);
const extraWriteIdx = workspaceAgent.indexOf("updateMessageExtra(message.id, extraUpdate)", persistIdx);
assert.ok(
  extraWriteIdx > 0 && persistedFlagIdx > extraWriteIdx,
  "assistantMessagePersisted must flip only after the extra writes land",
);
assert.match(workspaceAgent, /runEndedWithDeferral = true;/u);
assert.match(workspaceAgent, /activeRoundManualSilentMutationBlocked && isMutatingWorkspaceCommand\(command\)/u);
// Slice 87: every applied change keeps a restore copy in every mode, so no review-policy gate
// remains (the old auto-keep carve-outs for deletes, extensions and chat.updateMessage are gone).
assert.doesNotMatch(workspaceAgent, /autoKeep|reviewPolicy|auto-keep/u);

// Per-chat override (#5725 maintainer call): the run resolves chat override
// ?? global default; status is chat-aware; the override is read from chat
// metadata with junk tolerated.
assert.match(workspaceAgent, /resolvePermissionsMode\(args\.chatId\)/u);
assert.match(workspaceAgent, /async status\(connectionId\?: string \| null, chatId\?: string \| null\)/u);
assert.match(workspaceAgent, /const override = metadata\?\.mariPermissionsMode;/u);
assert.match(
  workspaceAgent,
  /if \(isMariPermissionsMode\(override\)\) return \{ mode: override, defaultMode, source: "chat" \};/u,
);

// The mode block is spliced AFTER the memories block.
const instructionsIdx = workspaceAgent.indexOf("if (instructionsPrompt) messages.push");
const modeBlockIdx = workspaceAgent.indexOf(
  "const permissionsModePrompt = mariPermissionsModePrompt(permissionsMode);",
);
assert.ok(instructionsIdx > 0 && modeBlockIdx > instructionsIdx, "mode guidance must come after saved memories");

const mariDb = readSource("packages/server/src/services/mari-db/mari-db.service.ts");
// Slice 87: the executor has no review policy; every applied change gets its undo record.
assert.doesNotMatch(mariDb, /activeReviewPolicy|reviewPolicy|auto-keep/u);
// Mari can never rewrite her own mode row - a change-level planMutation floor
// blocks every raw-db path (insert/patch/replace/delete/transform).
assert.match(mariDb, /change\.table === "app_settings" && change\.id === MARI_PERMISSIONS_MODE_SETTINGS_KEY/u);
assert.match(mariDb, /can only be changed by the user/u);
// ...and the same floor covers the per-chat override in chat metadata (a
// whole-chat delete stays allowed - it removes the override legitimately).
assert.match(mariDb, /change\.table !== "chats" \|\| !change\.afterRaw/u);
assert.match(
  mariDb,
  /chatModeMetadataValue\(change\.afterRaw\.metadata\) !== chatModeMetadataValue\(change\.beforeRaw\?\.metadata\)/u,
);

const routes = readSource("packages/server/src/routes/professor-mari-workspace.routes.ts");
assert.match(
  routes,
  /z\.enum\(MARI_PERMISSIONS_MODES\)\.nullable\(\)/u,
  "the PUT must validate against the shared enum (nullable clears a chat override)",
);
// The per-chat override write goes through the queued metadata patch (#5076),
// and clearing the GLOBAL default is refused.
assert.match(routes, /patchMetadata\(input\.chatId, \{[\s\S]{0,40}mariPermissionsMode: input\.mode,/u);
assert.match(routes, /The global default mode cannot be cleared/u);
assert.match(routes, /status\(req\.query\.connectionId \?\? null, req\.query\.chatId \?\? null\)/u);
assert.match(routes, /app\.get\("\/permissions-mode"/u);
assert.match(routes, /app\.put\("\/permissions-mode"/u);
assert.doesNotMatch(
  routes.slice(routes.indexOf('app.put("/permissions-mode"'), routes.indexOf('app.put("/permissions-mode"') + 600),
  /reset\(\)/u,
  "a mode switch must not abort an in-flight Mari turn",
);
// The setting is NOT writable through the generic app-settings passthrough.
const appSettingsRoutes = readSource("packages/server/src/routes/app-settings.routes.ts");
assert.doesNotMatch(appSettingsRoutes, /mari-permissions-mode/u);

// ── Localization: every mode label/description is an en.json VALUE so the
// reverse-lookup bridge (useLocalizedUiText) can translate what the shared
// constants carry; both render sites go through localize().
const enJson = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
const enValues = new Set(Object.values(enJson));
for (const mode of MARI_PERMISSIONS_MODES) {
  assert.ok(enValues.has(MARI_PERMISSIONS_MODE_LABELS[mode].label), `en.json must carry the ${mode} label as a value`);
  assert.ok(
    enValues.has(MARI_PERMISSIONS_MODE_LABELS[mode].description),
    `en.json must carry the ${mode} description as a value`,
  );
}

// ── Client surfaces exist ───────────────────────────────────────────────────
const mariChat = readSource("packages/client/src/components/chat/HomeProfessorMariChat.tsx");
// Slice 82: the mode menu lives in the composer, the run's write barrier in the run hook.
const mariChatDir = "packages/client/src/components/chat/mari";
const mariChatAll = [
  mariChat,
  ...readdirSync(join(repositoryRoot, mariChatDir)).map((name) => readSource(`${mariChatDir}/${name}`)),
].join("\n");
const mariComposer = readSource(`${mariChatDir}/MariComposer.tsx`);
const mariRun = readSource(`${mariChatDir}/use-mari-workspace-run.ts`);
assert.match(mariChat, /changePermissionsMode/u);
assert.match(mariChat, /workspaceStatus\?\.permissionsMode \?\? DEFAULT_MARI_PERMISSIONS_MODE/u);
// The picker is per-chat: status polls carry the chat id, the menu has a
// use-default row, and writes name the chat.
assert.match(mariChat, /params\.set\("chatId", chatIdAtStart\)/u);
// A chat switch refetches the chat-scoped status immediately (the 15s poll
// alone left the shield on the previous chat's mode), and mode clicks are
// never short-circuited on possibly-stale check state.
assert.match(mariChat, /\}, \[chatId, refreshWorkspaceStatus\]\);/u);
assert.match(mariChat, /No same-value short-circuits/u);
assert.doesNotMatch(mariChatAll, /mode === null && !permissionsModeOverridden\) return;/u);
assert.match(mariComposer, /changePermissionsMode\(null\)/u);
assert.match(mariChat, /\{ mode, chatId: chatIdForMode \}/u);
assert.match(mariChat, /permissionsModeSource === "chat"/u);
assert.match(mariComposer, /localize\(MARI_PERMISSIONS_MODE_LABELS\[permissionsMode\]\.label\)/u);
// After a successful PUT the panel refetches - an in-flight poll must not
// clobber the optimistic patch permanently.
assert.match(
  mariChat,
  /await api\.put\("\/professor-mari\/workspace\/permissions-mode", \{ mode, chatId: chatIdForMode \}\);[\s\S]{0,500}refreshWorkspaceStatus\(/u,
);
// Mode writes are sequenced: stale failures never roll back newer selections,
// polls that predate the latest write keep the current mode fields, and the
// post-PUT refetch is guarded on both the chat and the write sequence.
assert.match(mariChat, /const writeSeq = \+\+permissionsModeWriteSeqRef\.current;/u);
// Pending mode writes hold the polled mode fields AND serialize the next run.
assert.match(mariChat, /permissionsModeWritePendingChatRef\.current === chatIdAtStart/u);
// Writes are CHAINED on the ONE shared coordinator (click order = persist
// order) covering BOTH surfaces, and runs await the whole chain - a Settings
// default change can never race a prompt on an un-overridden chat.
assert.match(mariChat, /const write = enqueueMariPermissionsModeWrite\(/u);
assert.match(mariRun, /await awaitMariPermissionsModeWrites\(\);/u);
const writeChainLib = readSource("packages/client/src/lib/mari-permissions-write-chain.ts");
assert.match(writeChainLib, /export function enqueueMariPermissionsModeWrite/u);
assert.match(writeChainLib, /export function awaitMariPermissionsModeWrites/u);
// Anchored: the chain advances through BOTH handlers, so a rejection can
// never poison it for later writes.
assert.match(writeChainLib, /chain = link\.then\(\s*\(\) => undefined,\s*\(\) => undefined,\s*\);/u);

// ── Runtime contract of the shared write coordinator ────────────────────────
// Ordering, rejection isolation, caller-visible rejection, and run-waiting.
{
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const order: string[] = [];
  const gateA = deferred();
  const writeA = enqueueMariPermissionsModeWrite(async () => {
    await gateA.promise;
    order.push("a");
  });
  const writeB = enqueueMariPermissionsModeWrite(async () => {
    order.push("b");
    throw new Error("write b failed");
  });
  const writeC = enqueueMariPermissionsModeWrite(async () => {
    order.push("c");
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(order, [], "later writes must not start before an earlier write settles");
  gateA.resolve();
  await writeA;
  await assert.rejects(writeB, /write b failed/u, "a caller sees its own write's rejection");
  await writeC;
  assert.deepEqual(order, ["a", "b", "c"], "writes run strictly in enqueue order");
  await awaitMariPermissionsModeWrites(); // must settle despite b's rejection

  // Run-waiting: an awaiter enqueued while a write is pending resolves only
  // after that write settles.
  const gateD = deferred();
  void enqueueMariPermissionsModeWrite(() => gateD.promise).catch(() => undefined);
  let chainSettled = false;
  const waiter = awaitMariPermissionsModeWrites().then(() => {
    chainSettled = true;
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(chainSettled, false, "a run must wait while a mode write is pending");
  gateD.resolve();
  await waiter;
  assert.equal(chainSettled, true);
}
// The latest failed write refetches authoritative status - it never restores
// a rendered snapshot (which can be optimistic or another chat's).
assert.doesNotMatch(mariChatAll, /previous \? previous : current/u);
assert.match(mariChat, /if \(permissionsModeWriteSeqRef\.current !== writeSeq\) return;/u);
assert.match(mariChat, /permissionsModeWriteSeqRef\.current !== writeSeqAtStart/u);
assert.match(
  mariChat,
  /activeChatIdRef\.current === chatIdForMode && permissionsModeWriteSeqRef\.current === writeSeq/u,
);
// Slice 57 moved the Settings select into the omnibar settings view (PermissionsModeRow). That view
// mounts fresh on every open, so one read on mount replaces the old visibilitychange refetch.
const settingControlsSeq = readSource("packages/client/src/components/layout/omnibar/OmnibarSettingsMenu.tsx");
assert.match(settingControlsSeq, /await enqueueMariPermissionsModeWrite\(\(\) =>/u);
assert.match(settingControlsSeq, /const writeSeq = \+\+writeSeqRef\.current;/u);
assert.match(settingControlsSeq, /writeSeqRef\.current === seqAtStart/u);
assert.match(settingControlsSeq, /<label htmlFor=\{selectId\}/u);
assert.match(settingControlsSeq, /function PermissionsModeRow\(/u);
assert.match(settingControlsSeq, /localize\(MARI_PERMISSIONS_MODE_LABELS\[value\]\.label\)/u);

// An editing-tooling incident once wrote a literal U+0008 into a regex in
// these sources (valid JS, silently broken behavior) - ban the class.
for (const [name, source] of [
  ["workspace-agent", workspaceAgent],
  ["mari-db", mariDb],
  ["routes", routes],
  ["mariChat", mariChat],
  ["settingControls", settingControlsSeq],
] as const) {
  const control = [...source].find((ch) => ch.charCodeAt(0) < 32 && ch !== "\n" && ch !== "\r" && ch !== "\t");
  assert.equal(control, undefined, `${name} must not contain raw control characters`);
}

console.log("Mari permissions-mode regression passed.");

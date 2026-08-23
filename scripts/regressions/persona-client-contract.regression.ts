// Persona client contract regression: decoded writer boundaries and executable
// editor/navigation transitions. Runtime UI lifecycles remain browser-proof work.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { Persona } from "@marinara-engine/shared";
import { ApiError, formatFirstApiValidationIssue } from "../../packages/client/src/lib/api-client.js";
import { personaCacheKeys, syncCachedPersona } from "../../packages/client/src/lib/persona-cache.js";
import {
  mergeAuthoritativePersonaEditorDraft,
  personaEditorFieldsDifferingFromBaseline,
  personaEditorValuesEqual,
  pickPersonaEditorFields,
  reconcileVersionedPersonaEditorSave,
} from "../../packages/client/src/components/personas/persona-editor-transitions.js";
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const clientRoot = join(repoRoot, "packages/client");
const clientRequire = createRequire(join(clientRoot, "package.json"));
const { QueryClient, QueryObserver } = clientRequire("@tanstack/react-query");
const structuredFields = [
  "tags",
  "personaTags",
  "newTags",
  "trackerCardColors",
  "personaStats",
  "savedStatusOptions",
  "avatarCrop",
  "convoBehavior",
] as const;

function source(path: string) {
  return readFileSync(join(repoRoot, "packages/client/src", path), "utf8");
}

function balanced(sourceText: string, marker: string, label: string, bodyAnchor = ""): string {
  const start = sourceText.indexOf(marker);
  assert.notEqual(start, -1, `${label}: missing ${marker}`);
  const bodyStart = bodyAnchor ? sourceText.indexOf(bodyAnchor, start) : start;
  assert.notEqual(bodyStart, -1, `${label}: missing body anchor ${bodyAnchor}`);
  let depth = 0;
  let opened = false;
  for (let index = bodyStart; index < sourceText.length; index += 1) {
    if (sourceText[index] === "{") {
      depth += 1;
      opened = true;
    } else if (sourceText[index] === "}" && --depth === 0 && opened) {
      return sourceText.slice(start, index + 1);
    }
  }
  assert.fail(`${label}: unbalanced block`);
}

function between(sourceText: string, startMarker: string, endMarker: string, label: string) {
  const start = sourceText.indexOf(startMarker);
  const end = sourceText.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${label}: missing start`);
  assert.notEqual(end, -1, `${label}: missing end`);
  return sourceText.slice(start, end + endMarker.length);
}

function assertDecoded(scope: string, label: string) {
  for (const field of structuredFields) {
    assert.doesNotMatch(scope, new RegExp(`JSON\\.stringify\\(\\s*${field}\\b|${field}:\\s*JSON\\.stringify\\(`, "u"), label);
  }
  assert.doesNotMatch(scope, /serializeTrackerCardColorConfig\(/u, label);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function persona(id: string, name: string, isActive: boolean): Persona {
  return { id, name, isActive } as Persona;
}

async function assertAuthoritativePersonaCacheOrdering() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const stale = persona("a", "stale GET", true);
  const authoritative = persona("a", "authoritative write", true);
  const other = persona("b", "other", false);
  qc.setQueryData(personaCacheKeys.list, [stale, other, stale]);
  qc.setQueryData(personaCacheKeys.detail(stale.id), stale);
  qc.setQueryData(personaCacheKeys.active(), stale);

  const oldList = deferred<Persona[]>();
  const oldDetail = deferred<Persona>();
  const oldActive = deferred<Persona | null>();
  const pendingReads = [
    qc.fetchQuery({ queryKey: personaCacheKeys.list, queryFn: () => oldList.promise }).catch(() => undefined),
    qc.fetchQuery({ queryKey: personaCacheKeys.detail(stale.id), queryFn: () => oldDetail.promise }).catch(() => undefined),
    qc.fetchQuery({ queryKey: personaCacheKeys.active(), queryFn: () => oldActive.promise }).catch(() => undefined),
  ];
  const cancellationGate = deferred<void>();
  const cancelQueries = qc.cancelQueries.bind(qc);
  qc.cancelQueries = async (options: { queryKey: readonly unknown[]; exact: boolean }) => {
    await cancellationGate.promise;
    return cancelQueries(options);
  };

  const reconciliation = syncCachedPersona(qc, authoritative);
  oldList.resolve([stale, other]);
  oldDetail.resolve(stale);
  oldActive.resolve(stale);
  await Promise.all(pendingReads);
  cancellationGate.resolve();
  await reconciliation;

  assert.deepEqual(qc.getQueryData(personaCacheKeys.list), [authoritative, other]);
  assert.deepEqual(qc.getQueryData(personaCacheKeys.detail(stale.id)), authoritative);
  assert.deepEqual(qc.getQueryData(personaCacheKeys.active()), authoritative);

  const concurrentC = persona("c", "concurrent C", false);
  const concurrentD = persona("d", "concurrent D", false);
  await Promise.all([syncCachedPersona(qc, concurrentC), syncCachedPersona(qc, concurrentD)]);
  assert.deepEqual((qc.getQueryData(personaCacheKeys.list) as Persona[]).map((row) => row.id).sort(), ["a", "b", "c", "d"]);
  qc.clear();
}

async function assertUnknownPersonaQueriesSettle() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const writtenA = persona("a", "authoritative write", false);
  const listedA = persona("a", "server list after write", false);
  const activeB = persona("b", "server active", true);
  const oldList = deferred<Persona[]>();
  const oldActive = deferred<Persona | null>();
  let listCalls = 0;
  let activeCalls = 0;
  const listObserver = new QueryObserver(qc, {
    queryKey: personaCacheKeys.list,
    queryFn: () => (++listCalls === 1 ? oldList.promise : Promise.resolve([listedA, activeB])),
    retry: false,
  });
  const activeObserver = new QueryObserver(qc, {
    queryKey: personaCacheKeys.active(),
    queryFn: () => (++activeCalls === 1 ? oldActive.promise : Promise.resolve(activeB)),
    retry: false,
  });
  const unsubscribeList = listObserver.subscribe(() => undefined);
  const unsubscribeActive = activeObserver.subscribe(() => undefined);

  await syncCachedPersona(qc, writtenA);
  oldList.resolve([persona("a", "stale list", false)]);
  oldActive.resolve(null);
  await Promise.resolve();

  assert.equal(listCalls, 2, "a cancelled first-load complete list must refetch");
  assert.equal(activeCalls, 2, "a cancelled unknown active query must refetch");
  assert.deepEqual(qc.getQueryData(personaCacheKeys.list), [listedA, activeB]);
  assert.deepEqual(qc.getQueryData(personaCacheKeys.detail(writtenA.id)), writtenA, "detail remains seeded");
  assert.deepEqual(qc.getQueryData(personaCacheKeys.active()), activeB);
  assert.equal(qc.getQueryState(personaCacheKeys.list)?.status, "success");
  assert.equal(qc.getQueryState(personaCacheKeys.list)?.fetchStatus, "idle");
  assert.equal(qc.getQueryState(personaCacheKeys.active())?.status, "success");
  assert.equal(qc.getQueryState(personaCacheKeys.active())?.fetchStatus, "idle");
  unsubscribeList();
  unsubscribeActive();
  qc.clear();
}

async function assertInactiveCachedPersonaRefetchesActiveIdentity() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cachedA = persona("a", "cached active", true);
  const writtenA = persona("a", "authoritative inactive write", false);
  const activeB = persona("b", "server active", true);
  qc.setQueryData(personaCacheKeys.list, [cachedA, activeB]);
  qc.setQueryData(personaCacheKeys.active(), cachedA);

  const observedActiveValues: Array<Persona | null | undefined> = [];
  const oldActive = deferred<Persona | null>();
  let activeCalls = 0;
  const activeObserver = new QueryObserver(qc, {
    queryKey: personaCacheKeys.active(),
    queryFn: () => (++activeCalls === 1 ? oldActive.promise : Promise.resolve(activeB)),
    retry: false,
  });
  const unsubscribeObserver = activeObserver.subscribe((result: { data: Persona | null | undefined }) => {
    observedActiveValues.push(result.data);
  });

  await syncCachedPersona(qc, writtenA);
  oldActive.resolve(cachedA);
  await Promise.resolve();
  unsubscribeObserver();

  assert.equal(activeCalls, 2, "inactive cached A must refetch the server-owned active identity");
  assert.deepEqual(qc.getQueryData(personaCacheKeys.active()), activeB);
  assert.ok(!observedActiveValues.includes(null), "inactive A must never publish a fresh null active state");
  qc.clear();
}

function assertMutationTypesCompile() {
  const ts = clientRequire("typescript") as typeof import("typescript");
  const configPath = join(clientRoot, "tsconfig.json");
  const fixturePath = join(clientRoot, ".regression-fixtures", "persona-mutation-types.ts");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, "client tsconfig must load");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, clientRoot, undefined, configPath);
  const program = ts.createProgram({
    rootNames: [fixturePath],
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => "\n",
  }));
}

// Formatter: nested field paths, malformed issue fallback, ordinary errors.
const issue = (issues: unknown) => new ApiError(400, "Invalid request", { issues });
assert.equal(formatFirstApiValidationIssue(issue([{ path: ["personaStats", "hp"], message: "Too high" }]), "fallback"), "personaStats.hp: Too high");
assert.equal(formatFirstApiValidationIssue(issue([null, { path: ["name"], message: "  Required  " }]), "fallback"), "name: Required");
assert.equal(formatFirstApiValidationIssue(new Error("Network unavailable"), "fallback"), "Network unavailable");

// Every changed first-party create/PATCH scope keeps structured values decoded.
const editor = source("components/personas/PersonaEditor.tsx");
const characterEditor = source("components/characters/CharacterEditor.tsx");
const panel = source("components/panels/PersonasPanel.tsx");
const importer = source("components/modals/ImportPersonaModal.tsx");
const botBrowser = source("components/bot-browser/BotBrowserView.tsx");
const trackerSettings = source("components/panels/settings/TrackerCardColorSettings.tsx");
const portraitSave = source("features/tracker-panel/hooks/use-persona-portrait-save.ts");
const hooks = source("hooks/use-characters.ts");
const saveScope = balanced(editor, "const handleSave = useCallback(", "Persona save", "=> {");
const conversion = between(characterEditor, "const rpgStats = formData.extensions.rpgStats", "})) as { id?: string };", "character conversion");
assert.match(conversion, /tags: formData\.tags \?\? \[\]/u);
assert.match(conversion, /trackerCardColors: parseTrackerCardColorConfig\(/u);
assert.match(conversion, /personaStats,/u);
assert.match(panel, /updatePersona\.mutateAsync\(\{ id: p\.id, tags: newTags \}\)/u);
const importScope = between(importer, 'await api.post<{ id: string; name: string }>("/characters/personas", {', "});", "JSON import");
assertDecoded(importScope, "JSON import serializes a structured field");
assert.match(importScope, /\.\.\.json,/u);
const botScope = between(botBrowser, "creatorNotes: optionalString(cardData.creator_notes)", "}),", "Bot Browser import");
assertDecoded(botScope, "Bot Browser import serializes a structured field");
assert.match(botScope, /tags: personaTags,/u);

// Structural sentries where the browser/runtime owner is not importable here.
const genericHook = balanced(hooks, "export function useUpdatePersona()", "generic update");
const trackerHook = balanced(hooks, "export function useUpdatePersonaTrackerCard()", "tracker update");
assert.equal(hooks.match(/await syncCachedPersona\(qc, /gu)?.length, 5, "every retained authoritative write must await cache ordering");
assert.match(genericHook, /api\.patch<Persona>\(\s*`\/characters\/personas\/\$\{id\}`/u);
assert.match(genericHook, /syncCachedPersona\(qc, updatedPersona\)/u);
assert.match(genericHook, /invalidatePersonaVersions/u);
assert.match(genericHook, /invalidatePersonaPages\(qc\)/u);
assert.match(trackerHook, /\/tracker-card-colors`/u);
assert.match(trackerHook, /paint: cleanTrackerCardPaintConfig\(data\.trackerCardPaint\)/u);
assert.match(trackerHook, /portrait: data\.trackerCardPortrait/u);
assert.match(trackerHook, /syncCachedPersona\(qc, updatedPersona\)/u);
assert.match(trackerHook, /invalidatePersonaPages\(qc\)/u);
assert.doesNotMatch(trackerHook, /invalidatePersonaVersions|personaVersions/u);
assert.match(trackerSettings, /useUpdatePersonaTrackerCard\(\)[\s\S]*trackerCardPaint: config/u);
assert.match(portraitSave, /useUpdatePersonaTrackerCard\(\)[\s\S]*keepalive: true,[\s\S]*trackerCardPortrait:/u);
assert.match(hooks, /api\.post<Persona>\(`\/characters\/personas\/\$\{id\}\/avatar`/u);
assert.match(hooks, /api\.post<Persona>\(`\/characters\/personas\/\$\{personaId\}\/gallery\/\$\{imageId\}\/avatar`\)/u);
assertMutationTypesCompile();
await assertAuthoritativePersonaCacheOrdering();
await assertUnknownPersonaQueriesSettle();
await assertInactiveCachedPersonaRefetchesActiveIdentity();

// Sparse save and response precedence execute the production transition helpers.
type Form = { name: string; comment: string; structured: { alpha: number; beta: number } };
const baseline: Form = { name: "A", comment: "old", structured: { alpha: 1, beta: 2 } };
let sameReferenceSerializationCount = 0;
const sameReference = {
  toJSON() {
    sameReferenceSerializationCount += 1;
    return { alpha: 1 };
  },
};
assert.equal(personaEditorValuesEqual(sameReference, sameReference), true);
assert.equal(sameReferenceSerializationCount, 0, "identical values avoid stable serialization");
assert.equal(personaEditorValuesEqual(Number.NaN, Number.NaN), true, "NaN preserves stable-key fallback equality");
assert.equal(personaEditorValuesEqual(undefined, undefined), true, "undefined preserves stable-key fallback equality");
assert.equal(personaEditorValuesEqual(() => undefined, () => undefined), true, "functions preserve stable-key fallback equality");
assert.equal(
  personaEditorValuesEqual({ beta: 2, alpha: 1 }, { alpha: 1, beta: 2 }),
  true,
  "distinct objects retain stable-key comparison",
);
assert.deepEqual(personaEditorFieldsDifferingFromBaseline({ ...baseline, structured: { beta: 2, alpha: 1 } }, baseline), []);
const changed = { ...baseline, name: "B" };
const keys = personaEditorFieldsDifferingFromBaseline(changed, baseline);
assert.deepEqual(keys, ["name"]);
assert.deepEqual(pickPersonaEditorFields(changed, keys), { name: "B" });
assert.deepEqual(personaEditorFieldsDifferingFromBaseline({ ...changed, name: "A" }, baseline), [], "reverted fields omit from PATCH");
const authoritative = { ...baseline, name: "Canonical B", comment: "server comment" };
const submitted = new Map<keyof Form, number>([["name", 1]]);
const adoptedDraft = reconcileVersionedPersonaEditorSave({
  draft: { ...baseline, name: "  b  " }, baseline, authoritative, submittedVersions: submitted,
  currentVersions: new Map<keyof Form, number>([["name", 1]]),
});
assert.equal(adoptedDraft.name, "Canonical B");
assert.equal(adoptedDraft.comment, "server comment", "untouched fields adopt authority");
assert.deepEqual(personaEditorFieldsDifferingFromBaseline(adoptedDraft, authoritative), []);
const secondAuthority = { ...authoritative, name: "Canonical second" };
const laterEditDraft = reconcileVersionedPersonaEditorSave({
  draft: { ...adoptedDraft, name: "C" }, baseline: authoritative, authoritative: secondAuthority,
  submittedVersions: new Map<keyof Form, number>([["name", 2]]),
  currentVersions: new Map<keyof Form, number>([["name", 3]]),
});
assert.equal(laterEditDraft.name, "C", "newer edit after canonical adoption survives response");
assert.deepEqual(personaEditorFieldsDifferingFromBaseline(laterEditDraft, secondAuthority), ["name"]);
const revertAuthority = { ...baseline, name: "B" };
const laterRevertDraft = reconcileVersionedPersonaEditorSave({
  draft: baseline, baseline, authoritative: revertAuthority, submittedVersions: submitted,
  currentVersions: new Map<keyof Form, number>([["name", 2]]),
});
assert.equal(laterRevertDraft.name, "A");
assert.equal(revertAuthority.name, "B");
const hydrated = mergeAuthoritativePersonaEditorDraft(
  { ...baseline, name: "local" }, baseline, { ...baseline, name: "external", comment: "external" },
);
assert.equal(hydrated.name, "local");
assert.equal(hydrated.comment, "external", "authoritative untouched fields merge into the draft");

// The immediate mutex and Delete paths remain source-level browser-proof gaps.
const mutationScope = balanced(editor, "const beginMutation = useCallback(", "immediate mutex", "=> {");
const finishMutationScope = balanced(editor, "const finishMutation = useCallback(", "mutex release", "=> {");
const hydrationScope = between(editor, "// Hydrate the form from the shared decoded persona.", "// Forced teardown", "Persona hydration");
const teardownScope = between(editor, "// Forced teardown", "const updateField = useCallback(", "Persona teardown");
assert.match(editor, /const mutationKindRef = useRef<PersonaMutationKind \| null>\(null\);/u);
assert.match(mutationScope, /if \(mutationTokenRef\.current\) return null;/u);
assert.match(mutationScope, /mutationTokenRef\.current = token;\s*mutationKindRef\.current = kind;\s*setMutationKind\(kind\);/u);
assert.match(finishMutationScope, /if \(mutationTokenRef\.current !== token\) return;/u);
assert.match(finishMutationScope, /mutationTokenRef\.current = null;\s*mutationKindRef\.current = null;\s*setMutationKind\(null\);/u);
assert.match(hydrationScope, /mutationTokenRef\.current = null;\s*mutationKindRef\.current = null;\s*setMutationKind\(null\);/u);
assert.match(
  hydrationScope,
  /const avatarOperationActive = mutationKindRef\.current === "avatar" \|\| mutationKindRef\.current === "gallery-avatar";/u,
);
assert.match(teardownScope, /mutationTokenRef\.current = null;\s*mutationKindRef\.current = null;/u);
for (const kind of ["save", "avatar", "gallery-avatar", "delete"]) assert.ok(editor.includes(`beginMutation("${kind}")`));
const deleteScope = balanced(editor, "const handleDelete = async () =>", "Delete");
const deleteSuccessScope = between(deleteScope, "try {", "} finally {", "Delete success");
const deleteFailureScope = between(deleteScope, "} catch (error) {", "} finally {", "Delete failure");
const deleteFinallyStart = deleteScope.indexOf("} finally {");
assert.notEqual(deleteFinallyStart, -1, "Delete cleanup must exist");
const deleteFinallyScope = deleteScope.slice(deleteFinallyStart);
const deleteIdCapture = deleteScope.indexOf("const deletedPersonaId = personaId;");
const deleteSessionCapture = deleteScope.indexOf("const session = editorSessionRef.current;");
const deleteConfirmation = deleteScope.indexOf("await showConfirmDialog(");
const deleteRevalidation = deleteScope.indexOf(
  "if (!isCurrentEditorSession(session) || loadedPersonaIdRef.current !== deletedPersonaId) return;",
);
const deleteMutex = deleteScope.indexOf('const deleteToken = beginMutation("delete");');
const deleteRequest = deleteScope.indexOf("await deletePersona.mutateAsync(deletedPersonaId);");
assert.ok(
  deleteIdCapture > deleteScope.indexOf("if (!personaId) return;") &&
    deleteSessionCapture > deleteIdCapture &&
    deleteSessionCapture < deleteConfirmation &&
    deleteConfirmation < deleteRevalidation &&
    deleteRevalidation < deleteMutex &&
    deleteMutex < deleteRequest,
  "Delete confirmation must capture then revalidate its Persona/session owner before mutex acquisition and request",
);
assert.match(deleteScope, /if \(!deleteToken\) return;/u);
assert.match(
  deleteSuccessScope,
  /if \(isCurrentEditorSession\(session\) && loadedPersonaIdRef\.current === deletedPersonaId\) closeDetail\(\);/u,
);
assert.doesNotMatch(deleteFinallyScope, /closeDetail\(\)/u);
assert.match(deleteFinallyScope, /finishMutation\(deleteToken\);/u);
assert.match(
  deleteFailureScope,
  /if \(!isCurrentEditorSession\(session\) \|\| loadedPersonaIdRef\.current !== deletedPersonaId\) return;/u,
);
assert.match(deleteFailureScope, /console\.error\("\[PersonaEditor\] Delete failed:", error\);/u);
assert.match(
  deleteFailureScope,
  /toast\.error\(\s*formatFirstApiValidationIssue\(error, localizeUi\("ui\.personas\.personaeditor\.failedToDeletePersona"\)\),?\s*\);/u,
);
assert.doesNotMatch(deleteFailureScope, /closeDetail\(\)/u);

// Local Back reads immediate state: writes silently block it, clean drafts close,
// and value-dirty drafts require the existing disposition.
const closeScope = balanced(editor, "const handleClose = useCallback(", "local Back", "=> {");
assert.match(closeScope, /if \(mutationTokenRef\.current\) return;/u);
assert.match(closeScope, /const draft = formDataRef\.current;/u);
assert.match(closeScope, /const baseline = baselineFormRef\.current;/u);
assert.match(closeScope, /personaFieldsDifferingFromBaseline\(draft, baseline\)\.length > 0/u);
const discardScope = balanced(editor, "const discardAndNavigate = useCallback(", "Discard & Close", "=> {");
assert.match(discardScope, /if \(mutationTokenRef\.current\) return;/u);
assert.doesNotMatch(between(saveScope, "} catch (error) {", "} finally {", "save failure"), /adoptAuthoritativePersona|commitBaseline|reconcileVersionedPersonaEditorSave/u);

process.stdout.write("Persona client contract regression passed.\n");

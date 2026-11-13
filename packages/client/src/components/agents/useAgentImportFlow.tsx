// ──────────────────────────────────────────────
// Importing agent files, agent folders and Game Mode rulesets
//
// Shared by the classic Agents panel and the new layout's Agents page: the file
// pickers, the permission review for imported agents and the ruleset review.
// ──────────────────────────────────────────────
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  communityRulesetId,
  containsDecisionStatements,
  getFolderImportEntries,
  isRulesetLocalePackFile,
  isRulesetPackageFile,
  parseRulesetDefinition,
  RULESET_LOCAL_NAMESPACE,
  RULESET_MAX_BYTES,
  RULESET_LOCALE_MAX_BYTES,
  RULESET_PACKAGE_FILE_MAX_BYTES,
  type CustomAgentCapability,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import { toast } from "sonner";
import { useAgentImportPolicy, useImportAgent } from "../../hooks/use-agents";
import {
  readRulesetPackage,
  rulesetPacksForPage,
  useImportRuleset,
  useImportRulesetPackage,
  useInstalledRulesets,
  type RulesetPickedPack,
} from "../../hooks/use-capability-packages";
import { showChoiceDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { notifyDecisionImport } from "../../lib/decision-import-notice";
import { countSkippedAgentImportFunctions, normalizeAgentImportEntry } from "../../lib/agent-transfer";
import {
  collectFolderPackageEntries,
  readTextFilesFromFileList,
  type FolderPackageImportEntry,
} from "../../lib/folder-package-transfer";
import { isZipFile, readTextFilesFromZip } from "../../lib/read-zip-text";
import { Modal } from "../ui/Modal";
import { RulesetImportReviewModal } from "./RulesetImportReviewModal";

type NormalizedAgentImport = NonNullable<ReturnType<typeof normalizeAgentImportEntry>>;
type PendingAgentImport = {
  agents: NormalizedAgentImport[];
  source: "file" | "folder";
  skippedFunctionCount: number;
};
/** A ruleset file waiting for the user to confirm it. The text is kept verbatim, because the server
 *  stores the bytes the user actually chose, not a re-serialization of the parsed document. */
type PendingRulesetImport = {
  definition: RulesetDefinition;
  rulesetId: string;
  text: string;
  /** A ruleset package file (a parsed `.ruleset.json`), imported whole; with each catalog file's entry count. */
  packageFile?: Record<string, unknown>;
  catalogs?: Record<string, number>;
  /** Language packs picked with the package file, in the page's language (1.811). */
  packs?: RulesetPickedPack[];
  /** Packs were picked, but none in the page's language: the ruleset will read in English. */
  packsOtherLanguage?: boolean;
};

function getAgentImportEntries(parsed: unknown) {
  return getFolderImportEntries(parsed, ["agents"]);
}

/**
 * Import agents or a ruleset. `choose()` asks files, folder or ruleset; render `inputs`, `messages`
 * and `dialogs` somewhere on the page. `toasts: true` reports results as toasts instead of `messages`.
 */
export function useAgentImportFlow({ toasts = false }: { toasts?: boolean } = {}) {
  const { t: localizeUi } = useUiTranslation();
  const importAgent = useImportAgent();
  const importRuleset = useImportRuleset();
  const importRulesetPackage = useImportRulesetPackage();
  const { data: installedRulesets = [] } = useInstalledRulesets();
  const { data: agentImportPolicy, isLoading: agentImportPolicyLoading } = useAgentImportPolicy();
  const agentImportInputRef = useRef<HTMLInputElement>(null);
  const agentFolderImportInputRef = useRef<HTMLInputElement>(null);
  const rulesetImportInputRef = useRef<HTMLInputElement>(null);
  const [pendingAgentImport, setPendingAgentImport] = useState<PendingAgentImport | null>(null);
  const [pendingRulesetImport, setPendingRulesetImport] = useState<PendingRulesetImport | null>(null);
  const [rulesetImportFailure, setRulesetImportFailure] = useState<string | null>(null);
  const [approvedImportCapabilities, setApprovedImportCapabilities] = useState<Record<string, CustomAgentCapability[]>>(
    {},
  );
  const [agentImportError, setAgentImportErrorState] = useState<string | null>(null);
  const [agentImportSuccess, setAgentImportSuccessState] = useState<string | null>(null);
  // The new layout has no message strip under the buttons: results show as toasts.
  const setAgentImportError = useCallback(
    (message: string | null) => {
      if (toasts && message) toast.error(message);
      else setAgentImportErrorState(message);
    },
    [toasts],
  );
  const setAgentImportSuccess = useCallback(
    (message: string | null) => {
      if (toasts && message) toast.success(message);
      else setAgentImportSuccessState(message);
    },
    [toasts],
  );
  const agentImportsEnabled = agentImportPolicy?.enabled === true;
  const agentImportsDisabledHelp = localizeUi("settings.agentImports.enableFirst");

  const openAgentImportPicker = useCallback(
    (kind: "file" | "folder" | "ruleset") => {
      if (!agentImportsEnabled) {
        toast.info(agentImportsDisabledHelp);
        return;
      }
      if (kind === "file") agentImportInputRef.current?.click();
      else if (kind === "folder") agentFolderImportInputRef.current?.click();
      else rulesetImportInputRef.current?.click();
    },
    [agentImportsDisabledHelp, agentImportsEnabled],
  );

  const chooseAgentImportSource = useCallback(async () => {
    if (!agentImportsEnabled) {
      openAgentImportPicker("file");
      return;
    }

    const source = await showChoiceDialog({
      title: localizeUi("ui.panels.agentspanel.importAgents"),
      message: localizeUi("ui.panels.agentspanel.chooseAgentFilesOrFolder"),
      choices: [
        { key: "file", label: localizeUi("ui.panels.gameassetssettings.chooseFiles"), tone: "accent" },
        { key: "folder", label: localizeUi("ui.chat.musicdjsetupfields.chooseFolder"), tone: "accent" },
        { key: "ruleset", label: localizeUi("game.ruleset.import.choice"), tone: "accent" },
      ],
    });
    if (source === "file" || source === "folder" || source === "ruleset") openAgentImportPicker(source);
  }, [agentImportsEnabled, localizeUi, openAgentImportPicker]);

  const prepareAgentEntries = useCallback(
    (entries: FolderPackageImportEntry[], source: "file" | "folder", skippedFunctionCount = 0) => {
      if (entries.length === 0) throw new Error("No agents found in file");

      const agents = entries
        .map((entry) => normalizeAgentImportEntry(entry.raw, entry.resolveTextFile))
        .filter((agent): agent is NormalizedAgentImport => agent !== null);
      if (agents.length === 0) throw new Error("No valid agents found in file");
      setApprovedImportCapabilities({});
      setPendingAgentImport({ agents, source, skippedFunctionCount });
    },
    [],
  );

  const handleApproveAgentImport = useCallback(async () => {
    if (!pendingAgentImport) return;
    let imported = 0;
    let usesDecisions = false;
    const failed: string[] = [];
    const failedAgents: NormalizedAgentImport[] = [];
    for (const candidate of pendingAgentImport.agents) {
      const { requestedCapabilities: _requestedCapabilities, ...agent } = candidate;
      try {
        await importAgent.mutateAsync({
          agent,
          source: pendingAgentImport.source,
          approvedCapabilities: approvedImportCapabilities[candidate.type] ?? [],
          acknowledgePermissions: true,
        });
        imported++;
        usesDecisions ||= containsDecisionStatements(agent);
      } catch (error) {
        failed.push(error instanceof Error ? error.message : `Failed to import ${candidate.name}`);
        failedAgents.push(candidate);
      }
    }

    void notifyDecisionImport(usesDecisions, localizeUi);
    if (imported > 0) {
      setAgentImportSuccess(
        `${localizeUi("settings.agentImports.import.success", { count: imported })}${
          pendingAgentImport.skippedFunctionCount > 0
            ? ` ${localizeUi("settings.agentImports.review.functionsSkipped", {
                count: pendingAgentImport.skippedFunctionCount,
              })}`
            : ""
        }`,
      );
    }
    if (failed.length > 0) {
      setAgentImportError(
        localizeUi("settings.agentImports.import.failed", {
          count: failed.length,
          error: failed[0],
        }),
      );
    }
    if (failed.length === 0) {
      setPendingAgentImport(null);
    } else {
      const failedAgentTypes = new Set(failedAgents.map((agent) => agent.type));
      setApprovedImportCapabilities((current) =>
        Object.fromEntries(Object.entries(current).filter(([type]) => failedAgentTypes.has(type))),
      );
      setPendingAgentImport({
        ...pendingAgentImport,
        agents: failedAgents,
        skippedFunctionCount: 0,
      });
    }
  }, [approvedImportCapabilities, importAgent, localizeUi, pendingAgentImport]);

  const toggleApprovedImportCapability = useCallback((agentType: string, capability: CustomAgentCapability) => {
    setApprovedImportCapabilities((current) => {
      const selected = new Set(current[agentType] ?? []);
      if (selected.has(capability)) selected.delete(capability);
      else selected.add(capability);
      return { ...current, [agentType]: Array.from(selected) };
    });
  }, []);

  const handleImportAgents = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        event.target.value = "";
        return;
      }

      try {
        const entries = isZipFile(file)
          ? await (async () => {
              const files = await readTextFilesFromZip(file);
              const agents = collectFolderPackageEntries(files, {
                rootFilenames: ["marinara-agents.json", "marinara-agent.json"],
                collectionKeys: ["agents"],
              });
              const functions = collectFolderPackageEntries(files, {
                rootFilenames: ["marinara-agents.json", "marinara-agent.json", "marinara-functions.json"],
                collectionKeys: ["functions", "customTools", "tools"],
              });
              return {
                agents,
                skippedFunctionCount: countSkippedAgentImportFunctions(agents, functions),
              };
            })()
          : await (async () => {
              const parsed = JSON.parse(await file.text());
              // A Game Mode ruleset or its language pack is imported as a ruleset, never read for agents.
              if (isRulesetPackageFile(parsed)) throw new Error(localizeUi("game.ruleset.import.useRulesetImport"));
              if (isRulesetLocalePackFile(parsed))
                throw new Error(localizeUi("game.ruleset.import.packUseRulesetImport"));
              return {
                agents: getAgentImportEntries(parsed).map((raw): FolderPackageImportEntry => ({
                  raw,
                  path: file.name,
                  basePath: "",
                  resolveTextFile: () => null,
                })),
                skippedFunctionCount: getFolderImportEntries(parsed, ["functions", "customTools", "tools"]).length,
              };
            })();
        prepareAgentEntries(entries.agents, "file", entries.skippedFunctionCount);
      } catch (error) {
        setAgentImportError(
          error instanceof Error ? error.message : localizeUi("ui.overhaul.text.failedToImportAgents"),
        );
      }

      event.target.value = "";
    },
    [agentImportsDisabledHelp, agentImportsEnabled, localizeUi, prepareAgentEntries],
  );

  const handleImportAgentFolder = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        event.target.value = "";
        return;
      }
      try {
        const files = await readTextFilesFromFileList(event.target.files);
        const entries = collectFolderPackageEntries(files, {
          rootFilenames: ["marinara-agents.json", "marinara-agent.json"],
          collectionKeys: ["agents"],
        });
        const functionEntries = collectFolderPackageEntries(files, {
          rootFilenames: ["marinara-agents.json", "marinara-agent.json", "marinara-functions.json"],
          collectionKeys: ["functions", "customTools", "tools"],
        });
        const skippedFunctionCount = countSkippedAgentImportFunctions(entries, functionEntries);
        prepareAgentEntries(entries, "folder", skippedFunctionCount);
      } catch (error) {
        setAgentImportError(
          error instanceof Error ? error.message : localizeUi("ui.overhaul.text.failedToImportAgents"),
        );
      }
      event.target.value = "";
    },
    [agentImportsDisabledHelp, agentImportsEnabled, localizeUi, prepareAgentEntries],
  );

  // A ruleset is parsed with the SAME shared parser the server stores it through, so a file that
  // cannot work is refused here, with the author's own issues, before anything is sent.
  const handleRulesetFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setAgentImportError(null);
      setAgentImportSuccess(null);
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length) return;
      if (!agentImportsEnabled) {
        setAgentImportError(agentImportsDisabledHelp);
        return;
      }
      // One ruleset, with the language packs (1.811) published beside its package file if any were picked.
      const picked: Array<{ file: File; text: string; document: unknown }> = [];
      for (const file of files) {
        if (file.size > RULESET_PACKAGE_FILE_MAX_BYTES) {
          setAgentImportError(
            localizeUi("game.ruleset.import.packageTooLarge", {
              limit: RULESET_PACKAGE_FILE_MAX_BYTES / 1024 / 1024,
            }),
          );
          return;
        }
        let text: string;
        try {
          text = await file.text();
        } catch {
          setAgentImportError(localizeUi("game.ruleset.import.unreadable"));
          return;
        }
        try {
          picked.push({ file, text, document: JSON.parse(text) });
        } catch {
          setAgentImportError(localizeUi("game.ruleset.import.notJson"));
          return;
        }
      }
      const packFiles = picked.filter((each) => isRulesetLocalePackFile(each.document));
      const rulesetFiles = picked.filter((each) => !isRulesetLocalePackFile(each.document));
      if (rulesetFiles.length > 1) {
        setAgentImportError(localizeUi("game.ruleset.import.oneAtATime"));
        return;
      }
      const main = rulesetFiles[0];
      // A pack translates a package; on its own, or beside a ruleset file with no package, it has nothing to attach to.
      if (!main || (packFiles.length && !isRulesetPackageFile(main.document))) {
        setAgentImportError(localizeUi("game.ruleset.import.packNeedsPackage"));
        return;
      }
      const oversized = packFiles.find((each) => each.file.size > RULESET_LOCALE_MAX_BYTES);
      if (oversized) {
        setAgentImportError(
          localizeUi("game.ruleset.import.packTooLarge", {
            name: oversized.file.name,
            limit: RULESET_LOCALE_MAX_BYTES / 1024 / 1024,
          }),
        );
        return;
      }
      const { file, text, document } = main;
      // A package file (`.ruleset.json`, with its catalog files) is read by the Engine, keeping nothing,
      // and reviewed like a ruleset file.
      if (isRulesetPackageFile(document)) {
        const packageFile = document as Record<string, unknown>;
        const packs = rulesetPacksForPage(
          packFiles.map((each) => ({ name: each.file.name, document: each.document as Record<string, unknown> })),
        );
        try {
          const read = await readRulesetPackage(packageFile, packs);
          const parsed = parseRulesetDefinition(JSON.parse(read.ruleset ?? ""));
          if (!parsed.ok) throw new Error(parsed.issues.slice(0, 3).join("; "));
          setRulesetImportFailure(null);
          setPendingRulesetImport({
            definition: parsed.definition,
            rulesetId: read.rulesetId,
            text: read.ruleset ?? "",
            packageFile,
            catalogs: read.catalogs,
            packs,
            packsOtherLanguage: packFiles.length > 0 && packs.length === 0,
          });
        } catch (error) {
          setAgentImportError(
            localizeUi("game.ruleset.import.invalid", {
              issues: error instanceof Error ? error.message : localizeUi("game.ruleset.import.failed"),
            }),
          );
        }
        return;
      }
      if (file.size > RULESET_MAX_BYTES) {
        setAgentImportError(
          localizeUi("game.ruleset.import.tooLarge", { limit: Math.round(RULESET_MAX_BYTES / 1024) }),
        );
        return;
      }
      const parsed = parseRulesetDefinition(document);
      if (!parsed.ok) {
        setAgentImportError(
          localizeUi("game.ruleset.import.invalid", { issues: parsed.issues.slice(0, 3).join("; ") }),
        );
        return;
      }
      try {
        setRulesetImportFailure(null);
        setPendingRulesetImport({
          definition: parsed.definition,
          rulesetId: communityRulesetId(RULESET_LOCAL_NAMESPACE, parsed.definition.id),
          text,
        });
      } catch {
        setAgentImportError(localizeUi("game.ruleset.import.unusableId", { id: parsed.definition.id }));
      }
    },
    [agentImportsDisabledHelp, agentImportsEnabled, localizeUi],
  );

  const handleConfirmRulesetImport = useCallback(async () => {
    const pending = pendingRulesetImport;
    if (!pending) return;
    setAgentImportError(null);
    setAgentImportSuccess(null);
    setRulesetImportFailure(null);
    try {
      const result = pending.packageFile
        ? await importRulesetPackage.mutateAsync({ file: pending.packageFile, packs: pending.packs })
        : await importRuleset.mutateAsync(pending.text);
      setPendingRulesetImport(null);
      // The same version again, now with its language pack: the pack is what changed.
      const translated =
        result.status === "unchanged" && !!pending.packs?.length && "locales" in result && !!result.locales?.length;
      const imported = localizeUi(
        result.status === "added"
          ? "game.ruleset.import.added"
          : translated
            ? "game.ruleset.import.translationAdded"
            : "game.ruleset.import.unchanged",
        { name: pending.definition.name, version: result.version },
      );
      setAgentImportSuccess(
        pending.packsOtherLanguage ? `${imported} ${localizeUi("game.ruleset.import.packOtherLanguage")}` : imported,
      );
    } catch (error) {
      // The server's refusals are already sentences the author can act on, version conflicts
      // included. The review stays open with the reason in it, so a network hiccup can be retried
      // without picking the file again.
      setRulesetImportFailure(error instanceof Error ? error.message : localizeUi("game.ruleset.import.failed"));
    }
  }, [importRuleset, importRulesetPackage, localizeUi, pendingRulesetImport]);

  const inputs = (
    <>
      <input
        ref={agentImportInputRef}
        type="file"
        accept="application/json,application/zip,.json,.zip"
        className="hidden"
        onChange={handleImportAgents}
      />
      <input
        ref={agentFolderImportInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImportAgentFolder}
        // @ts-expect-error — webkitdirectory is a non-standard but widely-supported attribute
        webkitdirectory=""
      />
      <input
        ref={rulesetImportInputRef}
        type="file"
        // By extension only: the Agent import input beside this one is the panel's JSON-typed input.
        // A ruleset comes as its file, or as a package file (`.ruleset.json`) with its catalog files.
        accept=".ruleset.json,.json"
        // With its language packs (`<id>-<version>.<lang>.json`), when the ruleset has them.
        multiple
        className="hidden"
        onChange={(event) => void handleRulesetFileSelected(event)}
      />
    </>
  );

  const messages = (
    <>
      {agentImportError && (
        <div role="alert" className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-500">
          {agentImportError}
        </div>
      )}
      {agentImportSuccess && (
        <div role="status" className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-500">
          {agentImportSuccess}
        </div>
      )}
    </>
  );

  const dialogs = (
    <>
      <Modal
        open={pendingAgentImport !== null}
        onClose={() => {
          if (!importAgent.isPending) setPendingAgentImport(null);
        }}
        title={localizeUi("settings.agentImports.review.title")}
        width="max-w-2xl"
        mobileFullscreen
        closeDisabled={importAgent.isPending}
      >
        {pendingAgentImport && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-3 text-sm leading-6">
              <TriangleAlert
                className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-highlight-text)]"
                size="1rem"
              />
              <p className="text-[var(--muted-foreground)]">{localizeUi("settings.agentImports.review.description")}</p>
            </div>

            {pendingAgentImport.skippedFunctionCount > 0 && (
              <div className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-xs text-[var(--primary)]">
                {localizeUi("settings.agentImports.review.functionsSkipped", {
                  count: pendingAgentImport.skippedFunctionCount,
                })}
              </div>
            )}

            <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
              {pendingAgentImport.agents.map((candidate) => {
                const requestedCapabilities = candidate.requestedCapabilities;
                const selectedCapabilities = new Set(approvedImportCapabilities[candidate.type] ?? []);
                return (
                  <section
                    key={candidate.type}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)]/45 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{candidate.name}</h3>
                        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          {candidate.description || localizeUi("ui.panels.agentcard.noDescription")}
                        </p>
                      </div>
                      <span className="mari-chrome-tag shrink-0 bg-[var(--secondary)] px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)]">
                        {candidate.phase}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold">{localizeUi("settings.agentImports.review.permissions")}</p>
                      {requestedCapabilities.length === 0 ? (
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {localizeUi("settings.agentImports.review.noPermissions")}
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {requestedCapabilities.map((capability) => {
                            const checked = selectedCapabilities.has(capability);
                            return (
                              <label
                                key={capability}
                                className={cn(
                                  "flex cursor-pointer items-start gap-2 rounded-lg p-2 ring-1 transition-colors",
                                  checked
                                    ? "bg-[var(--primary)]/10 ring-[var(--primary)]/30"
                                    : "bg-[var(--secondary)]/35 ring-[var(--border)]",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={importAgent.isPending}
                                  onChange={() => toggleApprovedImportCapability(candidate.type, capability)}
                                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
                                />
                                <span>
                                  <span className="block text-xs font-medium">
                                    {localizeUi(`settings.agentImports.capabilities.${capability}.label`)}
                                  </span>
                                  <span className="block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                                    {localizeUi(`settings.agentImports.capabilities.${capability}.description`)}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("settings.agentImports.review.deniedPermissions")}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={importAgent.isPending}
                onClick={() => setPendingAgentImport(null)}
                className="mari-chrome-control h-10 px-4 text-sm"
              >
                {localizeUi("chat.delete.dialog.cancel")}
              </button>
              <button
                type="button"
                disabled={importAgent.isPending}
                onClick={() => void handleApproveAgentImport()}
                className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
              >
                <ShieldCheck size="0.9rem" />
                {localizeUi("settings.agentImports.review.approve")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <RulesetImportReviewModal
        definition={pendingRulesetImport?.definition ?? null}
        rulesetId={pendingRulesetImport?.rulesetId ?? ""}
        installedVersions={
          installedRulesets.find((entry) => entry.definition.id === pendingRulesetImport?.rulesetId)?.versions ?? []
        }
        importing={importRuleset.isPending || importRulesetPackage.isPending}
        failure={rulesetImportFailure}
        catalogs={(pendingRulesetImport?.definition.catalogs ?? []).map((catalog) => ({
          label: catalog.label,
          count: catalog.entries?.length ?? pendingRulesetImport?.catalogs?.[catalog.id] ?? 0,
        }))}
        translation={!!pendingRulesetImport?.packs?.length}
        onCancel={() => setPendingRulesetImport(null)}
        onConfirm={() => void handleConfirmRulesetImport()}
      />
    </>
  );

  return {
    choose: chooseAgentImportSource,
    enabled: agentImportsEnabled,
    policyLoading: agentImportPolicyLoading,
    disabledHelp: agentImportsDisabledHelp,
    inputs,
    messages,
    dialogs,
  };
}

// ──────────────────────────────────────────────
// Modal: Import Story Bundle (JSON)
// ──────────────────────────────────────────────
// Detects embedded characters, personas, and lorebooks in the export and
// offers to import them — same pattern as character → embedded lorebook.
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import {
  BookMarked,
  BookOpen,
  Bot,
  Download,
  FileJson,
  CheckCircle,
  UserRound,
  Users,
  XCircle,
  Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useTranslation } from "react-i18next";
import { useCapabilityCatalog, useInstallCapabilityPackage } from "../../hooks/use-capability-packages";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface EmbeddedPreview {
  filename: string;
  bundleName: string;
  characterCount: number;
  personaCount: number;
  lorebookCount: number;
  agentCount: number;
}

interface MissingAgent {
  id: string;
  name: string;
}

type MissingAgentInstallState = "idle" | "installing" | "installed" | "not-found" | "failed";

export function ImportStoryBundleModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<Array<{ filename: string; success: boolean; message: string }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pendingEmbeddedChoice, setPendingEmbeddedChoice] = useState<{
    files: File[];
    previews: EmbeddedPreview[];
  } | null>(null);
  const [missingAgents, setMissingAgents] = useState<MissingAgent[]>([]);
  const [agentInstallStates, setAgentInstallStates] = useState<Record<string, MissingAgentInstallState>>({});
  const qc = useQueryClient();
  const catalog = useCapabilityCatalog(missingAgents.length > 0);
  const installPackage = useInstallCapabilityPackage();

  /**
   * Find the catalog package that provides a given agent id.
   *
   * Most capability packages provide exactly one agent whose id equals the
   * package id (e.g. `prose-guardian`, `character-tracker`, `world-state`),
   * so match on `manifest.id` first. A few packages declare the agents they
   * own via `contributions.agentDetail.agentIds` instead (e.g.
   * `long-term-memory`, `hierarchical-maps`), so fall back to that. This
   * mirrors `resolveFeatureAgentPackage` in lib/feature-agent-package.ts.
   */
  const findPackageForAgent = (agentId: string) => {
    const packages = catalog.data?.packages ?? [];
    return (
      packages.find((entry) => entry.manifest.id === agentId) ??
      packages.find((entry) => entry.manifest.contributions?.agentDetail?.agentIds.includes(agentId)) ??
      null
    );
  };

  const handleInstallAgent = async (agent: MissingAgent) => {
    const entry = findPackageForAgent(agent.id);
    if (!entry) {
      setAgentInstallStates((prev) => ({ ...prev, [agent.id]: "not-found" }));
      return;
    }
    setAgentInstallStates((prev) => ({ ...prev, [agent.id]: "installing" }));
    try {
      await installPackage.mutateAsync({
        id: entry.manifest.id,
        expectedVersion: entry.manifest.version,
        expectedArtifactSha256: entry.artifact.sha256,
      });
      setAgentInstallStates((prev) => ({ ...prev, [agent.id]: "installed" }));
    } catch {
      setAgentInstallStates((prev) => ({ ...prev, [agent.id]: "failed" }));
    }
  };

  const inspectEnvelopeForEmbedded = (envelope: Record<string, unknown>): EmbeddedPreview | null => {
    const data = envelope.data as Record<string, unknown> | undefined;
    if (!data) return null;
    const embeddedCharacters = Array.isArray(data.embeddedCharacters) ? data.embeddedCharacters : [];
    const embeddedPersonas = Array.isArray(data.embeddedPersonas) ? data.embeddedPersonas : [];
    const embeddedLorebooks = Array.isArray(data.embeddedLorebooks) ? data.embeddedLorebooks : [];
    // Agents are referenced by id (provided by capability packages), not embedded.
    // Count them from `agentIds`, falling back to the carried `embeddedAgents`
    // metadata so hand-built envelopes still report a count.
    const agentIds = Array.isArray(data.agentIds) ? data.agentIds : [];
    const embeddedAgents = Array.isArray(data.embeddedAgents) ? data.embeddedAgents : [];
    const agentCount = agentIds.length > 0 ? agentIds.length : embeddedAgents.length;
    const total = embeddedCharacters.length + embeddedPersonas.length + embeddedLorebooks.length;
    if (total === 0) return null;
    return {
      filename: "",
      bundleName: typeof data.name === "string" ? data.name : "Story Bundle",
      characterCount: embeddedCharacters.length,
      personaCount: embeddedPersonas.length,
      lorebookCount: embeddedLorebooks.length,
      agentCount,
    };
  };

  const handleFiles = async (files: File[], importEmbedded?: boolean) => {
    if (files.length === 0) return;
    setStatus("loading");
    setResults([]);
    setPendingEmbeddedChoice(null);
    setMissingAgents([]);
    setAgentInstallStates({});

    const nextResults: Array<{ filename: string; success: boolean; message: string }> = [];
    const nextMissingAgents: MissingAgent[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);

        // Accept both bare envelopes and wrapped folder manifests
        const envelopes: Record<string, unknown>[] = [];
        if (
          json &&
          typeof json === "object" &&
          !Array.isArray(json) &&
          (json as Record<string, unknown>).type === "marinara_story_bundle"
        ) {
          envelopes.push(json as Record<string, unknown>);
        } else if (Array.isArray((json as Record<string, unknown>).entries)) {
          const entries = (json as Record<string, unknown>).entries as Array<Record<string, unknown>>;
          for (const entry of entries) {
            if (entry && typeof entry === "object" && entry.type === "marinara_story_bundle") {
              envelopes.push(entry);
            }
          }
        }

        if (envelopes.length === 0) {
          nextResults.push({
            filename: file.name,
            success: false,
            message: t("storyBundles.importNotAStoryBundle", "Not a valid story bundle file."),
          });
          continue;
        }

        // Check for embedded entities before importing
        if (importEmbedded === undefined) {
          const previews: EmbeddedPreview[] = [];
          for (const envelope of envelopes) {
            const preview = inspectEnvelopeForEmbedded(envelope);
            if (preview) {
              preview.filename = file.name;
              previews.push(preview);
            }
          }
          if (previews.length > 0) {
            setPendingEmbeddedChoice({ files, previews });
            setStatus("idle");
            return;
          }
        }

        for (const envelope of envelopes) {
          const payload =
            importEmbedded === false
              ? { ...envelope, data: { ...(envelope.data as Record<string, unknown>), importEmbedded: false } }
              : envelope;
          const data = await api.post<{
            success: boolean;
            id?: string;
            name?: string;
            embeddedImported?: number;
            missingAgents?: Array<{ id: string; name: string }>;
            error?: string;
          }>("/import/marinara", payload);
          const embeddedInfo = data.embeddedImported
            ? t("storyBundles.importedWithEmbedded", {
                count: data.embeddedImported,
                defaultValue: " with {{count}} embedded entities",
              })
            : "";
          nextResults.push({
            filename: file.name,
            success: data.success,
            message: data.success
              ? t("storyBundles.importedAs", {
                  name: data.name ?? "Story Bundle",
                  defaultValue: "Imported “{{name}}”",
                }) + embeddedInfo
              : (data.error ?? t("storyBundles.importFailed", "Import failed")),
          });
          if (data.success && Array.isArray(data.missingAgents)) {
            for (const agent of data.missingAgents) {
              if (
                agent &&
                typeof agent.id === "string" &&
                !nextMissingAgents.some((existing) => existing.id === agent.id)
              ) {
                nextMissingAgents.push({
                  id: agent.id,
                  name: typeof agent.name === "string" && agent.name.trim() ? agent.name : agent.id,
                });
              }
            }
          }
        }
      } catch (error) {
        nextResults.push({
          filename: file.name,
          success: false,
          message: error instanceof Error ? error.message : t("storyBundles.importParseFailed", "Failed to parse file"),
        });
      }
    }

    setResults(nextResults);
    setMissingAgents(nextMissingAgents);
    setStatus("done");
    if (nextResults.some((result) => result.success)) {
      qc.invalidateQueries();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const reset = () => {
    setStatus("idle");
    setResults([]);
    setPendingEmbeddedChoice(null);
    setMissingAgents([]);
    setAgentInstallStates({});
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("storyBundles.importTitle", "Import Story Bundle")}
      testId="story-bundle-import-modal"
    >
      <div className="flex flex-col gap-4">
        {/* Embedded entity prompt — shown before import proceeds */}
        {pendingEmbeddedChoice && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/30 p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("storyBundles.embeddedFound", "This bundle includes embedded content")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t(
                "storyBundles.embeddedFoundHint",
                "The exported file contains full character, persona, and lorebook data. Import them into your library?",
              )}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {pendingEmbeddedChoice.previews.map((preview, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--sidebar)] px-3 py-2 text-xs"
                >
                  <BookMarked size="0.8125rem" className="text-[var(--primary)]" />
                  <span className="font-medium">{preview.bundleName}</span>
                  {preview.characterCount > 0 && (
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <Users size="0.6875rem" />
                      {preview.characterCount}
                    </span>
                  )}
                  {preview.personaCount > 0 && (
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <UserRound size="0.6875rem" />
                      {preview.personaCount}
                    </span>
                  )}
                  {preview.lorebookCount > 0 && (
                    <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                      <BookOpen size="0.6875rem" />
                      {preview.lorebookCount}
                    </span>
                  )}
                  {preview.agentCount > 0 && (
                    <span
                      data-testid="story-bundle-import-embedded-agent-count"
                      className="flex items-center gap-1 text-[var(--muted-foreground)]"
                    >
                      <Bot size="0.6875rem" />
                      {preview.agentCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                data-testid="story-bundle-import-skip-embedded"
                onClick={() => void handleFiles(pendingEmbeddedChoice.files, false)}
                className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--secondary)]"
              >
                {t("storyBundles.skipEmbedded", "Skip embedded content")}
              </button>
              <button
                data-testid="story-bundle-import-import-all"
                onClick={() => void handleFiles(pendingEmbeddedChoice.files, true)}
                className="mari-panel-gradient-button mari-panel-gradient-surface mari-panel-gradient--story-bundles flex-1 rounded-lg px-3 py-2 text-xs font-medium"
              >
                {t("storyBundles.importEmbedded", "Import everything")}
              </button>
            </div>
          </div>
        )}

        {!pendingEmbeddedChoice && (
          <div
            data-testid="story-bundle-import-drop-zone"
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all ${
              dragOver
                ? "border-[var(--primary)] bg-[var(--primary)]/10"
                : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50"
            }`}
          >
            <Download size="2rem" className={dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} />
            <p className="text-sm font-medium">
              {t("storyBundles.importDropHint", "Drop one or more story bundle files here or click to browse")}
            </p>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> {t("storyBundles.importFormat", ".marinara.json")}
            </span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          data-testid="story-bundle-import-file-input"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {status === "loading" && (
          <div
            data-testid="story-bundle-import-loading"
            className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs"
          >
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />{" "}
            {t("storyBundles.importing", "Importing…")}
          </div>
        )}
        {status === "done" && results.length > 0 && (
          <div data-testid="story-bundle-import-results" className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                results.some((result) => result.success)
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
              }`}
            >
              {results.some((result) => result.success) ? <CheckCircle size="0.875rem" /> : <XCircle size="0.875rem" />}
              {results.filter((result) => result.success).length} {t("storyBundles.importSucceeded", "succeeded")}{" "}
              {results.filter((result) => !result.success).length} {t("storyBundles.importFailedCount", "failed")}
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border)]">
              {results.map((result) => (
                <div
                  key={`${result.filename}-${result.message}`}
                  className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2 text-xs last:border-b-0"
                >
                  {result.success ? (
                    <CheckCircle size="0.8125rem" className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{result.filename}</div>
                    <div className="text-[var(--muted-foreground)]">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing agents prompt — agents referenced by the bundle that are not installed */}
        {status === "done" && missingAgents.length > 0 && (
          <div
            data-testid="story-bundle-import-missing-agents"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("storyBundles.missingAgentsFound", "This bundle references agents that are not installed")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {t(
                "storyBundles.missingAgentsFoundHint",
                "Agents are provided by capability packages. Install the matching package to use these agents.",
              )}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {missingAgents.map((agent) => {
                const state = agentInstallStates[agent.id] ?? "idle";
                return (
                  <div
                    key={agent.id}
                    data-testid="story-bundle-import-missing-agent-row"
                    className="flex items-center gap-2 rounded-lg bg-[var(--sidebar)] px-3 py-2 text-xs"
                  >
                    <Bot size="0.8125rem" className="shrink-0 text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{agent.name}</div>
                      {state === "not-found" && (
                        <div className="text-amber-400">
                          {t("storyBundles.missingAgentNoPackage", "No capability package provides this agent")}
                        </div>
                      )}
                      {state === "failed" && (
                        <div className="text-[var(--destructive)]">
                          {t("storyBundles.missingAgentInstallFailed", "Installation failed")}
                        </div>
                      )}
                    </div>
                    {state === "installed" ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle size="0.8125rem" /> {t("storyBundles.missingAgentInstalled", "Installed")}
                      </span>
                    ) : state === "installing" ? (
                      <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                        <Loader2 size="0.8125rem" className="animate-spin" />{" "}
                        {t("storyBundles.missingAgentInstalling", "Installing…")}
                      </span>
                    ) : state === "not-found" ? null : (
                      <button
                        data-testid="story-bundle-import-install-agent"
                        onClick={() => void handleInstallAgent(agent)}
                        disabled={catalog.isLoading}
                        className="mari-panel-gradient-button mari-panel-gradient-surface mari-panel-gradient--story-bundles shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("storyBundles.missingAgentInstall", "Install")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            data-testid="story-bundle-import-close-button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {t("storyBundles.close", "Close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

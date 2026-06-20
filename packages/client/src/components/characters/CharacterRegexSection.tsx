// ──────────────────────────────────────────────
// Character Regex Scripts — scoped-regex manager for the Advanced tab.
// Lists, creates, edits, deletes, imports and exports the regex scripts that
// target THIS character. These scripts are intentionally kept off the global
// Presets → Regexes list; they apply only when a chat's "Scoped Regex Scripts"
// mode includes this character.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Regex, ToggleLeft, ToggleRight, Trash2, Upload } from "lucide-react";
import {
  useRegexScripts,
  useCreateRegexScript,
  useDeleteRegexScript,
  useUpdateRegexScript,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import { useUIStore } from "../../stores/ui.store";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile } from "../../lib/download-json";
import { getFolderImportEntries } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

// ── IO helpers (mirror the regex export/import format used by the Presets panel) ──
function parseBooleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

function parseStringArray(value: unknown): string[] {
  const parsed = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const json = JSON.parse(value);
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  })();
  return parsed.filter((item): item is string => typeof item === "string");
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Scoped exports omit targetCharacterIds — the importer re-scopes to the target character.
function serializeRegexScript(script: RegexScriptRow) {
  return {
    name: script.name,
    enabled: parseBooleanValue(script.enabled),
    findRegex: script.findRegex,
    replaceString: script.replaceString,
    trimStrings: parseStringArray(script.trimStrings),
    placement: parseStringArray(script.placement),
    flags: script.flags,
    promptOnly: parseBooleanValue(script.promptOnly, false),
    order: script.order,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
  };
}

function normalizeRegexImportEntry(entry: unknown) {
  if (!isJsonRecord(entry)) return null;
  const name =
    typeof entry.name === "string" ? entry.name : typeof entry.scriptName === "string" ? entry.scriptName : "";
  let findRegex = typeof entry.findRegex === "string" ? entry.findRegex : "";
  let flags = typeof entry.flags === "string" ? entry.flags : "gi";
  const delimited = findRegex.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (delimited) {
    findRegex = delimited[1] ?? "";
    flags = delimited[2] || "g";
  }
  if (!name || !findRegex) return null;

  const stPlacementMap: Record<number, string> = { 1: "user_input", 2: "ai_output" };
  const rawPlacement = Array.isArray(entry.placement) ? entry.placement : [];
  const mappedPlacement = rawPlacement
    .map((placementValue) => (typeof placementValue === "number" ? stPlacementMap[placementValue] : placementValue))
    .filter(
      (placementValue): placementValue is string => placementValue === "ai_output" || placementValue === "user_input",
    );

  return {
    name,
    enabled: parseBooleanValue(entry.enabled, entry.disabled === undefined ? true : !parseBooleanValue(entry.disabled)),
    findRegex,
    replaceString: typeof entry.replaceString === "string" ? entry.replaceString : "",
    trimStrings: parseStringArray(entry.trimStrings),
    placement: mappedPlacement.length > 0 ? mappedPlacement : ["ai_output"],
    flags,
    promptOnly: parseBooleanValue(entry.promptOnly, false),
    order: typeof entry.order === "number" ? entry.order : 0,
    minDepth: parseNullableNumber(entry.minDepth),
    maxDepth: parseNullableNumber(entry.maxDepth),
  };
}

export function CharacterRegexSection({
  characterId,
  characterName,
}: {
  characterId: string | null;
  characterName?: string;
}) {
  const { data: regexScripts } = useRegexScripts();
  const createRegex = useCreateRegexScript();
  const updateRegex = useUpdateRegexScript();
  const deleteRegex = useDeleteRegexScript();
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const editorDirty = useUIStore((s) => s.editorDirty);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const scopedScripts = useMemo(() => {
    if (!characterId) return [];
    return ((regexScripts ?? []) as RegexScriptRow[])
      .filter((script) => parseStringArray(script.targetCharacterIds).includes(characterId))
      .sort((a, b) => a.order - b.order);
  }, [regexScripts, characterId]);

  // Opening the full regex editor leaves (and unmounts) the character editor.
  // Warn first if the character has unsaved changes so they aren't lost silently.
  const openEditorGuarded = useCallback(
    async (id: string, options?: { defaultCharacterIds?: string[] }) => {
      if (editorDirty) {
        const proceed = await showConfirmDialog({
          title: "Unsaved Changes",
          message:
            "This character has unsaved changes. Opening the regex editor leaves the character editor and discards them. Save the character first, or discard and continue.",
          confirmLabel: "Discard & Continue",
          tone: "destructive",
        });
        if (!proceed) return;
      }
      openRegexDetail(id, {
        ...options,
        ...(characterId ? { returnTo: { characterId, tab: "advanced" } } : {}),
      });
    },
    [editorDirty, openRegexDetail, characterId],
  );

  const handleCreate = useCallback(() => {
    if (!characterId) return;
    void openEditorGuarded("__new__", { defaultCharacterIds: [characterId] });
  }, [characterId, openEditorGuarded]);

  const handleExport = useCallback(() => {
    if (scopedScripts.length === 0) {
      toast.error("No regexes to export");
      return;
    }
    const safeName = (characterName ?? "character").trim().replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "character";
    downloadJsonFile(
      {
        kind: "marinara.regex-scripts",
        version: 1,
        exportedAt: new Date().toISOString(),
        regexScripts: scopedScripts.map(serializeRegexScript),
      },
      `${safeName}-regexes.json`,
    );
    toast.success(`Exported ${scopedScripts.length} regex${scopedScripts.length === 1 ? "" : "es"}`);
  }, [scopedScripts, characterName]);

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setImportError(null);
      setImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file || !characterId) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const entries = getFolderImportEntries(parsed, ["regexScripts", "regexes", "scripts"]);
        if (entries.length === 0) throw new Error("No regex scripts found in file");

        let imported = 0;
        for (const entry of entries) {
          const normalized = normalizeRegexImportEntry(entry);
          if (!normalized) continue;
          // Force-scope every imported script to this character.
          await createRegex.mutateAsync({ ...normalized, targetCharacterIds: [characterId] });
          imported++;
        }

        setImportSuccess(`Imported ${imported} regex script${imported === 1 ? "" : "s"}.`);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "Failed to import regex scripts");
      }

      event.target.value = "";
    },
    [characterId, createRegex],
  );

  const handleDelete = useCallback(
    async (script: RegexScriptRow) => {
      if (
        await showConfirmDialog({
          title: "Delete Regex",
          message: `Delete "${script.name}"?`,
          confirmLabel: "Delete",
          tone: "destructive",
        })
      ) {
        deleteRegex.mutate(script.id);
      }
    },
    [deleteRegex],
  );

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Regex size="0.875rem" className="text-purple-400" />
          Regex Scripts
        </span>
        {characterId && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-purple-400/10 hover:text-purple-400"
              title="Create regex"
            >
              <Plus size="0.8125rem" />
            </button>
            <label
              className="inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-purple-400/10 hover:text-purple-400"
              title="Import regexes from JSON"
            >
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
              <Upload size="0.8125rem" />
            </label>
            <button
              type="button"
              onClick={handleExport}
              disabled={scopedScripts.length === 0}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-purple-400/10 hover:text-purple-400 disabled:cursor-not-allowed disabled:opacity-35"
              title="Export regexes to JSON"
            >
              <Download size="0.8125rem" />
            </button>
          </div>
        )}
      </div>

      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        Find/replace patterns scoped to this character. They stay off the global Presets → Regexes list and apply only
        when a chat&rsquo;s Scoped Regex Scripts mode includes this character.
      </p>

      {!characterId ? (
        <p className="py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          Save this character first to add scoped regex scripts.
        </p>
      ) : (
        <>
          {importError && <div className="text-xs text-red-500">{importError}</div>}
          {importSuccess && <div className="text-xs text-green-500">{importSuccess}</div>}
          {scopedScripts.length === 0 ? (
            <p className="py-1 text-[0.6875rem] text-[var(--muted-foreground)]">No regex scripts for this character yet.</p>
          ) : (
            <div className="space-y-1">
              {scopedScripts.map((script) => {
                const placements = parseStringArray(script.placement);
                const enabled = script.enabled === "true";
                return (
                  <div
                    key={script.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-[var(--secondary)]",
                      !enabled && "opacity-50",
                    )}
                  >
                    <Regex size="0.875rem" className="mt-0.5 shrink-0 text-purple-400" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => void openEditorGuarded(script.id)}
                    >
                      <div className="text-xs font-medium">{script.name}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        {placements.map((placement) => (
                          <span
                            key={placement}
                            className="rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]"
                          >
                            {placement === "ai_output" ? "AI" : "User"}
                          </span>
                        ))}
                        <span className="max-w-[6.25rem] truncate font-mono text-[0.5625rem] text-[var(--muted-foreground)]">
                          /{script.findRegex}/{script.flags}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-purple-400"
                      title={enabled ? "Disable regex" : "Enable regex"}
                      onClick={() => updateRegex.mutate({ id: script.id, enabled: !enabled })}
                    >
                      {enabled ? (
                        <ToggleRight size="0.875rem" className="text-purple-400" />
                      ) : (
                        <ToggleLeft size="0.875rem" className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-purple-400"
                      title="Edit regex"
                      onClick={() => void openEditorGuarded(script.id)}
                    >
                      <Pencil size="0.8125rem" />
                    </button>
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive)]"
                      title="Delete regex"
                      onClick={() => handleDelete(script)}
                    >
                      <Trash2 size="0.8125rem" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
